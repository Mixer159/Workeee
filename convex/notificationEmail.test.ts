import { describe, expect, test } from "vitest";
import type { Id } from "./_generated/dataModel";
import { buildTaskDigest, MAX_ITEMS_PER_PROJECT } from "./lib/notificationEmail";
import type {
  Digest,
  DigestCommentItem,
  DigestItem,
  DigestTaskItem,
} from "./lib/notifications";

/**
 * The wording of the digest, tested without a harness.
 *
 * `buildTaskDigest` is a pure function of the digest and the origin precisely so
 * that this file can exist: the Czech plural forms and the subject line are the
 * part a person actually reads, and they deserve more cases than a database
 * test would make comfortable.
 */

const SITE = "https://workeee.vercel.app";

/** Every task in a digest is an assignment — a created task is feed-only. */
function task(title: string, index: number): DigestTaskItem {
  return {
    type: "task",
    taskId: `task_${index}` as Id<"tasks">,
    projectId: "project_1" as Id<"projects">,
    title,
    kind: "task_assigned",
    actorName: "Jana Nováková",
  };
}

function comment(
  title: string,
  index: number,
  options: {
    kind?: DigestCommentItem["kind"];
    count?: number;
    preview?: string;
  } = {},
): DigestCommentItem {
  return {
    type: "comment",
    taskId: `task_${index}` as Id<"tasks">,
    projectId: "project_1" as Id<"projects">,
    title,
    kind: options.kind ?? "comment_added",
    actorName: "Jana Nováková",
    count: options.count ?? 1,
    preview: options.preview ?? "Mrkni na to, prosím.",
  };
}

function digest(
  projects: { projectName: string; items: DigestItem[] }[],
): Digest {
  const all = projects.flatMap((project) => project.items);
  return {
    email: "petr@example.com",
    name: "Petr Svoboda",
    projects: projects.map((project, index) => ({
      projectId: `project_${index}` as Id<"projects">,
      projectName: project.projectName,
      items: project.items,
    })),
    total: all.length,
    taskCount: all.filter((item) => item.type === "task").length,
    commentCount: all.filter((item) => item.type === "comment").length,
  };
}

describe("subject", () => {
  test("one task names the task itself", () => {
    const mail = buildTaskDigest(
      digest([{ projectName: "Web", items: [task("Opravit fakturaci", 1)] }]),
      SITE,
    );
    expect(mail.subject).toBe("Nový úkol: Opravit fakturaci");
  });

  test("one comment names the task it was written under", () => {
    const mail = buildTaskDigest(
      digest([{ projectName: "Web", items: [comment("Opravit fakturaci", 1)] }]),
      SITE,
    );
    expect(mail.subject).toBe("Nový komentář: Opravit fakturaci");
  });

  test("Czech has three plural forms and the subject uses all of them", () => {
    const forms = [
      [2, "2 nové úkoly v projektu Web"],
      [3, "3 nové úkoly v projektu Web"],
      [4, "4 nové úkoly v projektu Web"],
      [5, "5 nových úkolů v projektu Web"],
      [8, "8 nových úkolů v projektu Web"],
      [11, "11 nových úkolů v projektu Web"],
    ] as const;

    for (const [count, expected] of forms) {
      const items = Array.from({ length: count }, (_, index) =>
        task(`Úkol ${index}`, index),
      );
      const mail = buildTaskDigest(
        digest([{ projectName: "Web", items }]),
        SITE,
      );
      expect(mail.subject).toBe(expected);
    }
  });

  test("comments decline the same way", () => {
    const forms = [
      [2, "2 nové komentáře v projektu Web"],
      [5, "5 nových komentářů v projektu Web"],
    ] as const;

    for (const [count, expected] of forms) {
      const items = Array.from({ length: count }, (_, index) =>
        comment(`Úkol ${index}`, index),
      );
      expect(
        buildTaskDigest(digest([{ projectName: "Web", items }]), SITE).subject,
      ).toBe(expected);
    }
  });

  test("mixed drops the adjective on the second half of the conjunction", () => {
    // "1 nový úkol a 5 komentářů", never "1 nový úkol a 5 nových komentářů".
    const mail = buildTaskDigest(
      digest([
        {
          projectName: "Web",
          items: [
            task("A", 1),
            ...Array.from({ length: 5 }, (_, index) =>
              comment(`Úkol ${index}`, index + 10),
            ),
          ],
        },
      ]),
      SITE,
    );
    expect(mail.subject).toBe("1 nový úkol a 5 komentářů v projektu Web");
  });

  test("mixed, two of each", () => {
    const mail = buildTaskDigest(
      digest([
        {
          projectName: "Web",
          items: [task("A", 1), task("B", 2), comment("C", 3), comment("D", 4)],
        },
      ]),
      SITE,
    );
    expect(mail.subject).toBe("2 nové úkoly a 2 komentáře v projektu Web");
  });

  test("across several projects it names none of them", () => {
    const mail = buildTaskDigest(
      digest([
        { projectName: "Web", items: [task("A", 1), task("B", 2)] },
        { projectName: "Mobil", items: [task("C", 3)] },
      ]),
      SITE,
    );
    // "ve 3 projektech" versus "v 5 projektech" is a preposition that changes
    // with the spoken numeral — the subject deliberately avoids it.
    expect(mail.subject).toBe("3 nové úkoly");
  });

  test("a very long title is cut in the subject, not in the body", () => {
    const long = "A".repeat(200);
    const mail = buildTaskDigest(
      digest([{ projectName: "Web", items: [task(long, 1)] }]),
      SITE,
    );
    expect(mail.subject.length).toBeLessThanOrEqual("Nový úkol: ".length + 80);
    expect(mail.subject.endsWith("…")).toBe(true);
    expect(mail.text).toContain(long);
  });
});

