import Anthropic from "@anthropic-ai/sdk";

// The ONLY file in this project that imports the Anthropic SDK or reads
// ANTHROPIC_API_KEY. Nothing else — routes, services, UI — should reach the
// provider except through generateStructuredCompletion() below.

// Overridable via env so a future model-id change is a config change, not a
// code change.
const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";
const REQUEST_TIMEOUT_MS = 60_000;

export class AiProviderError extends Error {
  retryable: boolean;
  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = "AiProviderError";
    this.retryable = retryable;
  }
}

function createClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AiProviderError('Missing required env var "ANTHROPIC_API_KEY".', false);
  }
  return new Anthropic({ apiKey, timeout: REQUEST_TIMEOUT_MS });
}

// Single request, no retry logic here — retry policy (which errors are
// worth retrying, and how many times) is a business decision that belongs
// to the caller (marketing-strategy-service), not this transport layer.
// This function either returns the model's raw text or throws AiProviderError
// with `retryable` set based on the failure category.
export async function generateStructuredCompletion(params: {
  system: string;
  prompt: string;
  maxTokens?: number;
}): Promise<string> {
  const client = createClient();

  let response;
  try {
    response = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
      max_tokens: params.maxTokens ?? 2048,
      system: params.system,
      messages: [{ role: "user", content: params.prompt }],
    });
  } catch (err) {
    const status = (err as { status?: number } | undefined)?.status;
    if (typeof status === "number") {
      // 429 (rate limit) and 5xx (provider-side) are worth retrying;
      // everything else (400 bad request, 401/403 auth, 404, etc.) is not.
      const retryable = status === 429 || status >= 500;
      throw new AiProviderError(`Anthropic API error (status ${status}).`, retryable);
    }
    // No status code usually means a network error or timeout — treat as
    // transient/retryable.
    throw new AiProviderError(
      err instanceof Error ? err.message : "Unknown Anthropic provider error.",
      true,
    );
  }

  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === "text",
  );
  if (!textBlock || textBlock.text.trim() === "") {
    // An empty response is unusual but not necessarily permanent — worth
    // one retry.
    throw new AiProviderError("Anthropic response contained no text content.", true);
  }

  return textBlock.text;
}
