import type { OutgoingEmail } from "./brevo";

/**
 * The password reset e-mail: subject, HTML and plain text.
 *
 * A pure function of the recipient and the link — no database, no clock, no
 * environment — so `convex/passwordResetEmail.test.ts` can pin the wording and
 * the escaping without a harness. Same discipline as `notificationEmail.ts`:
 * one column of inline styles, no images, one link.
 */

/** How long a reset link is valid. Mirrors `resetPasswordTokenExpiresIn`. */
export const RESET_LINK_LIFETIME_MINUTES = 60;

export function buildPasswordResetEmail(input: {
  to: { email: string; name: string };
  url: string;
}): OutgoingEmail {
  const { to, url } = input;
  const heading = "Obnova hesla";
  const lead =
    "Někdo požádal o nové heslo k vašemu účtu ve Workeee. Pokud jste to byli vy, pokračujte odkazem níže.";
  const expiry = `Odkaz platí ${RESET_LINK_LIFETIME_MINUTES} minut a lze ho použít jen jednou.`;
  const ignore =
    "Pokud jste o nové heslo nežádali, tenhle e-mail ignorujte. Heslo zůstává beze změny.";

  const html = `<!doctype html>
<html lang="cs">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="background:#fafafa;margin:0;padding:24px 12px;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(lead)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #e4e4e7;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:560px;padding:28px 32px;width:100%;">
        <tr>
          <td style="color:#09090b;font-size:20px;font-weight:600;padding-bottom:4px;">${heading}</td>
        </tr>
        <tr>
          <td style="color:#71717a;font-size:14px;">Workeee</td>
        </tr>
        <tr>
          <td style="color:#09090b;font-size:15px;line-height:1.55;padding:20px 0 16px;">${escapeHtml(lead)}</td>
        </tr>
        <tr>
          <td style="padding:0 0 20px;">
            <a href="${escapeHtml(url)}" style="background:#4F46E5;border-radius:6px;color:#ffffff;display:inline-block;font-size:15px;font-weight:600;padding:10px 18px;text-decoration:none;">Nastavit nové heslo</a>
          </td>
        </tr>
        <tr>
          <td style="color:#71717a;font-size:13px;line-height:1.55;padding-bottom:20px;">${escapeHtml(expiry)}<br>${escapeHtml(ignore)}</td>
        </tr>
        <tr><td style="border-top:1px solid #e4e4e7;padding-top:20px;">
          <div style="color:#a1a1aa;font-size:12px;line-height:1.6;">
            Pokud tlačítko nefunguje, zkopírujte adresu do prohlížeče:<br>
            <a href="${escapeHtml(url)}" style="color:#a1a1aa;word-break:break-all;">${escapeHtml(url)}</a>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    heading,
    "",
    lead,
    "",
    url,
    "",
    expiry,
    ignore,
  ].join("\n");

  return { to, subject: "Obnova hesla do Workeee", html, text };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
