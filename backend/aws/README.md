# Bedrock Anthropic Lambda (CDK)

Streams Anthropic Claude from **Amazon Bedrock** through a **Lambda Function URL**
with `RESPONSE_STREAM`. The Python agent still uses the Anthropic SDK + API key;
this stack is ready to wire later.

## Layout

```
backend/aws/
  bin/app.ts                      # CDK app entry
  lib/bedrock-anthropic-stack.ts  # Lambda + IAM + Function URL
  lambda/
    index.mjs                     # Bedrock streaming handler
    package.json
  package.json
  cdk.json
```

## Prerequisites

1. AWS CLI configured (`aws configure` or SSO)
2. Node.js 20+
3. Bedrock model access enabled in the target region for Anthropic Claude
   (Bedrock console → Model access)
4. CDK bootstrap once per account/region:
   `npx cdk bootstrap`

## Deploy

```bash
cd backend/aws
npm install

cd lambda
npm install
cd ..

npx cdk deploy
```

Optional model override:

```bash
npx cdk deploy -c modelId=us.anthropic.claude-sonnet-4-20250514-v1:0
```

Copy the stack output `BedrockAnthropicFunctionUrl`.

## Call the Function URL (stream)

```bash
curl -N -X POST "$FUNCTION_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role":"user","content":"Say hello in one sentence."}],
    "max_tokens": 256
  }'
```

Body shape is Anthropic Messages–compatible (`messages`, optional `system`, `tools`,
`temperature`, `max_tokens`, optional `model` override).

Streaming events are SSE lines (`data: {...}`) plus a final `data: [DONE]`.

## IAM granted to the Lambda

- `bedrock:InvokeModel`
- `bedrock:InvokeModelWithResponseStream`
- `bedrock:Converse`
- `bedrock:ConverseStream`

Resources: Anthropic foundation models + account inference profiles.

## Auth note

Function URL auth is currently `NONE` so you can test streaming without SigV4.
Tighten to `AWS_IAM` before any public/prod use.

## Do not change yet

App code under `backend/app/` still uses `ANTHROPIC_API_KEY` via the Anthropic
Python SDK. Point it at this URL in a later change.
