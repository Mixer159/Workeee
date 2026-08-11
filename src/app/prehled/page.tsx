import { redirect } from "next/navigation";

/**
 * The dashboard lived here while the landing page held `/`. It is back at `/`
 * now, and this route survives only so links and bookmarks made in the
 * meantime keep working — the same courtesy `/projekt/[id]/ukol/[taskId]`
 * extends to pre-drawer task links.
 */
export default function PrehledRedirect() {
  redirect("/");
}
