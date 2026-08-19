"use client";

import { useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { HEARTBEAT_MS } from "@convex/lib/presence";

/**
 * "Jsem tady" — one beat on mount, one on every return to a visible tab, and
 * one every `HEARTBEAT_MS` while the tab stays visible.
 *
 * A hidden tab beats nothing: the interval is cleared the moment the page is
 * hidden and started again when it comes back, so a laptop left open on
 * another desktop stops claiming to be online after `ONLINE_WINDOW_MS`. The
 * server throttles the write itself (`WRITE_GAP_MS`), so the cadence here is
 * about the reading, not about the number of writes.
 *
 * Mounted once, in the signed-in shell. It holds no state and every failure is
 * swallowed — a heartbeat that toasted would be a notification about nothing.
 */
export function usePresenceHeartbeat(): void {
  const heartbeat = useMutation(api.presence.heartbeat);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    const beat = () => {
      void heartbeat({}).catch(() => {
        // Presence is best effort; there is nothing for a person to do about it.
      });
    };

    const stop = () => {
      if (interval !== null) {
        clearInterval(interval);
        interval = null;
      }
    };

    // Restarting the interval keeps the cadence measured from the beat that
    // just went out, not from whenever the previous interval happened to be.
    const start = () => {
      stop();
      beat();
      interval = setInterval(beat, HEARTBEAT_MS);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === "visible") {
      start();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      stop();
    };
  }, [heartbeat]);
}
