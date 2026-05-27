<div align="center">

# Repogami

*Structural intelligence for any GitHub repo — paste a URL, see the gravity wells.*

[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![FastAPI](https://img.shields.io/badge/API-FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)](backend/main.py)
[![Next.js](https://img.shields.io/badge/UI-Next.js-000?style=flat-square&logo=next.js&logoColor=white)](frontend/)

</div>

---

<div align="center">
  <img src="https://res.cloudinary.com/dkbvknwcu/image/upload/v1779908725/first_jmr4lm.gif" alt="Repogami — paste a URL, watch the graph come alive" />
</div>

---

## Why actually open this

You are about to edit a file in a repo you did not build. The question is not "where is it defined?" — you can grep that. The question is:

**If I change this file, how much of the system moves with me?**

Repogami answers that in one session:

| Moment | What you get |
|--------|----------------|
| **Before the PR** | **Touch Index** — % of the graph in blast radius for the file under your cursor |
| **Before the refactor** | **Blast radius rings** + shareable `/blast` link for the team |
| **First day on the repo** | **Contributor Compass** — 5–7 files to read, in order (entry → spine → hub) |
| **Twitter / Slack** | **Repo DNA** — personality, health score, viral headline, one-click copy for socials |
| **Tech lead review** | **Vitals + Smell Radar + Refactor Playbook** — deterministic, no LLM hand-waving |

No indexer. No org setup. No "request demo." Public URL → live graph.

---

## What ships today

- **3D dependency graph** — force-directed, role-colored (hub, entry, orphan, leaf, config)
- **Touch Index** — instant ripple % per file (reverse import BFS)
- **Blast radius** — risk score, concentric rings, permanent `/blast?repo=…&file=…` links
- **Repo DNA** — Fortress / Gravity Well / Island Archipelago / Spaghetti / Ouroboros + share pack
- **Contributor Compass** — cold-start reading order from graph topology
- **Codebase Vitals** — 0–100 health, smell radar, refactor playbook (pure graph math)
- **Architecture diagram** — 2-pass LLM (explain → structured JSON graph)
- **Ask AI** — scoped to selected file + local subgraph
- **README generator** — repo-specific, shields.io-ready

---

## Social loop (built for impact)

1. Analyze `owner/repo` (try `vercel/next.js`, `trpc/trpc`, `shadcn-ui/ui`).
2. Open **Project** tab → **Share Pack** → copy tweet or DNA link.
3. Post: *"🕳️ vercel/next.js — Gravity Well. Health 61/100. God file: X (↑47 deps)"*
4. Teammates open `/dna?repo=owner/repo` or `/?url=owner/repo` — no account.

That is the growth mechanic: **shareable structural receipts**, not another dashboard.

### Before you post (launch checklist)

- [ ] Deploy frontend + backend with `NEXT_PUBLIC_API_URL` pointing at your API (not `localhost`).
- [ ] Set `GITHUB_TOKEN` so demos do not hit rate limits mid-thread.
- [ ] Run one **public** repo you know well; confirm **Share Pack** shows DNA + full URL in copied tweet.
- [ ] Open `/dna?repo=owner/repo` in an incognito window — card should load.
- [ ] Click **Explore graph** or share `/?url=owner/repo` — should auto-analyze on landing.
- [ ] Record a 30–45s screen capture: paste URL → graph spins up → click a hub → **Touch Index** → **Share Pack** copy.
- [ ] Pin the DNA link or main app URL in the thread; ask *"what's your repo's health score?"*

**Post angles that land:** roast your own repo · compare two OSS libs · "first 5 files to read" compass · hub file with highest Touch Index.

---

## Quick start

### Prerequisites

- Python 3.8+
- Node.js 18+
- Optional: `GITHUB_TOKEN` (5000 req/hr vs 60), `GROQ_API_KEY` (AI features — [console.groq.com](https://console.groq.com))

### Install

```bash
pip install -r backend/requirements.txt
npm install --prefix frontend
```

Create `.env` in project root (optional):

```env
GITHUB_TOKEN=ghp_...
GROQ_API_KEY=gsk_...
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Run

```bash
# Terminal 1 — API
uvicorn main:app --reload

# Terminal 2 — UI
npm run dev 
```

Open [http://localhost:3000](http://localhost:3000). Paste `owner/repo` or a full GitHub URL.

**Share routes:**

- Repo DNA card: `http://localhost:3000/dna?repo=owner/repo`
- Blast radius: `http://localhost:3000/blast?repo=owner/repo&file=path/to/file.ts`

---

## API (v3)

| Endpoint | Purpose |
|----------|---------|
| `POST /analyze` | Full graph + vitals + DNA + compass |
| `POST /blast-radius` | Deep blast for selected node |
| `POST /blast-share` | Shareable blast payload (cache) |
| `POST /repo-dna-share` | Shareable DNA card (cache) |
| `POST /ask` | File-scoped AI Q&A |
| `POST /generate-architecture` | Layered arch graph |
| `POST /generate-readme` | README.md draft |

---

## Architecture

<div align="center">
  <img src="https://github.com/DILIP-SHEESH/dump/blob/94083bb26232114ad9a90ae00e888aa3b1a3c9fa/last.gif" alt="Repogami — Architecture diagram" />
</div>

```
GitHub Trees API + raw file fetch
        ↓
Import graph (regex parsers: TS/JS, Python, Go, Rust, …)
        ↓
Graph intelligence (roles, vitals, DNA, compass, touch index)
        ↓
Groq (summaries, arch, ask, README only)
        ↓
Next.js — 3D graph, sidebar intelligence, share pages
```

Monorepo: `backend/main.py` + `frontend/` (Next.js App Router).

---

## Project structure

```
.
├── backend/
│   ├── main.py          # FastAPI — all analysis + AI routes
│   └── requirements.txt
├── frontend/
│   ├── app/             # page, blast, dna
│   ├── components/      # graph, sidebar, share pack
│   └── lib/touchIndex.ts
└── README.md
```

---

## Contributing

Fork → branch → PR. Keep graph intelligence deterministic where possible; reserve LLM for explanation and prose.

---

## License

MIT — see [LICENSE](LICENSE).
