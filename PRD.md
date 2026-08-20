# PRD: Composable Procurement Agent Platform + Eval Harness
**A demo project inspired by Zip's engineering blog, built with real (non-mocked) components**

Owner: Neelkumar patel
Github: https://github.com/Neelpatel1604
Status: Draft v1
Target: Personal portfolio project for Zip SWE Intern application
Date: 2026-08-20

---

## 1. Background & Motivation

Zip's engineering blog describes two ideas central to how they build AI agents in
production:

1. **"The instructions are not the point"** — a composable agent platform where
   every procurement agent (Duplicate Vendor Check, Renewal Assist, MSA Risk
   Review, etc.) runs on one shared execution engine, differing only by a
   "recipe" — configuration, not code.
2. **"Vibes Don't Ship"** — a rigorous eval methodology: deterministic checks
   where there's a right answer, LLM-as-judge rubric grading against the full
   execution trace where there isn't, and a closed loop where every real
   failure becomes a permanent new golden test case.

This project reimplements both ideas at small scale, with **real components
throughout the pipeline** (real tool-calling, real retrieval, real persistence,
real grading) rather than hardcoded/scripted stand-ins. Content data (contracts,
vendor records) is synthetic or public-template-sourced, but every code path
that processes it is genuine.

## 2. Goals

- Demonstrate genuine understanding of Zip's published architecture, not a
  surface-level clone
- Produce something that survives follow-up technical questions in an interview
  ("what happens if the model calls the wrong tool?" should have a real answer)
- Use Zip's actual stated stack (Python, TypeScript, React, GraphQL)
- Be finishable and demo-able solo within roughly one focused week

## 3. Non-Goals (explicitly out of scope)

- Production-grade auth, multi-tenancy, or real customer data
- A polished/branded UI — functional and clean is enough
- Full parity with Zip's real system (50+ agents, enterprise governance, SSO,
  audit trails) — this is intentionally a scaled-down proof of architecture
- Real vendor/contract data — synthetic or public-template sourced only, clearly disclosed

## 4. Success Criteria

The project is "done enough" when you can, live and unscripted:
1. Submit a request to **two different agent recipes** and show the same
   underlying engine producing correctly different behavior
2. Show a real trace of the model choosing which tool to call and why
3. Run the eval suite and get **real, non-deterministic scores** from an LLM judge
4. Trigger the correction flow and show a new row landing in the real golden set
5. Answer "what's mocked here?" with an honest, short list (ideally just: the
   source documents/records are synthetic; everything else is real)

## 5. Users / Audience

Primary: a Zip engineer or hiring manager watching a 5–7 min video walkthrough.
Design decisions should optimize for **legibility under scrutiny**, not for
end-user polish.

## 6. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Backend language | Python 3.11 | Matches JD; matches their actual backend language |
| API framework | FastAPI | Fast to stand up, async-friendly for LLM/tool calls |
| API layer | GraphQL via **Strawberry** | Explicitly named in the JD; Strawberry has clean typed Python integration |
| LLM | **Anthropic Claude** (Sonnet) via official Python SDK, using real tool-use/function-calling | Zip is an Anthropic customer; using their real tool-calling API (not manual if/else) is the crux of "real, not mocked" orchestration |
| Embeddings | **nomic-embed-text via Ollama**, managed internally by Moorcheh on-prem (`moorcheh up --embedding-provider ollama --embedding-model nomic-embed-text`) | Fully local, zero API keys; using Moorcheh's own documented on-prem path avoids embedding-version mismatches between ingest and query time that a separate embedding step could introduce |
| Vector store | **Moorcheh** (on-prem, self-hosted via Docker) | Deterministic, exact-match semantic search (information-theoretic binarization instead of approximate HNSW/cosine similarity) — thematically ties to the project's determinism-in-eval story. Accessed behind a thin `RetrievalBackend` interface so it can be swapped for Chroma with no changes to the agent engine if on-prem setup causes delays |
| Relational data | **SQLite** via **SQLAlchemy** | Real schema, real queries, zero setup cost; upgrade path to Postgres if needed |
| Frontend | **React + TypeScript + Vite** | Matches JD stack exactly |
| GraphQL client | **Apollo Client** | Standard pairing with Strawberry/GraphQL backend |
| Styling | Tailwind CSS | Fast, clean, no design system needed |
| Eval scripting | Plain Python + SQLite | No extra framework needed; keep it inspectable |
| Testing | pytest (basic unit tests on tools/nodes) | Shows engineering hygiene, not just a demo script |

