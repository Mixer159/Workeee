/**
 * The only place in the app that talks to the network.
 *
 * Brevo was chosen over Resend for one concrete reason: this deployment is
 * served from `workeee.vercel.app`, and a `*.vercel.app` host cannot be given
 * DNS records. Resend refuses to send anywhere but the account owner's own
 * address until a domain is verified, which makes it useless for a team.
 * Brevo verifies a **single sender address** by e-mailing it a link, so it
 * works with no domain at all — 300 messages a day on the free plan.
 *
 * The cost of that choice is honest and worth writing down: the free plan adds
 * a "Sent with Brevo" line to the footer, and a `From` on a webmail domain
 * (gmail.com, seznam.cz) fails DMARC alignment, because Brevo signs with its
 * own domain. It delivers, but a share of it lands in spam. Both go away by
 * authenticating a real domain in Brevo and changing `BREVO_SENDER_EMAIL` —
 * one environment variable, no code.
 */

const ENDPOINT = "https://api.brevo.com/v3/smtp/email";

/** The display name beside the address. Not configurable — it is the product. */
const SENDER_NAME = "Workeee";

/** Attempts per message, including the first. */
const ATTEMPTS = 3;

/** Backoff before attempt 2 and attempt 3. */
const BACKOFF_MS = [1_000, 4_000];

export type OutgoingEmail = {
  to: { email: string; name: string };
  subject: string;
  html: string;
  text: string;
};

/**
 * Send one transactional e-mail, or do nothing.
 *
 * **Unconfigured means silent.** With no `BREVO_API_KEY` / `BREVO_SENDER_EMAIL`
 * the function returns `false` without touching the network, which is what
 * makes the dev deployment and `vitest` safe by default — a test may run the
 * scheduler all it likes and no mail leaves the building.
 *
 * Transient failures (429, 5xx, network) are retried a couple of times. A 4xx
 * is our own bad request and is logged, not retried. Nothing here throws: a
 * lost notification is a lost notification, and there is no caller who could
 * do anything better with the exception.
 */
export async function sendTransactionalEmail(
  message: OutgoingEmail,
): Promise<boolean> {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  if (!apiKey || !senderEmail) {
    console.warn(
      "[brevo] BREVO_API_KEY nebo BREVO_SENDER_EMAIL není nastavené — upozornění se neposílá.",
    );
    return false;
  }

  const body = JSON.stringify({
    sender: { email: senderEmail, name: SENDER_NAME },
    to: [{ email: message.to.email, name: message.to.name }],
    subject: message.subject,
    htmlContent: message.html,
    textContent: message.text,
  });

  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    if (attempt > 0) {
      await sleep(BACKOFF_MS[attempt - 1]);
    }
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "api-key": apiKey,
          accept: "application/json",
          "content-type": "application/json",
        },
        body,
      });
      if (response.ok) {
        return true;
      }
      // 4xx that is not a rate limit is a bug in this request. Repeating it
      // would only repeat the bug.
      if (response.status !== 429 && response.status < 500) {
        console.error(
          `[brevo] ${response.status}: ${await response.text().catch(() => "")}`,
        );
        return false;
      }
    } catch (error) {
      console.error("[brevo] síťová chyba", error);
    }
  }

  console.error("[brevo] e-mail se nepovedlo odeslat ani na třetí pokus.");
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
