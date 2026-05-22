"""
RepoGami Backend — FastAPI
Codebase intelligence engine: dependency parsing, semantic role detection,
blast radius computation, dead code detection, AI-powered file chat.

Free stack:
  - GitHub Trees API (60 req/hr unauth, 5000 req/hr with token)
  - Groq API: free tier, llama-3.3-70b-versatile, 14,400 req/day
    Sign up: https://console.groq.com (no credit card)
"""

import os
import re
import json
import posixpath
import asyncio
import httpx

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from collections import defaultdict
from fastapi import BackgroundTasks

from dotenv import load_dotenv
load_dotenv()

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

app = FastAPI(title="RepoGami", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

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

# Extensions we parse for dependency edges
PARSEABLE_EXT = frozenset({
    ".py", ".js", ".ts", ".jsx", ".tsx", ".mjs", ".cjs",
    ".go", ".rs", ".rb", ".php", ".java", ".cs", ".swift", ".kt",
})

# Config/doc extensions — present in graph but not parsed for deps
CONFIG_EXT = frozenset({
    ".json", ".yaml", ".yml", ".toml", ".lock", ".md", ".txt",
    ".env", ".ini", ".cfg", ".conf", ".xml", ".csv",
})

EXT_LANGUAGE = {
    ".py": "python", ".js": "javascript", ".ts": "typescript",
    ".jsx": "javascript", ".tsx": "typescript", ".mjs": "javascript",
    ".cjs": "javascript", ".go": "go", ".rs": "rust", ".rb": "ruby",
    ".php": "php", ".java": "java", ".cs": "csharp", ".swift": "swift",
    ".kt": "kotlin", ".md": "markdown", ".json": "json",
    ".yaml": "yaml", ".yml": "yaml", ".toml": "toml",
    ".css": "css", ".scss": "scss", ".html": "html", ".sh": "shell",
}

LANG_COLOR = {
    "python": "#3776AB", "javascript": "#F7DF1E", "typescript": "#3178C6",
    "go": "#00ADD8", "rust": "#CE422B", "ruby": "#CC342D",
    "php": "#777BB4", "java": "#007396", "csharp": "#239120",
    "swift": "#FA7343", "kotlin": "#7F52FF", "markdown": "#083FA1",
    "json": "#000000", "yaml": "#CB171E", "toml": "#9C4121",
    "css": "#264DE4", "scss": "#CC6699", "html": "#E34F26",
    "shell": "#89E051", "other": "#6B7280",
}


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
    edges: list  # [{source, target}]
    node_id: str
    depth: Optional[int] = 5


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
# Dependency extraction — language-aware, posixpath throughout
# ─────────────────────────────────────────────────────────────────────────────

def extract_deps(content: str, path: str, all_paths: set[str]) -> list[dict]:
    """
    Extract import edges from a single file.
    Only resolves to files that actually exist in all_paths.
    Returns: [{source: str, target: str}]
    """
    edges = []
    ext = file_ext(path)
    cur_dir = posixpath.dirname(path)

    def resolve(rel: str) -> Optional[str]:
        """Resolve a relative import string to an actual repo path."""
        base = posixpath.normpath(posixpath.join(cur_dir, rel))
        # Try exact match and common extension variants
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

    # ── JavaScript / TypeScript ──────────────────────────────────────────
    if ext in (".js", ".ts", ".jsx", ".tsx", ".mjs", ".cjs"):
        # ES module static imports: import X from './y'
        for m in re.finditer(
            r'(?:import|export)\s+(?:[\w\s{},*]+from\s+)?[\'"](\.[^"\']+)[\'"]',
            content
        ):
            add(resolve(m.group(1)))

        # CommonJS: require('./y')
        for m in re.finditer(r'require\(\s*[\'"](\.[^"\']+)[\'"]\s*\)', content):
            add(resolve(m.group(1)))

        # Dynamic: import('./y')
        for m in re.finditer(r'import\s*\(\s*[\'"](\.[^"\']+)[\'"]\s*\)', content):
            add(resolve(m.group(1)))

    # ── Python ──────────────────────────────────────────────────────────
    elif ext == ".py":
        # Relative imports only: from .utils import X  /  from ..models import Y
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
                    add(c)
                    break

    # ── Go ───────────────────────────────────────────────────────────────
    elif ext == ".go":
        # Only internal package imports (containing the module path)
        # We can resolve paths that match directory structure
        for m in re.finditer(r'[\'"]([^"\']+)[\'"]', content):
            imp = m.group(1)
            # Heuristic: if it looks like a local path (no dots in first segment)
            parts = imp.split("/")
            if parts and "." not in parts[0]:
                candidate = posixpath.join(*parts) + ".go" if parts else None
                if candidate and candidate in all_paths:
                    add(candidate)

    # ── Rust ─────────────────────────────────────────────────────────────
    elif ext == ".rs":
        for m in re.finditer(r'^(?:pub\s+)?mod\s+(\w+)\s*;', content, re.MULTILINE):
            mod = m.group(1)
            for c in [
                posixpath.join(cur_dir, mod + ".rs"),
                posixpath.join(cur_dir, mod, "mod.rs"),
            ]:
                if c in all_paths:
                    add(c)
                    break

    # ── PHP ──────────────────────────────────────────────────────────────
    elif ext == ".php":
        for m in re.finditer(r'(?:require|include)(?:_once)?\s*[\'"](\.[^"\']+)[\'"]', content):
            add(resolve(m.group(1)))

    # Deduplicate
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
    """Compute indegree, outdegree, blast radius depth for all nodes."""
    indegree: dict[str, int] = defaultdict(int)
    outdegree: dict[str, int] = defaultdict(int)
    dependents: dict[str, list] = defaultdict(list)   # who imports me
    dependencies: dict[str, list] = defaultdict(list)  # what I import

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
    """
    Semantic role — this drives the node color. It's the core visual insight.
      orphan  = dead code (nothing imports it, it imports nothing, not config)
      entry   = execution starts here (nothing imports it, but it imports others)
      hub     = imported by 4+ files — critical, highly depended on
      shared  = imported by 2-3 files
      leaf    = regular file (imports others, not widely imported)
      config  = config/docs file
    """
    if config:
        return "config"
    if ind == 0 and outd == 0:
        return "orphan"
    if ind == 0 and outd > 0:
        return "entry"
    if ind >= 4:
        return "hub"
    if ind >= 2:
        return "shared"
    return "leaf"


def blast_radius_bfs(node_id: str, edges: list[dict], depth: int = 5) -> set[str]:
    """
    Which files would break if node_id was deleted/changed?
    Traverses the dependency graph backwards (who depends on me transitively).
    """
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


# ─────────────────────────────────────────────────────────────────────────────
# LLM — Groq free tier
# ─────────────────────────────────────────────────────────────────────────────

async def groq(system: str, user: str, max_tokens: int = 800, json_mode: bool = False) -> str:
    """
    Call Groq API (free tier).
    Model: llama-3.3-70b-versatile
    Free limits: 14,400 req/day, 30 req/min, 6000 tokens/min
    Sign up at console.groq.com — no credit card needed.
    """
    if not GROQ_API_KEY:
        return "GROQ_API_KEY not set. Get your free key at console.groq.com"

    payload: dict = {
        "model": "llama-3.3-70b-versatile",
        "max_tokens": max_tokens,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": 0.1,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    try:
        async with httpx.AsyncClient(timeout=25) as client:
            r = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
        if r.status_code == 429:
            return "Rate limited by Groq. Try again in a moment."
        if r.status_code != 200:
            return f"Groq error {r.status_code}: {r.text[:200]}"
        return r.json()["choices"][0]["message"]["content"]
    except Exception as ex:
        return f"LLM request failed: {str(ex)}"


def safe_json_parse(text: str) -> dict:
    """Parse JSON from LLM output, stripping markdown fences if present."""
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```\w*\n?", "", text)
        text = re.sub(r"\n?```$", "", text.strip())
    try:
        return json.loads(text)
    except Exception:
        return {}


# ─────────────────────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {"status": "RepoGami API v1", "docs": "/docs"}


@app.post("/analyze")
async def analyze(req: AnalyzeRequest):
    owner, repo = parse_github_url(req.repo_url)

    # ── 1. Fetch file tree (single API call, no cloning) ─────────────────
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

    # ── 2. Filter files ───────────────────────────────────────────────────
    files = [
        item for item in all_items
        if item["type"] == "blob" and not should_skip(item["path"])
    ]

    # Cap: prioritize source files
    source_files = [f for f in files if file_ext(f["path"]) in PARSEABLE_EXT]
    config_files = [f for f in files if is_config(f["path"])]
    other_files  = [f for f in files if f not in source_files and f not in config_files]

    # Keep up to 300 source, 50 config, 50 other
    files = source_files[:300] + config_files[:50] + other_files[:50]

    all_paths = {f["path"] for f in files}

    # ── 3. Fetch file contents for dep parsing (concurrent, capped) ───────
    to_fetch = [f for f in files if file_ext(f["path"]) in PARSEABLE_EXT][:100]
    contents: dict[str, str] = {}

    async def fetch_file(path: str, client: httpx.AsyncClient):
        try:
            r = await client.get(
                f"https://raw.githubusercontent.com/{owner}/{repo}/HEAD/{path}",
                headers=gh_headers(),
            )
            if r.status_code == 200:
                contents[path] = r.text[:8000]  # cap per file
        except Exception:
            pass

    async with httpx.AsyncClient(timeout=30) as client:
        # Batch into groups of 20 to avoid overwhelming GitHub
        for i in range(0, len(to_fetch), 20):
            batch = to_fetch[i:i+20]
            await asyncio.gather(*[fetch_file(f["path"], client) for f in batch])
            if i + 20 < len(to_fetch):
                await asyncio.sleep(0.1)  # small pause between batches

    # ── 4. Extract dependency edges ────────────────────────────────────────
    edges: list[dict] = []
    for path, content in contents.items():
        edges.extend(extract_deps(content, path, all_paths))

    # Deduplicate
    seen_e: set[tuple] = set()
    unique_edges = []
    for e in edges:
        k = (e["source"], e["target"])
        if k not in seen_e:
            seen_e.add(k)
            unique_edges.append(e)
    edges = unique_edges

    # ── 5. Compute graph metrics ───────────────────────────────────────────
    metrics = compute_metrics(files, edges)
    ind = metrics["indegree"]
    outd = metrics["outdegree"]
    deps_of = metrics["dependencies"]
    dependents_of = metrics["dependents"]

    # ── 6. Build enriched node list ────────────────────────────────────────
    # Build directory tree structure for file tree panel
    dir_tree: dict = {}
    for f in files:
        parts = f["path"].split("/")
        node = dir_tree
        for part in parts[:-1]:
            node = node.setdefault(part, {})
        node[parts[-1]] = None  # leaf file

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
            # Derived flags for UI
            "is_orphan": role == "orphan",
            "is_entry":  role == "entry",
            "is_hub":    role == "hub",
            "is_config": config,
        })

    # ── 7. AI summary (Groq) ───────────────────────────────────────────────
    # Collect representative content for the LLM
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
                    f"=== {item['path']} ===\n{contents[item['path']][:1000]}"
                )
                break

    # Entry points content
    entry_nodes = [n for n in nodes if n["is_entry"]][:3]
    for n in entry_nodes:
        if n["path"] in contents and n["path"] not in [k.split("===")[1].strip() for k in key_content_parts]:
            key_content_parts.append(
                f"=== {n['path']} (entry point) ===\n{contents[n['path']][:600]}"
            )

    file_list = "\n".join(f["path"] for f in files[:120])
    key_content = "\n\n".join(key_content_parts[:6])

    summary_raw = await groq(
        system="You are a senior software architect. Analyze codebases. Return only valid JSON.",
        user=f"""Analyze: {owner}/{repo}
Files ({len(files)} total, first 120):
{file_list}

Key file contents:
{key_content}

Return ONLY a JSON object (no markdown, no preamble):
{{
  "project_name": "string",
  "tagline": "one sentence, what this does",
  "description": "2-3 sentences, what the project does and for whom",
  "tech_stack": ["primary", "technologies"],
  "architecture": "e.g. REST API, monorepo, microservices, CLI tool, library",
  "entry_points": ["main files where execution begins"],
  "key_modules": ["3-5 most important directories or modules with 1-line description each, format: path: description"],
  "complexity": "low | medium | high",
  "insights": [
    "one specific observation about this codebase structure",
    "one potential issue or area for improvement",
    "one thing this project does unusually well or unusually"
  ]
}}""",
        max_tokens=700,
        json_mode=True,
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

    # ── 8. Stats ───────────────────────────────────────────────────────────
    lang_counts: dict[str, int] = defaultdict(int)
    role_counts: dict[str, int] = defaultdict(int)
    for n in nodes:
        lang_counts[n["language"]] += 1
        role_counts[n["role"]] += 1

    top_hubs = sorted(
        [n for n in nodes if n["is_hub"]],
        key=lambda n: n["indegree"],
        reverse=True,
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

    return {
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


@app.post("/ask")
async def ask(req: AskRequest):
    """Ask the AI anything about a specific file in the context of the codebase."""
    owner, repo = parse_github_url(req.repo_url)

    # Fetch the actual file content
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(
            f"https://raw.githubusercontent.com/{owner}/{repo}/HEAD/{req.file_path}",
            headers=gh_headers(),
        )
    file_content = r.text[:4000] if r.status_code == 200 else "[Content unavailable]"

    # Build context from subgraph
    imports = [e["target"] for e in req.subgraph if e.get("source") == req.file_path]
    imported_by = [e["source"] for e in req.subgraph if e.get("target") == req.file_path]

    answer = await groq(
        system="""You are an expert software engineer doing codebase navigation and analysis.
You're given a specific file and its relationship to other files in the codebase.
Be direct, technical, and specific. Reference actual code when relevant.
If asked about blast radius / what would break, reason through the dependency chain.
Format your answer with clear paragraphs. Use code blocks for code snippets.""",
        user=f"""Repository file: {req.file_path}

This file imports: {imports if imports else ['nothing (leaf or entry point)']}
Imported by: {imported_by if imported_by else ['nothing — this is an orphan or entry point']}

File content:
```
{file_content}
```

Question: {req.question}""",
        max_tokens=600,
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
    """
    Compute which files would break if the given node was deleted/changed.
    Returns the set of affected file IDs at each depth level.
    """
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
    languages: dict  # {lang: count}
    file_tree_summary: str  # first 100 file paths, condensed


@app.post("/generate-readme")
async def generate_readme(req: ReadmeRequest):
    """
    Generate a professional README.md for the analysed repository.
    Expects the summary data that already exists on the frontend.
    """
    # Build a rich prompt
    tech_stack_str = ", ".join(req.tech_stack) if req.tech_stack else "not detected"
    lang_summary = ", ".join(f"{lang} ({count} files)" for lang, count in req.languages.items() if count > 0)
    key_modules_str = "\n".join(f"- {m}" for m in req.key_modules) if req.key_modules else "- None detected"
    insights_str = "\n".join(f"- {ins}" for ins in req.insights) if req.insights else "- None"
    entry_str = ", ".join(req.entry_points[:5]) if req.entry_points else "not detected"

    prompt = f"""You are an expert technical writer. Create a **professional README.md** for the following project.

PROJECT DETAILS:
- Name: {req.project_name}
- Tagline: {req.tagline}
- Description: {req.description}
- Architecture: {req.architecture}
- Tech Stack: {tech_stack_str}
- Primary languages: {lang_summary}
- Entry points: {entry_str}
- Total files: {req.total_files}
- Dependency edges: {req.total_edges}
- Key modules:
{key_modules_str}
- AI insights:
{insights_str}
- File tree (first 100):
{req.file_tree_summary}

REQUIREMENTS:
1. Use proper Markdown (headings, badges, code blocks, tables where helpful).
2. Add relevant badges (build, license, stars, language, etc.) — use shield.io style if possible.
3. Include sections: Overview, Features, Tech Stack, Getting Started, Architecture, Project Structure, Usage, Contributing, License.
4. The "Getting Started" section must include realistic installation and running instructions based on the tech stack (use npm/pip/cargo etc.).
5. Make it visually appealing with a logo placeholder (use `<p align="center">` for centering).
6. Do NOT mention RepoGami or this generation.
7. Output ONLY the raw Markdown. No surrounding text, no explanation."""

    readme_md = await groq(
        system="You write world-class README files for open-source projects. Be precise and beautiful.",
        user=prompt,
        max_tokens=1200,
    )

    return {"readme": readme_md}