**Single-vendor LLM note:** using Anthropic for both generation and judging
keeps you to one API key and one bill. Flag in the video that ideally the judge
would be a different model family to avoid self-preference bias — mentioning
this shows awareness even though you're not fully solving it.

## 7. System Architecture

```
                     ┌─────────────────────────┐
   Request  ───────▶ │      GraphQL API         │
                     │   (FastAPI + Strawberry)  │
                     └────────────┬─────────────┘
                                  │
                     ┌────────────▼─────────────┐
                     │   Agent Engine (per recipe)│
                     │                             │
                     │  1. Preprocessing           │
                     │  2. Orchestration (ReAct)   │──▶ Tool: document_retrieval (Moorcheh, on-prem)
                     │     [real Claude tool-use]  │──▶ Tool: api_data (SQLite via SQLAlchemy)
                     │  3. Final synthesis call    │
                     │  4. Post-processing         │
                     └────────────┬─────────────┘
                                  │
                     ┌────────────▼─────────────┐
                     │   Persistence (SQLite)     │
                     │  agent_runs, golden_set,    │
                     │  eval_scores                │
                     └────────────┬─────────────┘
                                  │
                     ┌────────────▼─────────────┐
                     │   Eval Harness (Python)    │
                     │  deterministic checks +     │
                     │  Claude-as-judge (rubric,   │
                     │  reads full trace)          │
                     └─────────────────────────────┘

                     ┌─────────────────────────┐
                     │  React + TS Frontend       │
                     │  Request form, trace view,  │
                     │  eval dashboard             │
                     └─────────────────────────────┘
```

## 8. Data Model

```sql
-- Recipes (loaded from JSON files, mirrored here for querying/history)
CREATE TABLE recipes (
  id TEXT PRIMARY KEY,
  name TEXT,
  model TEXT,
  tools TEXT,            -- JSON array
  output_format TEXT,
  system_prompt TEXT
);

-- Mock-but-real relational domain data
CREATE TABLE vendors (
  id INTEGER PRIMARY KEY,
  name TEXT,
  domain TEXT,
  category TEXT
);

CREATE TABLE contracts (
  id INTEGER PRIMARY KEY,
  vendor_id INTEGER REFERENCES vendors(id),
  file_path TEXT,         -- points to real doc, chunked+embedded in Chroma
  effective_date DATE,
  renewal_date DATE,
  terms_summary TEXT
);

-- Execution history
CREATE TABLE agent_runs (
  id INTEGER PRIMARY KEY,
  recipe_id TEXT REFERENCES recipes(id),
  input_text TEXT,
  trace_json TEXT,        -- full tool-call trace
  output_text TEXT,
  created_at TIMESTAMP
);

-- Eval infrastructure
CREATE TABLE golden_set (
  id INTEGER PRIMARY KEY,
  recipe_id TEXT REFERENCES recipes(id),
  input_text TEXT,
  rubric TEXT,
  expected_answer TEXT,   -- nullable, only for deterministic cases
  source TEXT             -- 'hand_written' | 'correction'
);

CREATE TABLE eval_scores (
  id INTEGER PRIMARY KEY,
  golden_set_id INTEGER REFERENCES golden_set(id),
  run_id INTEGER REFERENCES agent_runs(id),
  score REAL,
  reasoning TEXT,
  metric_breakdown TEXT,  -- JSON
  created_at TIMESTAMP
);
```

## 9. Functional Requirements

### FR1 — Recipe-driven engine
The engine must run any recipe (agent) without code changes — adding a new
agent means adding a new JSON file and, if new tools are needed, a new tool
class. No branching on agent name anywhere in the engine code.

### FR2 — Real tool-calling
Orchestration must use Claude's native tool-use API. The model receives real
tool schemas and genuinely decides which to call, with what arguments, and
when to stop (capped at 3 iterations to bound cost/time).

### FR3 — Real retrieval
`document_retrieval` must perform real embedding + real semantic search over
real chunked documents stored in a self-hosted, on-prem Moorcheh instance
(Docker), with Moorcheh configured to embed via Ollama's `nomic-embed-text`
model internally — not string matching or canned responses, and not a
separately-run embedding step feeding vectors in. Access Moorcheh through a
small `RetrievalBackend` interface (`ingest()`, `query()`) rather than calling
the SDK directly from the engine, so the backend can be swapped (e.g. to
Chroma, configured with the same nomic-embed-text Ollama model as its
embedding function) without touching orchestration code if setup issues eat
into the build timeline.

