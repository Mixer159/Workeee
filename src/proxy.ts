import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * One rule, one route: the base URL answers to whoever is asking.
 *
 * A request for `/` with a Better Auth session cookie passes through to the
 * dashboard; one without it is rewritten — not redirected — to `/o-aplikaci`,
 * so a visitor, a crawler and a chat unfurl all find the public page on the
 * bare domain while every signed-in bookmark still lands in the app. The URL
 * never changes either way.
 *
 * The check is deliberately optimistic: the cookie's *presence*, not its
 * validity — validating would mean a round trip on every hit to `/`, and the
 * failure mode of a stale cookie is the app shell, where `AuthGuard` already
 * sends the person to the sign-in screen. Choosing which page to show is not
 * an authorization decision; every real read stays authorized in Convex.
 */
export default function proxy(request: NextRequest) {
  if (getSessionCookie(request)) {
    return NextResponse.next();
  }
  return NextResponse.rewrite(new URL("/o-aplikaci", request.url));
}

export const config = { matcher: ["/"] };
