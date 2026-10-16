import { WEBHOOK_TIMEOUT_MS } from "./botWebhooks";

/**
 * The bot webhook POST — the second module in the app that touches the network,
 * beside `./brevo.ts`, and like it the only place its own kind of call is made.
 *
 * It never throws and never logs: the caller decides whether a failure is worth
 * another attempt, and the caller is the one who knows which parts of the
 * request (the secret in the headers) must stay out of the log.
 */

export type WebhookResult =
  | { ok: true; status: number }
  | {
      ok: false;
      /** `null` when no response arrived at all — network or timeout. */
      status: number | null;
      /** 429, 5xx and no response are worth repeating; any other 4xx is not. */
      retryable: boolean;
    };

export async function postWebhook(request: {
  url: string;
  headers: Record<string, string>;
  body: string;
}): Promise<WebhookResult> {
  try {
    const response = await fetch(request.url, {
      method: "POST",
      headers: request.headers,
      body: request.body,
      // A redirect would resend the secret to wherever the receiver points.
      redirect: "manual",
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    });
    // The body is never read: it is the receiver's, and nothing here uses it.
    await response.body?.cancel().catch(() => undefined);
    if (response.ok) {
      return { ok: true, status: response.status };
    }
    return {
      ok: false,
      status: response.status,
      retryable: response.status === 429 || response.status >= 500,
    };
  } catch {
    return { ok: false, status: null, retryable: true };
  }
}