### FR4 — Real structured data access
`api_data` must run real SQL queries against the SQLite schema above via
SQLAlchemy — not an in-memory dict.

### FR5 — Trace capture
Every run must persist its full trace (tool calls, arguments, raw + summarized
results, final output) to `agent_runs`, viewable in the frontend.

### FR6 — Eval harness
`run_evals.py` must, for each `golden_set` row: run the recipe, apply
deterministic check if `expected_answer` is set, else call Claude as judge with
the rubric + full trace, and persist the result to `eval_scores`.

### FR7 — Closing the loop
A CLI command (`correct.py`) must accept a run ID and a corrected output, and
insert a new row into `golden_set` with `source = 'correction'`. The next eval
run must pick it up automatically via the real DB query — no manual list editing.

### FR8 — Frontend
- Request submission form
- Trace view (step-by-step tool calls + reasoning)
- Simple eval dashboard: latest scores per recipe, trend over time (real, from
  accumulated `eval_scores` rows)

## 10. Non-Functional Requirements

- **Cost control:** cap orchestration loop iterations; use a smaller/cheaper
  Claude model for judge calls if cost becomes an issue during dev
- **Local-first:** entire system should run with `docker-compose up` or
  equivalent, no cloud dependency required except the Anthropic API
- **Transparency:** README must clearly state what's synthetic (documents,
  vendor records) vs. real (every code path)

## 11. Milestones

| Phase | Deliverable | Est. time |
|---|---|---|
| 1 | SQLite schema + seed data (synthetic vendors/contracts) + doc corpus sourced | 0.5 day |
| 2 | Chroma ingestion pipeline (chunk + embed + store) working standalone | 0.5–1 day |
| 3 | Agent engine: preprocessing + real tool-use orchestration + synthesis, one recipe, tested via script (no API yet) | 1–1.5 days |
| 4 | GraphQL API wrapping the engine | 0.5 day |
| 5 | React frontend: request form + trace view | 1 day |
| 6 | Second recipe added (proves composability) | 0.5 day |
| 7 | Eval harness: golden set + deterministic + judge scoring | 1 day |
| 8 | Correction loop (FR7) + eval dashboard in frontend | 0.5–1 day |
| 9 | README, video script, recording | 0.5 day |

**Total: ~6–8 focused days.** If time-constrained, Phases 1–4 + 7 (skip full
frontend polish, demo via API/CLI) still deliver a credible, real, non-mocked story.

## 12. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Model doesn't call tools as expected | Log every trace; a "the eval harness caught this failure mode" moment is actually good material for the video |
| Runs out of time before frontend is polished | CLI + GraphQL playground demo is acceptable; prioritize FR1–FR7 over FR8 polish |
| LLM API costs during iterative dev | Use prompt caching where possible, cap iterations, use cheaper model for early dev loops |
| Judge scores feel arbitrary | Do the small human-vs-judge calibration check from the earlier eval discussion, even for 2-3 cases |
| Moorcheh (early-stage, self-hosted) causes on-prem setup friction or downtime mid-build | Retrieval sits behind the `RetrievalBackend` interface (FR3) from day one; if Docker setup stalls beyond ~half a day, swap in Chroma with the same interface and note the substitution honestly in the README/video rather than losing build time |

## 13. Open Questions (resolve before/while building)
- Public contract templates to source: which specific published DPA/MSA/NDA templates will you use as seed documents?
- Exact wording of your 2 chosen recipes' rubrics — draft these early since they shape what "good" means for grading

## 14. Appendix: Claude Code Kickoff Prompt

> Scaffold a Python backend using FastAPI + Strawberry GraphQL, SQLAlchemy +
> SQLite, and the Moorcheh Python SDK, per the schema and architecture in this
> PRD [paste PRD]. Start with: SQLAlchemy models matching Section 8, a seed
> script for synthetic vendors/contracts, a `RetrievalBackend` interface with
> `ingest()`/`query()` methods, and a Moorcheh implementation of it running
> against a local on-prem Moorcheh Docker instance started with
> `moorcheh up --embedding-provider ollama --embedding-model nomic-embed-text`,
> ingesting chunked local markdown documents. Then build the agent engine
> (Section 7) using the Anthropic Python SDK's native tool-use API for
> orchestration — real tool-calling through the RetrievalBackend interface,
> not manual branching. Cap the ReAct loop at 3 iterations. Persist every
> run's full trace to the agent_runs table.