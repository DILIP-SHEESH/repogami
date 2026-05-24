"""
RepoGami Backend — FastAPI v3
Codebase intelligence engine: dependency parsing, semantic role detection,
blast radius computation, dead code detection, AI-powered file chat,
architecture diagram generation, README generation.

Free stack:
  - GitHub Trees API (60 req/hr unauth, 5000 req/hr with token)
  - Groq API: free tier
    llama-3.1-8b-instant  → fast/cheap, used for summaries
    llama-3.3-70b-versatile → quality, used for architecture graph only
    Sign up: https://console.groq.com (no credit card)

Rate limit strategy:
  - Two-model split: 8b for high-volume calls, 70b only for arch graph
  - Exponential backoff on 429s (1s, 2s, 4s)
  - In-memory LRU cache keyed by owner/repo (avoids repeat Groq calls)
  - Response headers expose remaining Groq quota for frontend awareness
"""

import os
import re
import json
import posixpath
import asyncio
import httpx
import time

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from collections import defaultdict, OrderedDict

from dotenv import load_dotenv
load_dotenv()

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")
GROQ_API_KEY  = os.getenv("GROQ_API_KEY", "")

app = FastAPI(title="RepoGami", version="3.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────────────────────────────────────
# In-memory LRU cache (max 100 entries, per owner/repo)
# ─────────────────────────────────────────────────────────────────────────────

class LRUCache:
    def __init__(self, maxsize: int = 100):
        self._cache: OrderedDict = OrderedDict()
        self._maxsize = maxsize
        self._timestamps: dict[str, float] = {}
        self._ttl = 3600  # 1 hour TTL

    def get(self, key: str):
        if key not in self._cache:
            return None
        if time.time() - self._timestamps.get(key, 0) > self._ttl:
            self._cache.pop(key, None)
            self._timestamps.pop(key, None)
            return None
        self._cache.move_to_end(key)
        return self._cache[key]

    def set(self, key: str, value):
        if key in self._cache:
            self._cache.move_to_end(key)
        self._cache[key] = value
        self._timestamps[key] = time.time()
        if len(self._cache) > self._maxsize:
            oldest = next(iter(self._cache))
            self._cache.pop(oldest)
            self._timestamps.pop(oldest, None)

    def invalidate(self, key: str):
        self._cache.pop(key, None)
        self._timestamps.pop(key, None)


_analyze_cache = LRUCache(maxsize=100)
_arch_cache    = LRUCache(maxsize=100)


# ─────────────────────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────────────────────

SKIP_DIRS = frozenset({
    "node_modules", ".git", "__pycache__", ".next", "dist", "build",
    ".venv", "venv", "env", ".env", "coverage", ".nyc_output", "vendor",
    "target", ".idea", ".vscode", "out", ".cache", ".turbo", ".vercel",
    ".output", "public", "assets", "static", "images", "img", "fonts",
    ".husky", "storybook-static",
})

PARSEABLE_EXT = frozenset({
    ".py", ".js", ".ts", ".jsx", ".tsx", ".mjs", ".cjs",
    ".go", ".rs", ".rb", ".php", ".java", ".cs", ".swift", ".kt",
})

CONFIG_EXT = frozenset({
    ".json", ".yaml", ".yml", ".toml", ".lock", ".md", ".txt",
    ".env", ".ini", ".cfg", ".conf", ".xml", ".csv",
})

EXT_LANGUAGE = {
    ".py": "python",    ".js": "javascript", ".ts": "typescript",
    ".jsx": "javascript", ".tsx": "typescript", ".mjs": "javascript",
    ".cjs": "javascript", ".go": "go",        ".rs": "rust",
    ".rb": "ruby",      ".php": "php",         ".java": "java",
    ".cs": "csharp",    ".swift": "swift",     ".kt": "kotlin",
    ".md": "markdown",  ".json": "json",       ".yaml": "yaml",
    ".yml": "yaml",     ".toml": "toml",       ".css": "css",
    ".scss": "scss",    ".html": "html",       ".sh": "shell",
}

LANG_COLOR = {
    "python": "#3776AB", "javascript": "#F7DF1E", "typescript": "#3178C6",
    "go": "#00ADD8",     "rust": "#CE422B",       "ruby": "#CC342D",
    "php": "#777BB4",    "java": "#007396",        "csharp": "#239120",
    "swift": "#FA7343",  "kotlin": "#7F52FF",      "markdown": "#083FA1",
    "json": "#000000",   "yaml": "#CB171E",         "toml": "#9C4121",
    "css": "#264DE4",    "scss": "#CC6699",         "html": "#E34F26",
    "shell": "#89E051",  "other": "#6B7280",
}

LAYER_HINTS = {
    "frontend":  ["pages", "views", "components", "ui", "app", "screens", "layouts", "templates"],
    "api":       ["api", "routes", "controllers", "handlers", "endpoints", "routers", "rest", "graphql"],
    "services":  ["services", "service", "usecases", "use_cases", "business", "logic", "domain"],
    "models":    ["models", "schemas", "entities", "types", "interfaces", "dto", "structs"],
    "data":      ["db", "database", "repos", "repositories", "store", "storage", "dao", "migrations"],
    "utils":     ["utils", "helpers", "lib", "common", "shared", "core", "pkg"],
    "config":    ["config", "settings", "env", "constants"],
    "infra":     ["infra", "infrastructure", "middleware", "auth", "cache", "queue", "workers"],
    "tests":     ["tests", "test", "__tests__", "spec", "specs"],
}

# Groq model routing
MODEL_FAST    = "llama-3.1-8b-instant"      # summaries, ask, README
MODEL_QUALITY = "llama-3.3-70b-versatile"   # architecture graph (pass 2 only)


# ─────────────────────────────────────────────────────────────────────────────
# Pydantic models
# ─────────────────────────────────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    repo_url: str

class AskRequest(BaseModel):
    repo_url: str
    file_path: str
    question: str
    subgraph: Optional[list] = []

class BlastRequest(BaseModel):
    edges: list
    node_id: str
    depth: Optional[int] = 5

class ReadmeRequest(BaseModel):
    repo_url: str
    project_name: str
    tagline: str
    description: str
    tech_stack: list[str]
    architecture: str
    entry_points: list[str]
    key_modules: list[str]
    insights: list[str]
    total_files: int
    total_edges: int
    languages: dict
    file_tree_summary: str
    top_hubs: Optional[list] = []
    orphan_count: Optional[int] = 0
    complexity: Optional[str] = "medium"

class ArchitectureRequest(BaseModel):
    repo_url: str
    project_name: str
    description: str
    tech_stack: list[str]
    architecture: str
    key_modules: list[str]
    file_tree_summary: str
    languages: dict
    entry_points: Optional[list[str]] = []
    total_files: Optional[int] = 0
    top_hubs: Optional[list] = []
    orphan_count: Optional[int] = 0
    role_counts: Optional[dict] = {}
    total_edges: Optional[int] = 0
    force_refresh: Optional[bool] = False


# ─────────────────────────────────────────────────────────────────────────────
# URL / GitHub helpers
# ─────────────────────────────────────────────────────────────────────────────

def parse_github_url(url: str) -> tuple[str, str]:
    url = url.strip().rstrip("/")
    for prefix in ["https://github.com/", "http://github.com/", "github.com/"]:
        if url.startswith(prefix):
            url = url[len(prefix):]
    parts = url.split("/")
    if len(parts) < 2:
        raise HTTPException(400, "Invalid GitHub URL. Expected: github.com/owner/repo")
    return parts[0], parts[1]


def gh_headers() -> dict:
    h = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
    if GITHUB_TOKEN:
        h["Authorization"] = f"Bearer {GITHUB_TOKEN}"
    return h


def should_skip(path: str) -> bool:
    parts = path.split("/")
    return any(p in SKIP_DIRS or p.startswith(".") for p in parts[:-1])


def file_ext(path: str) -> str:
    return os.path.splitext(path)[1].lower()


def is_config(path: str) -> bool:
    return file_ext(path) in CONFIG_EXT


def get_language(path: str) -> str:
    return EXT_LANGUAGE.get(file_ext(path), "other")


# ─────────────────────────────────────────────────────────────────────────────
# Dependency extraction
# ─────────────────────────────────────────────────────────────────────────────

def extract_deps(content: str, path: str, all_paths: set[str]) -> list[dict]:
    edges = []
    ext = file_ext(path)
    cur_dir = posixpath.dirname(path)

    def resolve(rel: str) -> Optional[str]:
        base = posixpath.normpath(posixpath.join(cur_dir, rel))
        candidates = [
            base,
            base + ".ts", base + ".tsx", base + ".js", base + ".jsx",
            base + ".py",
            base + "/index.ts", base + "/index.tsx",
            base + "/index.js", base + "/index.jsx",
            base + "/__init__.py",
        ]
        for c in candidates:
            if c in all_paths:
                return c
        return None

    def add(target: Optional[str]):
        if target and target != path:
            edges.append({"source": path, "target": target})

    if ext in (".js", ".ts", ".jsx", ".tsx", ".mjs", ".cjs"):
        for m in re.finditer(
            r'(?:import|export)\s+(?:[\w\s{},*]+from\s+)?[\'"](\.[^"\']+)[\'"]',
            content
        ):
            add(resolve(m.group(1)))
        for m in re.finditer(r'require\(\s*[\'"](\.[^"\']+)[\'"]\s*\)', content):
            add(resolve(m.group(1)))
        for m in re.finditer(r'import\s*\(\s*[\'"](\.[^"\']+)[\'"]\s*\)', content):
            add(resolve(m.group(1)))

    elif ext == ".py":
        for m in re.finditer(r'^from\s+(\.[\w.]*)\s+import', content, re.MULTILINE):
            rel = m.group(1)
            dots = len(rel) - len(rel.lstrip("."))
            mod = rel.lstrip(".").replace(".", "/")
            base_dir = cur_dir
            for _ in range(dots - 1):
                base_dir = posixpath.dirname(base_dir)
            candidate_base = posixpath.join(base_dir, mod) if mod else base_dir
            for suffix in ("", ".py", "/__init__.py"):
                c = posixpath.normpath(candidate_base + suffix)
                if c in all_paths:
                    add(c); break
        for m in re.finditer(r'^(?:import|from)\s+([\w.]+)', content, re.MULTILINE):
            mod_parts = m.group(1).split(".")
            for depth in range(len(mod_parts), 0, -1):
                candidate = "/".join(mod_parts[:depth])
                for suffix in (".py", "/__init__.py"):
                    c = candidate + suffix
                    if c in all_paths:
                        add(c); break

    elif ext == ".go":
        for m in re.finditer(r'"([^"]+)"', content):
            imp = m.group(1)
            parts = imp.split("/")
            if parts and "." not in parts[0]:
                candidate = "/".join(parts) + ".go"
                if candidate in all_paths:
                    add(candidate)

    elif ext == ".rs":
        for m in re.finditer(r'^(?:pub\s+)?mod\s+(\w+)\s*;', content, re.MULTILINE):
            mod = m.group(1)
            for c in [
                posixpath.join(cur_dir, mod + ".rs"),
                posixpath.join(cur_dir, mod, "mod.rs"),
            ]:
                if c in all_paths:
                    add(c); break

    elif ext == ".rb":
        for m in re.finditer(r"require_relative\s+['\"]([^'\"]+)['\"]", content):
            add(resolve(m.group(1)))

    elif ext == ".php":
        for m in re.finditer(r'(?:require|include)(?:_once)?\s*[\'"](\.[^"\']+)[\'"]', content):
            add(resolve(m.group(1)))

    elif ext == ".java":
        for m in re.finditer(r'^import\s+([\w.]+);', content, re.MULTILINE):
            imp = m.group(1).replace(".", "/") + ".java"
            if imp in all_paths:
                add(imp)

    seen = set()
    result = []
    for e in edges:
        k = (e["source"], e["target"])
        if k not in seen:
            seen.add(k)
            result.append(e)
    return result


# ─────────────────────────────────────────────────────────────────────────────
# Graph intelligence
# ─────────────────────────────────────────────────────────────────────────────

def compute_metrics(nodes_list: list[dict], edges: list[dict]) -> dict:
    indegree: dict[str, int] = defaultdict(int)
    outdegree: dict[str, int] = defaultdict(int)
    dependents: dict[str, list] = defaultdict(list)
    dependencies: dict[str, list] = defaultdict(list)

    for e in edges:
        src, tgt = e["source"], e["target"]
        outdegree[src] += 1
        indegree[tgt] += 1
        dependents[tgt].append(src)
        dependencies[src].append(tgt)

    return {
        "indegree": dict(indegree),
        "outdegree": dict(outdegree),
        "dependents": dict(dependents),
        "dependencies": dict(dependencies),
    }


def get_role(path: str, ind: int, outd: int, config: bool) -> str:
    if config:                 return "config"
    if ind == 0 and outd == 0: return "orphan"
    if ind == 0 and outd > 0:  return "entry"
    if ind >= 4:               return "hub"
    if ind >= 2:               return "shared"
    return "leaf"


def blast_radius_bfs(node_id: str, edges: list[dict], depth: int = 5) -> set[str]:
    affected: set[str] = set()
    frontier = {node_id}
    for _ in range(depth):
        next_frontier: set[str] = set()
        for e in edges:
            if e["target"] in frontier and e["source"] not in affected and e["source"] != node_id:
                next_frontier.add(e["source"])
                affected.add(e["source"])
        frontier = next_frontier
        if not frontier:
            break
    return affected


def detect_layer(path: str) -> str:
    lower = path.lower()
    for layer, keywords in LAYER_HINTS.items():
        for kw in keywords:
            if f"/{kw}/" in f"/{lower}/" or lower.startswith(f"{kw}/"):
                return layer
    return "utils"


# ─────────────────────────────────────────────────────────────────────────────
# LLM — Groq with retry + backoff
# ─────────────────────────────────────────────────────────────────────────────

_last_groq_quota: dict = {}


async def groq(
    system: str,
    user: str,
    max_tokens: int = 800,
    json_mode: bool = False,
    timeout: int = 60,
    model: str = MODEL_FAST,
    retries: int = 3,
) -> str:
    if not GROQ_API_KEY:
        return "GROQ_API_KEY not set. Get your free key at console.groq.com"

    payload: dict = {
        "model": model,
        "max_tokens": max_tokens,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user",   "content": user},
        ],
        "temperature": 0.15,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    last_error = ""
    for attempt in range(retries):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                r = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {GROQ_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )

            _last_groq_quota.update({
                "remaining_requests": r.headers.get("x-ratelimit-remaining-requests"),
                "remaining_tokens":   r.headers.get("x-ratelimit-remaining-tokens"),
                "reset_requests":     r.headers.get("x-ratelimit-reset-requests"),
                "reset_tokens":       r.headers.get("x-ratelimit-reset-tokens"),
                "model": model,
            })

            if r.status_code == 429:
                wait_secs = 2 ** attempt
                reset_after = r.headers.get("retry-after") or r.headers.get("x-ratelimit-reset-requests")
                if reset_after:
                    try:
                        wait_secs = min(float(reset_after.rstrip("s")), 30)
                    except ValueError:
                        pass
                print(f"[Groq 429] attempt {attempt+1}/{retries}, waiting {wait_secs}s (model={model})")
                await asyncio.sleep(wait_secs)
                continue

            if r.status_code != 200:
                last_error = f"Groq error {r.status_code}: {r.text[:200]}"
                await asyncio.sleep(1)
                continue

            return r.json()["choices"][0]["message"]["content"]

        except httpx.TimeoutException:
            last_error = f"Groq request timed out (attempt {attempt+1})"
            await asyncio.sleep(1)
        except Exception as ex:
            last_error = f"LLM request failed: {str(ex)}"
            await asyncio.sleep(1)

    return last_error or "Groq request failed after retries."


def safe_json_parse(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```\w*\n?", "", text)
        text = re.sub(r"\n?```$", "", text.strip())
    match = re.search(r'\{.*\}', text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except Exception:
            pass
    try:
        return json.loads(text)
    except Exception:
        return {}


# ─────────────────────────────────────────────────────────────────────────────
# Architecture: 2-pass JSON graph pipeline
# ─────────────────────────────────────────────────────────────────────────────

ARCH_EXPLAIN_SYSTEM = """You are a principal software engineer analyzing a repository.
You will receive a file tree and project description.
Explain the repository architecture in a way that helps draw an accurate system diagram.

Requirements:
- Be concrete and repo-specific. Reference actual directory/file names.
- Identify main subsystems, data flows, and important boundaries.
- Mention technologies only when they materially affect the architecture.
- Write 8-14 short sections or paragraphs. Be high-signal, not exhaustive.
- Do not use Mermaid syntax, JSON, or pseudo-code.
- Do not assume it is a web app — it could be any project type.

Return only the explanation text. No headers, no preamble."""


ARCH_GRAPH_SYSTEM = """You are a repository-to-graph planner.
You produce a clean, high-signal architecture graph from a plain-English explanation.

Return ONLY valid JSON matching this exact schema:
{
  "nodes": [
    {
      "id": "unique_snake_case_id",
      "label": "1-4 word human label",
      "type": "short description of what it does (shown as subtitle)",
      "group": "group id this node belongs to, or null"
    }
  ],
  "edges": [
    {
      "from": "source_node_id",
      "to": "target_node_id",
      "label": "optional short verb (e.g. calls, reads, emits)",
      "style": "solid | dashed | thick"
    }
  ],
  "groups": [
    {
      "id": "unique_group_id",
      "label": "Layer or subsystem name"
    }
  ]
}

Rules:
- 14-24 nodes is the target. Fewer is better if it still captures the architecture.
- 10-30 edges. Only meaningful relationships.
- 0-6 groups. Use groups for clear architectural layers only.
- Use "thick" style for critical/main data flow edges.
- Use "dashed" style for optional or async relationships.
- Use "solid" for normal dependencies.
- Collapse test files, tiny helpers, and config files into one node unless central.
- Short human labels. Prefer nouns. No file extensions in labels.
- Do not emit Mermaid syntax, URLs, or any text outside the JSON object."""


async def _generate_arch_graph(
    owner: str,
    repo: str,
    description: str,
    tech_stack: list[str],
    architecture: str,
    key_modules: list[str],
    file_tree_summary: str,
    languages: dict,
    entry_points: list[str],
    top_hubs: list,
) -> dict:
    tech_str     = ", ".join(tech_stack) if tech_stack else "unknown"
    lang_str     = ", ".join(f"{k}({v})" for k, v in languages.items() if v > 0)
    entry_str    = ", ".join(entry_points[:5]) if entry_points else "none detected"
    hubs_str     = "\n".join(
        f"- {h['name']} (imported by {h['indegree']} files)"
        for h in (top_hubs or [])[:6]
    ) or "- none"
    modules_str  = "\n".join(f"- {m}" for m in key_modules[:8]) or "- none detected"

    tree_lines   = file_tree_summary.strip().split("\n")
    tree_trimmed = "\n".join(tree_lines[:80])

    # Pass 1: plain-English explanation (fast model)
    explanation_raw = await groq(
        system=ARCH_EXPLAIN_SYSTEM,
        user=f"""Repository: {owner}/{repo}
Pattern: {architecture}
Tech stack: {tech_str}
Languages: {lang_str}
Entry points: {entry_str}

Key modules:
{modules_str}

Most-imported files:
{hubs_str}

<file_tree>
{tree_trimmed}
</file_tree>

<readme>
{description[:600]}
</readme>""",
        max_tokens=700,
        model=MODEL_FAST,
        retries=3,
    )

    explanation = explanation_raw.strip()

    # Pass 2: structured JSON graph (quality model)
    graph_raw = await groq(
        system=ARCH_GRAPH_SYSTEM,
        user=f"""<explanation>
{explanation}
</explanation>

<repo_owner>{owner}</repo_owner>
<repo_name>{repo}</repo_name>

<file_tree>
{tree_trimmed}
</file_tree>""",
        max_tokens=1200,
        json_mode=True,
        model=MODEL_QUALITY,
        retries=3,
        timeout=90,
    )

    graph = safe_json_parse(graph_raw)

    if not graph or "nodes" not in graph:
        graph = {"nodes": [], "edges": [], "groups": []}

    for node in graph.get("nodes", []):
        node.setdefault("type", "")
        node.setdefault("group", None)

    for edge in graph.get("edges", []):
        edge.setdefault("label", "")
        edge.setdefault("style", "solid")

    node_ids = {n["id"] for n in graph.get("nodes", [])}
    graph["edges"] = [
        e for e in graph.get("edges", [])
        if e.get("from") in node_ids and e.get("to") in node_ids
           and e.get("from") != e.get("to")
    ]

    return {
        "title": f"{repo} Architecture",
        "explanation": explanation,
        "graph": graph,
        "mermaid": None,
    }


# ─────────────────────────────────────────────────────────────────────────────
# README system prompt — developer-loved format
# ─────────────────────────────────────────────────────────────────────────────

README_SYSTEM = """You are a senior open-source developer writing a world-class README.md.

The README you produce must follow the format that developers love and star:

STRUCTURE (in this exact order):
1. Centered header block:
   - HTML <div align="center"> wrapper
   - H1 project name
   - Italic one-line tagline
   - Blank line
   - shields.io badges row (language, license MIT, stars, last commit, issues)
   - Blank line, close </div>

2. Table of Contents (linked anchors, 6-8 items)

3. ## ✨ Features
   - 6-8 bullets, each starting with a bold keyword specific to THIS codebase
   - Reference actual module/file names where relevant

4. ## 🏗️ Architecture
   - 2-3 sentences describing the actual pattern
   - ASCII flow diagram referencing real module names (use →, │, ├──, └──)

5. ## 🛠️ Tech Stack
   | Technology | Role | Notes |
   Three-column markdown table. Be specific, not generic.

6. ## 🚀 Getting Started
   ### Prerequisites
   ### Installation
   Shell code blocks with actual commands for the detected stack.

7. ## 💡 Usage
   2-3 realistic examples with shell/code blocks referencing actual entry points.

8. ## 📁 Project Structure
   Annotated file tree, max 20 lines, with inline comments after each path.

9. ## 🤝 Contributing
   Short paragraph + standard fork → branch → PR workflow.

10. ## 📄 License
    MIT license line with badge.

RULES:
- Output raw Markdown only. No preamble, no "Here is your README".
- Every section must be specific to the actual repo — no generic lorem ipsum.
- shields.io badge format: ![badge](https://img.shields.io/badge/LABEL-VALUE-COLOR?style=flat-square&logo=LOGO&logoColor=white)
- For GitHub-dynamic badges use: https://img.shields.io/github/METRIC/OWNER/REPO?style=flat-square
- ASCII diagrams: use box-drawing chars (─, │, ├, └, →) not hyphens.
- Never mention RepoGami, AI generation, or any tooling used to create this README.
- Never use placeholder text like [your name] or [link here] — infer from context."""


# ─────────────────────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {
        "status": "RepoGami API v3",
        "docs": "/docs",
        "quota": _last_groq_quota or "no requests made yet",
    }


@app.get("/quota")
async def quota():
    return _last_groq_quota or {"message": "No Groq calls made yet in this process."}


@app.post("/analyze")
async def analyze(req: AnalyzeRequest):
    owner, repo = parse_github_url(req.repo_url)
    cache_key = f"{owner}/{repo}"

    cached = _analyze_cache.get(cache_key)
    if cached:
        return {**cached, "_cached": True}

    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get(
            f"https://api.github.com/repos/{owner}/{repo}/git/trees/HEAD?recursive=1",
            headers=gh_headers(),
        )

    if resp.status_code == 404:
        raise HTTPException(404, f"Repo '{owner}/{repo}' not found or is private.")
    if resp.status_code == 403:
        raise HTTPException(403, "GitHub rate limit hit. Set GITHUB_TOKEN in .env for 5000 req/hr.")
    if resp.status_code != 200:
        raise HTTPException(resp.status_code, resp.text[:300])

    tree = resp.json()
    all_items = tree.get("tree", [])
    truncated = tree.get("truncated", False)

    files = [
        item for item in all_items
        if item["type"] == "blob" and not should_skip(item["path"])
    ]

    source_files = [f for f in files if file_ext(f["path"]) in PARSEABLE_EXT]
    config_files = [f for f in files if is_config(f["path"])]
    other_files  = [f for f in files if f not in source_files and f not in config_files]
    files = source_files[:300] + config_files[:50] + other_files[:50]
    all_paths = {f["path"] for f in files}

    to_fetch = [f for f in files if file_ext(f["path"]) in PARSEABLE_EXT][:100]
    contents: dict[str, str] = {}

    async def fetch_file(path: str, client: httpx.AsyncClient):
        try:
            r = await client.get(
                f"https://raw.githubusercontent.com/{owner}/{repo}/HEAD/{path}",
                headers=gh_headers(),
            )
            if r.status_code == 200:
                contents[path] = r.text[:8000]
        except Exception:
            pass

    async with httpx.AsyncClient(timeout=30) as client:
        for i in range(0, len(to_fetch), 40):
            batch = to_fetch[i:i+40]
            await asyncio.gather(*[fetch_file(f["path"], client) for f in batch])

    edges: list[dict] = []
    for path, content in contents.items():
        edges.extend(extract_deps(content, path, all_paths))

    seen_e: set[tuple] = set()
    unique_edges = []
    for e in edges:
        k = (e["source"], e["target"])
        if k not in seen_e:
            seen_e.add(k)
            unique_edges.append(e)
    edges = unique_edges

    metrics = compute_metrics(files, edges)
    ind = metrics["indegree"]
    outd = metrics["outdegree"]
    deps_of = metrics["dependencies"]
    dependents_of = metrics["dependents"]

    nodes = []
    for f in files:
        path = f["path"]
        config = is_config(path)
        i = ind.get(path, 0)
        o = outd.get(path, 0)
        lang = get_language(path)
        role = get_role(path, i, o, config)

        nodes.append({
            "id": path,
            "name": os.path.basename(path),
            "path": path,
            "dir": posixpath.dirname(path) or "/",
            "language": lang,
            "lang_color": LANG_COLOR.get(lang, LANG_COLOR["other"]),
            "extension": file_ext(path),
            "size": f.get("size", 0),
            "role": role,
            "indegree": i,
            "outdegree": o,
            "dependents": dependents_of.get(path, [])[:15],
            "dependencies": deps_of.get(path, [])[:15],
            "is_orphan": role == "orphan",
            "is_entry":  role == "entry",
            "is_hub":    role == "hub",
            "is_config": config,
        })

    key_filenames = [
        "README.md", "package.json", "pyproject.toml", "requirements.txt",
        "Cargo.toml", "go.mod", "pom.xml", "build.gradle", "composer.json",
        "Gemfile", "setup.py", "setup.cfg", "main.py", "app.py", "index.ts",
        "index.js", "main.ts", "server.py", "server.ts", "app.ts",
    ]
    key_content_parts = []
    for fname in key_filenames:
        for item in files:
            if os.path.basename(item["path"]) == fname and item["path"] in contents:
                key_content_parts.append(
                    f"=== {item['path']} ===\n{contents[item['path']][:800]}"
                )
                break

    entry_nodes = [n for n in nodes if n["is_entry"]][:3]
    seen_paths = {k.split("===")[1].strip() for k in key_content_parts if "===" in k}
    for n in entry_nodes:
        if n["path"] in contents and n["path"] not in seen_paths:
            key_content_parts.append(
                f"=== {n['path']} (entry point) ===\n{contents[n['path']][:500]}"
            )

    file_list   = "\n".join(f["path"] for f in files[:100])
    key_content = "\n\n".join(key_content_parts[:5])

    summary_raw = await groq(
        system="You are a senior software architect. Analyze codebases. Return only valid JSON.",
        user=f"""Analyze this GitHub repository: {owner}/{repo}

File list ({len(files)} total, first 100 shown):
{file_list}

Key file contents:
{key_content}

Return ONLY a valid JSON object (no markdown fences, no extra text):
{{
  "project_name": "human-readable project name",
  "tagline": "one sharp sentence — what it does and for whom",
  "description": "2-3 sentences: what the project does, who uses it, what problem it solves",
  "tech_stack": ["list", "of", "primary", "technologies"],
  "architecture": "single pattern label, e.g.: REST API, CLI tool, monorepo, library",
  "entry_points": ["list of files where execution begins"],
  "key_modules": ["path/to/module: one-line description", "...up to 6"],
  "complexity": "low | medium | high",
  "insights": [
    "one specific structural observation",
    "one concrete improvement suggestion",
    "one thing done unusually well"
  ]
}}""",
        max_tokens=600,
        json_mode=True,
        model=MODEL_FAST,
    )

    summary = safe_json_parse(summary_raw)
    if not summary:
        summary = {
            "project_name": repo,
            "tagline": f"GitHub repository by {owner}",
            "description": summary_raw[:200] if summary_raw else "Analysis unavailable.",
            "tech_stack": [],
            "architecture": "unknown",
            "entry_points": [],
            "key_modules": [],
            "complexity": "unknown",
            "insights": [],
        }

    lang_counts: dict[str, int] = defaultdict(int)
    role_counts: dict[str, int] = defaultdict(int)
    for n in nodes:
        lang_counts[n["language"]] += 1
        role_counts[n["role"]] += 1

    top_hubs = sorted(
        [n for n in nodes if n["is_hub"]],
        key=lambda n: n["indegree"], reverse=True,
    )[:5]

    stats = {
        "total_files": len(nodes),
        "total_edges": len(edges),
        "orphan_count": role_counts.get("orphan", 0),
        "hub_count": role_counts.get("hub", 0),
        "entry_count": role_counts.get("entry", 0),
        "shared_count": role_counts.get("shared", 0),
        "languages": dict(sorted(lang_counts.items(), key=lambda x: x[1], reverse=True)),
        "top_hubs": [{"id": n["id"], "name": n["name"], "indegree": n["indegree"]} for n in top_hubs],
        "role_counts": dict(role_counts),
    }

    result = {
        "graph": {"nodes": nodes, "links": edges},
        "summary": summary,
        "stats": stats,
        "meta": {
            "owner": owner,
            "repo": repo,
            "url": f"https://github.com/{owner}/{repo}",
            "truncated": truncated,
            "files_fetched_for_deps": len(contents),
        },
    }

    _analyze_cache.set(cache_key, result)
    return result


@app.post("/ask")
async def ask(req: AskRequest):
    owner, repo = parse_github_url(req.repo_url)

    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(
            f"https://raw.githubusercontent.com/{owner}/{repo}/HEAD/{req.file_path}",
            headers=gh_headers(),
        )
    file_content = r.text[:4000] if r.status_code == 200 else "[Content unavailable]"

    imports     = [e["target"] for e in req.subgraph if e.get("source") == req.file_path]
    imported_by = [e["source"] for e in req.subgraph if e.get("target") == req.file_path]

    answer = await groq(
        system="""You are an expert software engineer doing codebase analysis.
You have been given a specific file and its dependency relationships.
Be direct, technical, and precise. Reference actual code identifiers when relevant.
Use code blocks (triple backticks with language tag) for code snippets.
If asked about blast radius, trace the dependency chain explicitly.
Format with clear short paragraphs. No generic disclaimers.""",
        user=f"""File: {req.file_path}

Imports (outgoing deps): {imports or ['none']}
Imported by (incoming deps): {imported_by or ['none']}

File content:

Question: {req.question}""",
        max_tokens=700,
        model=MODEL_FAST,
    )

    return {
        "answer": answer,
        "file": req.file_path,
        "context": {
            "imports_count": len(imports),
            "imported_by_count": len(imported_by),
        },
    }


@app.post("/blast-radius")
async def blast_radius_route(req: BlastRequest):
    affected_by_depth = []
    frontier = {req.node_id}
    all_affected: set[str] = set()

    for depth in range(req.depth):
        next_frontier: set[str] = set()
        for e in req.edges:
            src, tgt = e.get("source", ""), e.get("target", "")
            if tgt in frontier and src not in all_affected and src != req.node_id:
                next_frontier.add(src)
                all_affected.add(src)
        if not next_frontier:
            break
        affected_by_depth.append({"depth": depth + 1, "files": list(next_frontier)})
        frontier = next_frontier

    return {
        "node": req.node_id,
        "total_affected": len(all_affected),
        "affected_files": list(all_affected),
        "by_depth": affected_by_depth,
    }


@app.post("/generate-readme")
async def generate_readme(req: ReadmeRequest):
    owner, repo = parse_github_url(req.repo_url)

    tech_str    = ", ".join(req.tech_stack) if req.tech_stack else "unknown"
    lang_str    = "\n".join(
        f"  - {lang}: {count} files"
        for lang, count in req.languages.items() if count > 0
    )
    modules_str = "\n".join(f"  - {m}" for m in req.key_modules) if req.key_modules else "  - (none detected)"
    insights_str = "\n".join(f"  - {i}" for i in req.insights) if req.insights else "  - (none)"
    entry_str   = ", ".join(req.entry_points[:5]) if req.entry_points else "not detected"
    top_hubs_str = "\n".join(
        f"  - {h['name']} (imported by {h['indegree']} files)"
        for h in (req.top_hubs or [])[:5]
    ) or "  - (none)"

    # Determine primary language for badge color
    primary_lang = list(req.languages.keys())[0] if req.languages else "unknown"
    lang_badge_colors = {
        "python": "3776AB", "javascript": "F7DF1E", "typescript": "3178C6",
        "go": "00ADD8", "rust": "CE422B", "java": "007396",
        "csharp": "239120", "ruby": "CC342D", "php": "777BB4",
    }
    lang_color = lang_badge_colors.get(primary_lang, "6B7280")

    prompt = f"""Write a world-class README.md for the GitHub repository {owner}/{repo}.

REPOSITORY DATA (use all of it, be specific):
- Project name: {req.project_name}
- Tagline: {req.tagline}
- Description: {req.description}
- Architecture pattern: {req.architecture}
- Complexity: {req.complexity}
- Primary language: {primary_lang} (badge color: #{lang_color})
- Tech stack: {tech_str}
- Entry points: {entry_str}
- Total files: {req.total_files} | Dependency edges: {req.total_edges} | Orphan files: {req.orphan_count}
- Languages breakdown:
{lang_str}
- Key modules:
{modules_str}
- Most-imported hub files:
{top_hubs_str}
- Codebase insights:
{insights_str}
- File tree sample (first 40 paths):
{req.file_tree_summary[:800]}

BADGE REQUIREMENTS — include all of these in the centered header:
1. Language badge: ![{primary_lang}](https://img.shields.io/badge/{primary_lang}-#{lang_color}?style=flat-square&logo={primary_lang}&logoColor=white)
2. License: ![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)
3. Stars: ![Stars](https://img.shields.io/github/stars/{owner}/{repo}?style=flat-square&color=yellow)
4. Last commit: ![Last Commit](https://img.shields.io/github/last-commit/{owner}/{repo}?style=flat-square)
5. Issues: ![Issues](https://img.shields.io/github/issues/{owner}/{repo}?style=flat-square)
6. Add 1-2 more relevant badges based on the tech stack (e.g. FastAPI, React, Docker, etc.)

Follow the system instructions exactly. Output only the raw README.md content."""

    readme_md = await groq(
        system=README_SYSTEM,
        user=prompt,
        max_tokens=2200,
        model=MODEL_FAST,
    )

    return {"readme": readme_md}


@app.post("/generate-architecture")
async def generate_architecture(req: ArchitectureRequest):
    owner, repo = parse_github_url(req.repo_url)
    cache_key = f"{owner}/{repo}"

    if not req.force_refresh:
        cached = _arch_cache.get(cache_key)
        if cached:
            return {**cached, "_cached": True}

    result = await _generate_arch_graph(
        owner=owner,
        repo=repo,
        description=req.description,
        tech_stack=req.tech_stack,
        architecture=req.architecture,
        key_modules=req.key_modules,
        file_tree_summary=req.file_tree_summary,
        languages=req.languages,
        entry_points=req.entry_points or [],
        top_hubs=req.top_hubs or [],
    )

    _arch_cache.set(cache_key, result)
    return result


@app.delete("/cache/{owner}/{repo}")
async def clear_cache(owner: str, repo: str):
    key = f"{owner}/{repo}"
    _analyze_cache.invalidate(key)
    _arch_cache.invalidate(key)
    return {"cleared": key}