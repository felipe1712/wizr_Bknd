/**
 * Shared helper to call Anthropic Claude Sonnet 4.5 from Edge Functions.
 *
 * Two modes:
 *   1) callClaudeText   — free-form text completion (returns string)
 *   2) callClaudeTool   — structured output via Anthropic tool-use (returns parsed JSON)
 *
 * Both use claude-sonnet-4-5 with low temperature for consistency between iterations.
 *
 * Throws Error with code "RATE_LIMIT" on 429 and "PAYMENT_REQUIRED" on 402
 * so callers can map to proper HTTP status codes.
 */

const CLAUDE_MODEL = "claude-sonnet-4-5-20250929";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

export interface ClaudeTextOptions {
  apiKey: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

export interface ClaudeToolOptions {
  apiKey: string;
  systemPrompt: string;
  userPrompt: string;
  toolName: string;
  toolDescription?: string;
  toolSchema: Record<string, unknown>;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

interface AnthropicResponseBlock {
  type: string;
  text?: string;
  name?: string;
  input?: Record<string, unknown>;
}

interface AnthropicResponse {
  content?: AnthropicResponseBlock[];
  stop_reason?: string;
  error?: { message?: string };
}

/**
 * Strip lone UTF-16 surrogates from a JSON string. JSON.stringify in V8/Deno
 * emits lone surrogates as literal `\uD8XX` escape sequences (6-char text), so
 * we must scrub the escape sequences themselves — not raw UTF-16 code units.
 * Anthropic's parser rejects unpaired surrogates with "no low surrogate in string".
 */
function sanitizeJsonString(s: string): string {
  // Replace high surrogate escape NOT followed by a low surrogate escape
  s = s.replace(/\\u([dD][89aAbB][0-9a-fA-F]{2})(?!\\u[dD][c-fC-F][0-9a-fA-F]{2})/g, "\\uFFFD");
  // Replace low surrogate escape NOT preceded by a high surrogate escape
  s = s.replace(/(?<!\\u[dD][89aAbB][0-9a-fA-F]{2})\\u([dD][c-fC-F][0-9a-fA-F]{2})/g, "\\uFFFD");
  // Also scrub any raw lone UTF-16 surrogates just in case
  s = s.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "\uFFFD");
  return s;
}

async function callAnthropic(
  apiKey: string,
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<AnthropicResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: sanitizeJsonString(JSON.stringify(body)),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Anthropic API error:", response.status, errorText.slice(0, 500));
      if (response.status === 429) throw new Error("RATE_LIMIT");
      if (response.status === 402 || response.status === 403) throw new Error("PAYMENT_REQUIRED");
      throw new Error(`Anthropic API error ${response.status}: ${errorText.slice(0, 200)}`);
    }

    return await response.json() as AnthropicResponse;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Free-form text completion with Claude.
 * Returns the concatenated text content from the response.
 */
export async function callClaudeText(opts: ClaudeTextOptions): Promise<string> {
  const data = await callAnthropic(
    opts.apiKey,
    {
      model: CLAUDE_MODEL,
      max_tokens: opts.maxTokens ?? 4000,
      temperature: opts.temperature ?? 0.2,
      system: opts.systemPrompt,
      messages: [{ role: "user", content: opts.userPrompt }],
    },
    opts.timeoutMs ?? 90000,
  );

  const text = (data.content || [])
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("\n")
    .trim();

  if (!text) throw new Error("Claude returned empty text response");
  return text;
}

/**
 * Structured output via Anthropic tool-use. Forces Claude to call the named tool
 * and returns the parsed input object.
 */
export async function callClaudeTool<T = Record<string, unknown>>(
  opts: ClaudeToolOptions,
): Promise<T> {
  const data = await callAnthropic(
    opts.apiKey,
    {
      model: CLAUDE_MODEL,
      max_tokens: opts.maxTokens ?? 4000,
      temperature: opts.temperature ?? 0.2,
      system: opts.systemPrompt,
      messages: [{ role: "user", content: opts.userPrompt }],
      tools: [
        {
          name: opts.toolName,
          description: opts.toolDescription ?? `Return structured ${opts.toolName} result`,
          input_schema: opts.toolSchema,
        },
      ],
      tool_choice: { type: "tool", name: opts.toolName },
    },
    opts.timeoutMs ?? 90000,
  );

  const toolBlock = (data.content || []).find(
    (b) => b.type === "tool_use" && b.name === opts.toolName && b.input,
  );

  if (!toolBlock || !toolBlock.input) {
    console.error("Claude did not return expected tool_use block:", JSON.stringify(data).slice(0, 500));
    throw new Error("Invalid Claude response: missing tool_use block");
  }

  return toolBlock.input as T;
}
