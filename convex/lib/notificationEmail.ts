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
 * "2 nové úkoly a 3 komentáře" · "8 nových úkolů".
 *
 * Every task in a digest is one assigned to the reader, and "Nový úkol" still
 * says the true thing about it: it is new to them. The label under the title
 * is the one that names the assignment.
 *
 * The count is in the subject because that is what the person decides on
 * without opening anything. Across several projects it deliberately names none
 * of them: "ve 3 projektech" versus "v 5 projektech" is a preposition that
 * changes with the spoken numeral, and a subject line is not worth that trap.
 *
 * Note the adjective only appears on the first half of the conjunction —
 * "1 nový úkol a 5 komentářů", never "1 nový úkol a 5 nových komentářů", which
 * is how the language actually works.
 */
export function buildSubject(digest: Digest): string {
  const { taskCount, commentCount } = digest;

  if (digest.total === 1) {
    const only = digest.projects[0]?.items[0];
    if (only) {
      const lead = only.type === "task" ? "Nový úkol" : "Nový komentář";
      return `${lead}: ${truncate(only.title, SUBJECT_TITLE_LIMIT)}`;
    }
  }

  let count: string;
  if (taskCount > 0 && commentCount > 0) {
    count = `${tasks(taskCount)} a ${commentCount} ${plural(commentCount, "komentář", "komentáře", "komentářů")}`;
  } else if (commentCount > 0) {
    count = comments(commentCount);
  } else {
    count = tasks(taskCount);
  }

  if (digest.projects.length === 1) {
    return `${count} v projektu ${digest.projects[0].projectName}`;
  }
  return count;
}

function tasks(count: number): string {
  return `${count} ${plural(count, "nový úkol", "nové úkoly", "nových úkolů")}`;
}

function comments(count: number): string {
  return `${count} ${plural(count, "nový komentář", "nové komentáře", "nových komentářů")}`;
}

function taskUrl(origin: string, item: DigestItem): string {
  return `${origin}/projekt/${item.projectId}?ukol=${item.taskId}`;
}

function settingsUrl(origin: string): string {
  return `${origin}/nastaveni/upozorneni`;
}

function heading(digest: Digest): string {
  const { taskCount, commentCount } = digest;
  if (taskCount > 0 && commentCount > 0) {
    return `Máte ${tasks(taskCount)} a ${commentCount} ${plural(commentCount, "komentář", "komentáře", "komentářů")}`;
  }
  if (commentCount > 0) {
    return `Máte ${comments(commentCount)}`;
  }
  return `Máte ${tasks(taskCount)}`;
}

function buildHtml(digest: Digest, origin: string): string {
  const sections = digest.projects
    .map((project) => {
      const shown = project.items.slice(0, MAX_ITEMS_PER_PROJECT);
      const hidden = project.items.length - shown.length;

      const rows = shown
        .map((item) => {
          // The quoted comment sits in a left-ruled block, the way a mail
          // client renders a quote — it is somebody's words, not ours.
          const quote =
            item.type === "comment" && item.preview.length > 0
              ? `<div style="border-left:2px solid #e4e4e7;color:#52525b;font-size:14px;line-height:1.5;margin-top:6px;padding-left:10px;">${escapeHtml(item.preview)}</div>`
              : "";

          return `
        <tr>
          <td style="padding:0 0 12px;">
            <a href="${escapeHtml(taskUrl(origin, item))}" style="color:#4F46E5;font-size:15px;font-weight:500;text-decoration:none;">${escapeHtml(item.title)}</a>
            <div style="color:#71717a;font-size:13px;padding-top:2px;">${escapeHtml(subtitle(item))}</div>
            ${quote}
          </td>
        </tr>`;
        })
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
      if (item.type === "comment" && item.preview.length > 0) {
        lines.push(`  „${item.preview}"`);
      }
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

/**
 * The muted line under a title.
 *
 * Deliberately verbless: "Přidal Jana Nováková" is wrong for half the team and
 * the app has no idea which half anybody is in — a name is not a gender. A
 * label and a name separated by a middot says the same thing and stays correct
 * for everybody.
 */
function subtitle(item: DigestItem): string {
  const parts: string[] = [];

  if (item.type === "task") {
    // Only assignments are mailed, so there is one label and no alternative.
    parts.push("Přiřazeno vám");
  } else {
    parts.push(
      item.kind === "comment_mention" ? "Zmínka v komentáři" : "Nový komentář",
    );
    if (item.count > 1) {
      parts.push(
        `${item.count} ${plural(item.count, "komentář", "komentáře", "komentářů")}`,
      );
    }
  }

  parts.push(item.actorName);
  return parts.join(" · ");
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
