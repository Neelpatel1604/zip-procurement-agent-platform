# Procurement Agent Platform

Composable procurement agents + eval harness, inspired by Zip's engineering posts
("the instructions are not the point" / "vibes don't ship"). Portfolio demo with
**real** Claude tool-use, Moorcheh retrieval, SQLite persistence, and GraphQL/React UI.

## What's synthetic vs real

| Synthetic (mocked content only) | Real code paths |
|---|---|
| Vendor/contract seed rows | Claude native tool-use orchestration |
| Markdown MSA/DPA/NDA templates under `backend/data/documents/` | Moorcheh semantic search via `RetrievalBackend` |
| | SQLAlchemy queries via `api_data` |
| | Full traces in `agent_runs` |
| | Deterministic + LLM-as-judge evals + correction → `golden_set` |

## Architecture

- **Recipes** (`backend/recipes/*.json`) configure agents — the engine never branches on recipe name.
- **Engine** — preprocess → Claude tool loop (max 3) → synthesis → persist trace.
- **Tools** — `document_retrieval` (Moorcheh), `api_data` (read-only SQL).
- **Eval** — `golden_set` → run recipe → score → `eval_scores`; `correct.py` closes the loop.

### Recipes

1. `duplicate_vendor_check` — policy: same domain + similar name → `block`; similar name **or** shared domain → `merge_review`; else `allow`.
2. `msa_risk_review` — retrieve contract text, flag liability / indemnity / renewal / privacy risks.

## Prerequisites

- Python 3.11+
- Node 20+
- Anthropic API key
- Moorcheh on-prem running at `http://localhost:8080` (you start it; app only calls the API)

## Setup

```bash
# 1. Env
cp .env.example .env
# edit ANTHROPIC_API_KEY

# 2. Backend
cd backend
python -m pip install -r requirements.txt
python scripts/seed.py
python scripts/ingest.py          # requires Moorcheh up

# 3. API
uvicorn app.main:app --reload --app-dir .

# 4. Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 — GraphQL playground at http://localhost:8000/graphql

## CLI demos

```bash
cd backend

python scripts/run_agent.py --recipe duplicate_vendor_check \
  --input "New vendor: Acme Corp LLC / acme.com"

python scripts/run_agent.py --recipe msa_risk_review \
  --input "Review MSA risk for CloudSync Analytics liability and auto-renewal"

python scripts/run_evals.py
python scripts/correct.py --run-id 1 --corrected-output '{"recommendation":"block"}'
```

## Demo walkthrough (5–7 min)

1. Show two recipe JSON files — same engine fields, different prompts/tools.
2. Run Duplicate Vendor Check in the UI; expand the tool-call trace.
3. Run MSA Risk Review; show retrieval hits grounding the risks.
4. Run `python scripts/run_evals.py`; refresh Evals page for real scores.
5. Correct a run in the UI (or CLI); re-run evals and show the new golden row scoring.

## Tests

```bash
cd backend
pytest -q
```

## Note on judge model

Agent uses Sonnet; judge uses Haiku (cost). Ideally the judge would be a different model family to reduce self-preference bias — called out intentionally.

## AWS Bedrock Lambda (optional, not wired yet)

Streaming Anthropic-on-Bedrock via Lambda Function URL lives under
[`backend/aws`](backend/aws). The app still uses `ANTHROPIC_API_KEY` directly;
deploy the CDK stack when you want the Function URL ready to swap in later.
See [`backend/aws/README.md`](backend/aws/README.md).