describe("body", () => {
  test("every entry links into the drawer on its board", () => {
    const mail = buildTaskDigest(
      digest([{ projectName: "Web", items: [task("Opravit fakturaci", 1)] }]),
      SITE,
    );
    const url = `${SITE}/projekt/project_1?ukol=task_1`;
    expect(mail.html).toContain(url);
    expect(mail.text).toContain(url);
  });

  test("a trailing slash on the origin does not become a double slash", () => {
    const mail = buildTaskDigest(
      digest([{ projectName: "Web", items: [task("A", 1)] }]),
      `${SITE}/`,
    );
    expect(mail.html).not.toContain("//projekt");
    expect(mail.html).toContain(`${SITE}/projekt/project_1?ukol=task_1`);
  });

  test("the labels are verbless, so they stay correct whoever acted", () => {
    // "Přidal Jana Nováková" is wrong for half the team and the app does not
    // know which half anybody is in.
    const mail = buildTaskDigest(
      digest([
        {
          projectName: "Web",
          items: [
            task("A", 1),
            comment("C", 3, { kind: "comment_mention" }),
            comment("D", 4, { kind: "comment_added" }),
          ],
        },
      ]),
      SITE,
    );
    expect(mail.text).toContain("Přiřazeno vám · Jana Nováková");
    expect(mail.text).toContain("Zmínka v komentáři · Jana Nováková");
    expect(mail.text).toContain("Nový komentář · Jana Nováková");
    expect(mail.text).not.toContain("Přidal ");
    expect(mail.text).not.toContain("Přiřadil ");
  });

  test("several comments on one task are one line with a count", () => {
    const mail = buildTaskDigest(
      digest([
        {
          projectName: "Web",
          items: [comment("Opravit fakturaci", 1, { count: 5 })],
        },
      ]),
      SITE,
    );
    expect(mail.text).toContain("Nový komentář · 5 komentářů · Jana Nováková");
    // One item, so the subject still reads as one.
    expect(mail.subject).toBe("Nový komentář: Opravit fakturaci");
  });

  test("the comment itself is quoted", () => {
    const mail = buildTaskDigest(
      digest([
        {
          projectName: "Web",
          items: [comment("A", 1, { preview: "Tohle je potřeba do pátku." })],
        },
      ]),
      SITE,
    );
    expect(mail.html).toContain("Tohle je potřeba do pátku.");
    expect(mail.text).toContain("„Tohle je potřeba do pátku.\"");
  });

  test("a deleted comment leaves the line without a quote, not with an empty one", () => {
    const mail = buildTaskDigest(
      digest([
        { projectName: "Web", items: [comment("A", 1, { preview: "", count: 3 })] },
      ]),
      SITE,
    );
    expect(mail.html).not.toContain("border-left:2px solid");
    expect(mail.text).not.toContain("„\"");
  });

  test("tasks are listed before the talk about them", () => {
    const mail = buildTaskDigest(
      digest([
        {
          projectName: "Web",
          items: [task("Úkol", 1), comment("Komentář", 2)],
        },
      ]),
      SITE,
    );
    expect(mail.text.indexOf("Úkol")).toBeLessThan(
      mail.text.indexOf("Komentář"),
    );
  });

  test("the footer links to the switch that turns this off", () => {
    const mail = buildTaskDigest(
      digest([{ projectName: "Web", items: [task("A", 1)] }]),
      SITE,
    );
    expect(mail.html).toContain(`${SITE}/nastaveni/upozorneni`);
    expect(mail.text).toContain(`${SITE}/nastaveni/upozorneni`);
  });

  test("a long list is cut off with a count of the rest", () => {
    const items = Array.from({ length: MAX_ITEMS_PER_PROJECT + 7 }, (_, index) =>
      task(`Úkol ${index}`, index),
    );
    const mail = buildTaskDigest(digest([{ projectName: "Web", items }]), SITE);
    expect(mail.text).toContain("a 7 dalších úkolů");
    expect(mail.text).not.toContain(`Úkol ${MAX_ITEMS_PER_PROJECT + 1}`);
    // The count in the subject is still the real one.
    expect(mail.subject).toBe(`${items.length} nových úkolů v projektu Web`);
  });

  test("neither a title nor a quoted comment can inject markup", () => {
    const mail = buildTaskDigest(
      digest([
        {
          projectName: "Web",
          items: [
            task('<img src=x onerror="alert(1)">', 1),
            comment("B", 2, { preview: "<script>alert(2)</script>" }),
          ],
        },
      ]),
      SITE,
    );
    expect(mail.html).not.toContain("<img src=x");
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(mail.html).toContain("&lt;script&gt;alert(2)&lt;/script&gt;");
  });
});
