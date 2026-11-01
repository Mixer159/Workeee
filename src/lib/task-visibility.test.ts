import { describe, expect, test } from "vitest";
import type { Id } from "@convex/_generated/dataModel";
import {
  hiddenSummary,
  hideOptions,
  membersWhoSee,
  toggleHidden,
  type VisibilityMember,
} from "@/lib/task-visibility";

const id = (value: string) => value as Id<"users">;

const jana: VisibilityMember = { _id: id("jana"), name: "Jana", ownerId: null };
const petr: VisibilityMember = { _id: id("petr"), name: "Petr", ownerId: null };
const eva: VisibilityMember = { _id: id("eva"), name: "Eva", ownerId: null };
// Jana's bot.
const codie: VisibilityMember = { _id: id("codie"), name: "Codie", ownerId: id("jana") };
const members = [codie, eva, jana, petr];

describe("membersWhoSee", () => {
  test("leaves out hidden people and the bots of hidden people", () => {
    expect(membersWhoSee(members, [id("jana")]).map((m) => m.name)).toEqual([
      "Eva",
      "Petr",
    ]);
    expect(membersWhoSee(members, [id("codie")]).map((m) => m.name)).toEqual([
      "Eva",
      "Jana",
      "Petr",
    ]);
    expect(membersWhoSee(members, [])).toEqual(members);
  });
});

describe("hideOptions", () => {
  test("locks the viewer, the author, the řešitel and owner-hidden bots", () => {
    const options = hideOptions(members, [id("jana")], {
      viewerId: id("petr"),
      authorId: id("petr"),
      assigneeId: id("eva"),
    });
    expect(
      options.map((option) => [option.member.name, option.hidden, option.lock]),
    ).toEqual([
      ["Codie", true, "owner"],
      ["Eva", false, "assignee"],
      ["Jana", true, null],
      ["Petr", false, "you"],
    ]);
  });
});

describe("hideOptions with bots", () => {
  test("locks the owner of an author or řešitel bot", () => {
    const options = hideOptions(members, [], {
      viewerId: id("petr"),
      authorId: id("eva"),
      assigneeId: id("codie"),
    });
    expect(
      options.map((option) => [option.member.name, option.lock]),
    ).toEqual([
      ["Codie", "assignee"],
      ["Eva", "author"],
      ["Jana", "assigneeOwner"],
      ["Petr", "you"],
    ]);
  });
});

describe("hiddenSummary", () => {
  test("says who sees it, with the Czech instrumental plural", () => {
    expect(hiddenSummary(0)).toBe("Všichni v projektu");
    expect(hiddenSummary(1)).toBe("Skryto před 1 člověkem");
    expect(hiddenSummary(3)).toBe("Skryto před 3 lidmi");
    expect(hiddenSummary(5)).toBe("Skryto před 5 lidmi");
  });
});

describe("toggleHidden", () => {
  test("adds once and removes cleanly", () => {
    const once = toggleHidden([], id("eva"), true);
    expect(toggleHidden(once, id("eva"), true)).toEqual([id("eva")]);
    expect(toggleHidden(once, id("eva"), false)).toEqual([]);
  });
});
