import type { ListeningData } from "@/data/analytics/lucas";
import { lucasListeningData } from "@/data/analytics/lucas";

/**
 * Per-user listening data lookup.
 * Phase 1: hardcoded for "lucas". Phase 2 will swap to a per-user lookup
 * keyed on a `spotify_connected` flag once OAuth lands.
 */
export async function getProfileListeningData(
  username: string
): Promise<ListeningData | null> {
  if (username === "lucas") return lucasListeningData;
  return null;
}
