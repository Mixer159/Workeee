import { describe, expect, it } from "vitest";
import { userInitials } from "@/lib/user";

describe("userInitials", () => {
  it("uses the first letter of the first two name parts", () => {
    expect(userInitials("Jana Nováková", "jana@example.com")).toBe("JN");
  });

  it("falls back to two letters of a single-word name", () => {
    expect(userInitials("Jana", "jana@example.com")).toBe("JA");
  });

  it("falls back to the e-mail when the name is empty", () => {
    expect(userInitials("", "jana.novakova@example.com")).toBe("JN");
  });

  it("returns a placeholder when there is nothing to work with", () => {
    expect(userInitials(null, null)).toBe("?");
  });
});
