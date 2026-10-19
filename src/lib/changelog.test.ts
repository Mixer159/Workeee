import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The website in `web/` is a separate project and cannot import the app's
// changelog, so it carries a copy. This is what keeps the copy current.
const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("changelog", () => {
  it("is copied to the website unchanged", () => {
    expect(read("../../web/src/lib/changelog.ts")).toBe(read("./changelog.ts"));
  });
});
