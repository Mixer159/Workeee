import { describe, expect, it } from "vitest";
import { ONLINE_WINDOW_MS } from "@convex/lib/presence";
import { describePresence } from "@/lib/presence";

const NOW = Date.UTC(2026, 7, 19, 12, 0, 0);
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

describe("describePresence", () => {
  it("reads a heartbeat inside the window as Online", () => {
    expect(
      describePresence({ lastSeenAt: NOW - 30_000, lastActiveAt: null }, NOW),
    ).toMatchObject({ online: true, seen: "Online" });
  });

  it("keeps Online at the last millisecond of the window and drops it after", () => {
    expect(
      describePresence(
        { lastSeenAt: NOW - ONLINE_WINDOW_MS + 1, lastActiveAt: null },
        NOW,
      ).online,
    ).toBe(true);
    expect(
      describePresence(
        { lastSeenAt: NOW - ONLINE_WINDOW_MS, lastActiveAt: null },
        NOW,
      ).online,
    ).toBe(false);
  });

  it("says how long ago somebody was here once the window has passed", () => {
    expect(
      describePresence({ lastSeenAt: NOW - 5 * MINUTE, lastActiveAt: null }, NOW)
        .seen,
    ).toBe("Naposledy online před 5 min");
    expect(
      describePresence({ lastSeenAt: NOW - 2 * HOUR, lastActiveAt: null }, NOW)
        .seen,
    ).toBe("Naposledy online před 2 hodinami");
  });

  it("says Zatím bez návštěvy for somebody never seen", () => {
    expect(
      describePresence({ lastSeenAt: null, lastActiveAt: null }, NOW),
    ).toMatchObject({
      online: false,
      seen: "Zatím bez návštěvy",
      active: "Bez aktivity",
    });
  });

  it("dates the last activity independently of the visit", () => {
    expect(
      describePresence(
        { lastSeenAt: NOW - 10_000, lastActiveAt: NOW - 2 * HOUR },
        NOW,
      ),
    ).toEqual({
      online: true,
      seen: "Online",
      active: "Aktivita před 2 hodinami",
    });
  });

  it("says Bez aktivity for a visitor who has never written anything", () => {
    expect(
      describePresence({ lastSeenAt: NOW - 10_000, lastActiveAt: null }, NOW)
        .active,
    ).toBe("Bez aktivity");
  });

  it("reads a moment ago as právě teď after both labels", () => {
    expect(
      describePresence(
        { lastSeenAt: NOW - 10 * MINUTE, lastActiveAt: NOW - 5_000 },
        NOW,
      ),
    ).toEqual({
      online: false,
      seen: "Naposledy online před 10 min",
      active: "Aktivita právě teď",
    });
  });
});
