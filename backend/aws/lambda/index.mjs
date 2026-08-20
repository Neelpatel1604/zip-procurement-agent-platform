/**
 * Lambda Function URL handler — streams Anthropic Claude from Amazon Bedrock.
 *
 * Uses awslambda.streamifyResponse (Node.js managed runtime) +
 * Bedrock InvokeModelWithResponseStream (Anthropic Messages API body).
 *
 * POST JSON body (Anthropic-shaped, so the Python app can swap later):
 * {
 *   "messages": [{ "role": "user", "content": "..." }],
 *   "system": "optional system prompt",
 *   "max_tokens": 4096,
 *   "temperature": 0.2,
 *   "tools": [],                 // optional Anthropic tool schemas
 *   "model": "optional override", // else BEDROCK_MODEL_ID
 *   "stream": true               // default true for Function URL
 * }
 *
 * Response: text/event-stream (SSE-ish)
 *   data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"..."}}
 *   data: {"type":"message_stop"}
 *   data: [DONE]
 */

import {
  BedrockRuntimeClient,
  InvokeModelWithResponseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";

const region = process.env.BEDROCK_REGION || process.env.AWS_REGION || "us-east-1";
const defaultModelId =
  process.env.BEDROCK_MODEL_ID || "us.anthropic.claude-sonnet-4-20250514-v1:0";

const bedrock = new BedrockRuntimeClient({ region });

function parseBody(event) {
  if (!event?.body) return {};
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : event.body;
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

function writeSse(stream, payload) {
  const line =
    typeof payload === "string" ? payload : `data: ${JSON.stringify(payload)}\n\n`;
  stream.write(line);
}

function buildAnthropicBedrockBody(req) {
  const messages = req.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('Request must include non-empty "messages" array');
  }

  const body = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: Number(req.max_tokens ?? 4096),
    messages,
  };

  if (req.system) body.system = req.system;
  if (req.temperature != null) body.temperature = Number(req.temperature);
  if (req.top_p != null) body.top_p = Number(req.top_p);
  if (Array.isArray(req.tools) && req.tools.length > 0) body.tools = req.tools;
  if (req.tool_choice) body.tool_choice = req.tool_choice;
  if (Array.isArray(req.stop_sequences)) body.stop_sequences = req.stop_sequences;

  return body;
}

export const handler = awslambda.streamifyResponse(
  async (event, responseStream, _context) => {
    const method = event.requestContext?.http?.method || event.httpMethod || "POST";

    // CORS preflight (Function URL may still hit the handler)
    if (method === "OPTIONS") {
      const meta = {
        statusCode: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "*",
        },
      };
      const stream = awslambda.HttpResponseStream.from(responseStream, meta);
      stream.end();
      return;
    }

    let httpStream;
    try {
      const req = parseBody(event);
      const modelId = req.model || defaultModelId;
      const anthropicBody = buildAnthropicBedrockBody(req);

      httpStream = awslambda.HttpResponseStream.from(responseStream, {
        statusCode: 200,
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "Access-Control-Allow-Origin": "*",
          "X-Bedrock-Model-Id": modelId,
        },
      });

      const command = new InvokeModelWithResponseStreamCommand({
        modelId,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify(anthropicBody),
      });

      const response = await bedrock.send(command);

      for await (const eventChunk of response.body) {
        if (!eventChunk.chunk?.bytes) continue;
        const decoded = JSON.parse(
          new TextDecoder().decode(eventChunk.chunk.bytes),
        );

        // Bedrock Anthropic stream events mirror Anthropic's streaming event types
        // (message_start, content_block_delta, message_delta, message_stop, ...)
        writeSse(httpStream, decoded);

        // Also emit plain text deltas for simple clients
        if (
          decoded.type === "content_block_delta" &&
          decoded.delta?.type === "text_delta" &&
          decoded.delta?.text
        ) {
          writeSse(httpStream, {
            type: "text",
            text: decoded.delta.text,
          });
        }
      }

      writeSse(httpStream, "[DONE]");
      httpStream.end();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Bedrock stream error:", err);

      if (!httpStream) {
        httpStream = awslambda.HttpResponseStream.from(responseStream, {
          statusCode: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
        httpStream.write(JSON.stringify({ error: message }));
        httpStream.end();
        return;
      }

      writeSse(httpStream, { type: "error", error: message });
      httpStream.end();
    }
  },
);
