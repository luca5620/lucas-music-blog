import { permanentRedirect } from "next/navigation";

/**
 * /friends → /social (Luca 2026-08-31: the whole page renamed —
 * "Social" covers rooms + weekly charts + activity, "Friends"
 * implied you needed some first). The old URL 308s so bookmarks,
 * the installed apps' cached tabs, and any stray links keep working.
 */
export default function FriendsRedirect() {
  permanentRedirect("/social");
}
