import { describe, expect, test } from "vitest";
import {
  buildPasswordResetEmail,
  RESET_LINK_LIFETIME_MINUTES,
} from "./lib/passwordResetEmail";

/**
 * The reset e-mail, tested without a harness: the link has to be in both
 * bodies, the lifetime has to be the one the server enforces, and anything
 * that reaches the HTML has to be escaped.
 */

const TO = { email: "jana@example.com", name: "Jana Nováková" };
const URL =
  "https://workeee.vercel.app/api/auth/reset-password/abc123?callbackURL=%2Fnove-heslo";

describe("buildPasswordResetEmail", () => {
  test("carries the link in the button, the fallback line and the plain text", () => {
    const mail = buildPasswordResetEmail({ to: TO, url: URL });
    expect(mail.to).toEqual(TO);
    expect(mail.subject).toBe("Obnova hesla do Workeee");
    // The button's href, then the fallback line's href and its visible text.
    expect(mail.html.split(URL).length - 1).toBe(3);
    expect(mail.text).toContain(URL);
  });

  test("names the lifetime the server enforces", () => {
    const mail = buildPasswordResetEmail({ to: TO, url: URL });
    expect(mail.html).toContain(`${RESET_LINK_LIFETIME_MINUTES} minut`);
    expect(mail.text).toContain(`${RESET_LINK_LIFETIME_MINUTES} minut`);
  });

  test("escapes the URL on the way into the HTML", () => {
    const hostile = 'https://x.test/?a="><script>alert(1)</script>';
    const mail = buildPasswordResetEmail({ to: TO, url: hostile });
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;");
    expect(mail.text).toContain(hostile);
  });
});
