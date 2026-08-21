# Procurement Agent Platform

Composable procurement agents + eval harness, inspired by Zip's engineering posts
("the instructions are not the point" / "vibes don't ship"). Portfolio demo with
Claude tool-use via Bedrock Lambda, Moorcheh retrieval, SQLite persistence, and
a GraphQL/React UI.

## Architecture

- **Recipes** (`backend/recipes/*.json`) configure agents — the engine never branches on recipe name.
- **Engine** — Claude tool loop (max 3) through Bedrock Lambda → synthesis → persist trace.
- **Tools** — `document_retrieval` (Moorcheh), `api_data` (read-only SQL).
- **Eval** — `golden_set` → run recipe → score → `eval_scores`; correction closes the loop.

### Recipes

1. `duplicate_vendor_check` — policy: same domain + similar name → `block`; similar name **or** shared domain → `merge_review`; else `allow`.
2. `msa_risk_review` — retrieve contract text, flag liability / indemnity / renewal / privacy risks.

## Prerequisites

- Python 3.11+
- Node 20+
- Deployed Bedrock Anthropic Lambda Function URL (see `backend/aws`)
- Moorcheh on-prem at `http://localhost:8080` (you start it; app only calls the API)

## Setup

```bash
# 1. Env
cp .env.example .env
# set BEDROCK_LAMBDA_URL from: cd backend/aws && npx cdk deploy

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
4. Run evals (UI button or `python scripts/run_evals.py`); refresh the Evals page.
5. Correct a run in the UI (or CLI); re-run evals and show the new golden row scoring.

## Tests

```bash
cd backend
pytest -q
```

## LLM path (Bedrock Lambda)

The app calls Claude through your Lambda Function URL (`BEDROCK_LAMBDA_URL`), which
streams from Amazon Bedrock. CDK stack: [`backend/aws`](backend/aws).
No Anthropic API key is required for the agent/judge path.
