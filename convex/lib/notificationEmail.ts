import type { Digest, DigestItem } from "./notifications";
import { plural } from "./plural";

/**
 * The digest e-mail: subject, HTML and plain text.
 *
 * A pure function of the digest and the site origin — no database, no clock, no
 * environment. That is deliberate: the wording and the pluralization are the
 * part of this feature that is worth testing exhaustively, and this way
 * `convex/notificationEmail.test.ts` can do it without a harness.
 *
 * The HTML is one column of inline styles and no images. Mail clients strip
 * `<style>` blocks, `class` attributes and anything clever, and this e-mail has
 * nothing to gain from fighting them — it is a list of links.
 */

/** Tasks listed per project before the e-mail says "and N more". */
export const MAX_ITEMS_PER_PROJECT = 25;

/** Long titles are cut in the subject line only; the body shows them in full. */
const SUBJECT_TITLE_LIMIT = 80;

export type NotificationEmail = {
  subject: string;
  html: string;
  text: string;
};

export function buildTaskDigest(
  digest: Digest,
  siteUrl: string,
): NotificationEmail {
  const origin = siteUrl.replace(/\/+$/, "");
  return {
    subject: buildSubject(digest),
    html: buildHtml(digest, origin),
    text: buildText(digest, origin),
  };
}

/**
 * "Nový úkol: Opravit fakturaci" · "3 nové úkoly v projektu Web" ·
 * "8 nových úkolů".
 *
 * The count is in the subject because that is what the person decides on
 * without opening anything. Across several projects it deliberately names none
 * of them: "ve 3 projektech" versus "v 5 projektech" is a preposition that
 * changes with the spoken numeral, and a subject line is not worth that trap.
 */
export function buildSubject(digest: Digest): string {
  const noun = plural(
    digest.total,
    "nový úkol",
    "nové úkoly",
    "nových úkolů",
  );

  if (digest.total === 1) {
    const only = digest.projects[0]?.items[0];
    return only ? `Nový úkol: ${truncate(only.title, SUBJECT_TITLE_LIMIT)}` : noun;
  }

  const count = `${digest.total} ${noun}`;
  if (digest.projects.length === 1) {
    return `${count} v projektu ${digest.projects[0].projectName}`;
  }
  return count;
}

function taskUrl(origin: string, item: DigestItem): string {
  return `${origin}/projekt/${item.projectId}?ukol=${item.taskId}`;
}

function settingsUrl(origin: string): string {
  return `${origin}/nastaveni/upozorneni`;
}

function heading(digest: Digest): string {
  if (digest.total === 1) {
    return "Máte nový úkol";
  }
  return `Máte ${digest.total} ${plural(
    digest.total,
    "nový úkol",
    "nové úkoly",
    "nových úkolů",
  )}`;
}

function buildHtml(digest: Digest, origin: string): string {
  const sections = digest.projects
    .map((project) => {
      const shown = project.items.slice(0, MAX_ITEMS_PER_PROJECT);
      const hidden = project.items.length - shown.length;

      const rows = shown
        .map(
          (item) => `
        <tr>
          <td style="padding:0 0 10px;">
            <a href="${escapeHtml(taskUrl(origin, item))}" style="color:#4F46E5;font-size:15px;font-weight:500;text-decoration:none;">${escapeHtml(item.title)}</a>
            <div style="color:#71717a;font-size:13px;padding-top:2px;">${escapeHtml(subtitle(item))}</div>
          </td>
        </tr>`,
        )
        .join("");

      const more =
        hidden > 0
          ? `<tr><td style="color:#71717a;font-size:13px;padding:2px 0 10px;">a ${hidden} ${plural(hidden, "další úkol", "další úkoly", "dalších úkolů")}</td></tr>`
          : "";

      return `
      <tr>
        <td style="padding:20px 0 8px;">
          <div style="color:#71717a;font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;">${escapeHtml(project.projectName)}</div>
        </td>
      </tr>
      <tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}${more}</table></td></tr>`;
    })
    .join("");

  return `<!doctype html>
<html lang="cs">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="background:#fafafa;margin:0;padding:24px 12px;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader(digest))}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #e4e4e7;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:560px;padding:28px 32px;width:100%;">
        <tr>
          <td style="color:#09090b;font-size:20px;font-weight:600;padding-bottom:4px;">${escapeHtml(heading(digest))}</td>
        </tr>
        <tr>
          <td style="color:#71717a;font-size:14px;">Workeee</td>
        </tr>
        ${sections}
        <tr><td style="border-top:1px solid #e4e4e7;padding-top:20px;">
          <div style="color:#a1a1aa;font-size:12px;line-height:1.6;">
            Tohle je automatické upozornění z Workeee.<br>
            <a href="${escapeHtml(settingsUrl(origin))}" style="color:#a1a1aa;">Vypnout upozornění</a>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildText(digest: Digest, origin: string): string {
  const lines: string[] = [heading(digest), ""];

  for (const project of digest.projects) {
    const shown = project.items.slice(0, MAX_ITEMS_PER_PROJECT);
    const hidden = project.items.length - shown.length;

    lines.push(`${project.projectName}:`);
    for (const item of shown) {
      lines.push(`- ${item.title} (${subtitle(item)})`);
      lines.push(`  ${taskUrl(origin, item)}`);
    }
    if (hidden > 0) {
      lines.push(
        `- a ${hidden} ${plural(hidden, "další úkol", "další úkoly", "dalších úkolů")}`,
      );
    }
    lines.push("");
  }

  lines.push("Tohle je automatické upozornění z Workeee.");
  lines.push(`Vypnout upozornění: ${settingsUrl(origin)}`);
  return lines.join("\n");
}

function subtitle(item: DigestItem): string {
  return item.kind === "task_assigned"
    ? `Přiřadil vám ${item.actorName}`
    : `Přidal ${item.actorName}`;
}

function preheader(digest: Digest): string {
  const first = digest.projects[0]?.items[0];
  return first ? first.title : "Nové úkoly ve Workeee";
}

function truncate(value: string, limit: number): string {
  return value.length <= limit ? value : `${value.slice(0, limit - 1).trimEnd()}…`;
}

/**
 * A task title is whatever somebody typed, and it ends up inside an HTML
 * document — so it is escaped, here, once, on the way in.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
