import { describe, expect, test } from "vitest";
import type { Id } from "./_generated/dataModel";
import { buildTaskDigest, MAX_ITEMS_PER_PROJECT } from "./lib/notificationEmail";
import type { Digest, DigestItem } from "./lib/notifications";

/**
 * The wording of the digest, tested without a harness.
 *
 * `buildTaskDigest` is a pure function of the digest and the origin precisely so
 * that this file can exist: the Czech plural forms and the subject line are the
 * part a person actually reads, and they deserve more cases than a database
 * test would make comfortable.
 */

const SITE = "https://workeee.vercel.app";

function item(title: string, index: number, kind: DigestItem["kind"] = "task_created"): DigestItem {
  return {
    taskId: `task_${index}` as Id<"tasks">,
    projectId: "project_1" as Id<"projects">,
    title,
    kind,
    actorName: "Jana Nováková",
  };
}

function digest(
  projects: { projectName: string; items: DigestItem[] }[],
): Digest {
  return {
    email: "petr@example.com",
    name: "Petr Svoboda",
    projects: projects.map((project, index) => ({
      projectId: `project_${index}` as Id<"projects">,
      projectName: project.projectName,
      items: project.items,
    })),
    total: projects.reduce((sum, project) => sum + project.items.length, 0),
  };
}

describe("subject", () => {
  test("one task names the task itself", () => {
    const mail = buildTaskDigest(
      digest([{ projectName: "Web", items: [item("Opravit fakturaci", 1)] }]),
      SITE,
    );
    expect(mail.subject).toBe("Nový úkol: Opravit fakturaci");
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
        item(`Úkol ${index}`, index),
      );
      const mail = buildTaskDigest(
        digest([{ projectName: "Web", items }]),
        SITE,
      );
      expect(mail.subject).toBe(expected);
    }
  });

  test("across several projects it names none of them", () => {
    const mail = buildTaskDigest(
      digest([
        { projectName: "Web", items: [item("A", 1), item("B", 2)] },
        { projectName: "Mobil", items: [item("C", 3)] },
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
      digest([{ projectName: "Web", items: [item(long, 1)] }]),
      SITE,
    );
    expect(mail.subject.length).toBeLessThanOrEqual("Nový úkol: ".length + 80);
    expect(mail.subject.endsWith("…")).toBe(true);
    expect(mail.text).toContain(long);
  });
});

describe("body", () => {
  test("every task links into the drawer on its board", () => {
    const mail = buildTaskDigest(
      digest([{ projectName: "Web", items: [item("Opravit fakturaci", 1)] }]),
      SITE,
    );
    const url = `${SITE}/projekt/project_1?ukol=task_1`;
    expect(mail.html).toContain(url);
    expect(mail.text).toContain(url);
  });

  test("a trailing slash on the origin does not become a double slash", () => {
    const mail = buildTaskDigest(
      digest([{ projectName: "Web", items: [item("A", 1)] }]),
      `${SITE}/`,
    );
    expect(mail.html).not.toContain("//projekt");
    expect(mail.html).toContain(`${SITE}/projekt/project_1?ukol=task_1`);
  });

  test("an assigned task reads differently from one that was merely added", () => {
    const mail = buildTaskDigest(
      digest([
        {
          projectName: "Web",
          items: [item("A", 1, "task_assigned"), item("B", 2, "task_created")],
        },
      ]),
      SITE,
    );
    expect(mail.text).toContain("Přiřadil vám Jana Nováková");
    expect(mail.text).toContain("Přidal Jana Nováková");
  });

  test("the footer links to the switch that turns this off", () => {
    const mail = buildTaskDigest(
      digest([{ projectName: "Web", items: [item("A", 1)] }]),
      SITE,
    );
    expect(mail.html).toContain(`${SITE}/nastaveni/upozorneni`);
    expect(mail.text).toContain(`${SITE}/nastaveni/upozorneni`);
  });

  test("a long list is cut off with a count of the rest", () => {
    const items = Array.from({ length: MAX_ITEMS_PER_PROJECT + 7 }, (_, index) =>
      item(`Úkol ${index}`, index),
    );
    const mail = buildTaskDigest(
      digest([{ projectName: "Web", items }]),
      SITE,
    );
    expect(mail.text).toContain("a 7 dalších úkolů");
    expect(mail.text).not.toContain(`Úkol ${MAX_ITEMS_PER_PROJECT + 1}`);
    // The count in the subject is still the real one.
    expect(mail.subject).toBe(`${items.length} nových úkolů v projektu Web`);
  });

  test("a task title cannot inject markup into the e-mail", () => {
    const mail = buildTaskDigest(
      digest([
        {
          projectName: "Web",
          items: [item('<img src=x onerror="alert(1)">', 1)],
        },
      ]),
      SITE,
    );
    expect(mail.html).not.toContain("<img src=x");
    expect(mail.html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });
});
