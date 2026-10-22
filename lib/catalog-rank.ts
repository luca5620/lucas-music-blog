/**
 * Catalog ranking helpers — PURE (no server imports), so the browser
 * can use them too (CatalogSearch highlights the matched words with
 * `foldText`).
 *
 * Why this exists (Luca 2026-10-22, looking for Téléphone's "Rappels"):
 * the old search just glued the sources together in a fixed order —
 * PMR rows, then Spotify albums, then Spotify songs, then Genius —
 * so whatever Spotify happened to list first won, even when it was the
 * wrong record. Now every result gets a score for how well it matches
 * what was TYPED, and the list is sorted by that score:
 *
 *   - the exact title beats a longer title that starts with it
 *     ("Rappels" ranks above "Rappels 2")
 *   - "title + artist" typed together ("rappels telephone") counts
 *     as a near-exact hit, in either order
 *   - accents and punctuation don't matter ("telephone" = "Téléphone")
 */

/**
 * Lowercase, strip accents, turn punctuation into spaces, collapse
 * whitespace. "Téléphone — Ça (c'est vraiment toi)" → "telephone ca c est vraiment toi".
 * Letters from any script survive (\p{L}), so Japanese/Korean titles
 * still compare properly.
 */
export function foldText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Words of a folded string, empty strings dropped. */
function words(s: string): string[] {
  return s.split(" ").filter(Boolean);
}

/**
 * How well does a (title, artist) pair match the query? 0–100.
 * Bands, highest first:
 *   100  title is exactly the query
 *    95  query is exactly "title artist" or "artist title"
 *    90  query = artist name + exactly the title (any order of the two
 *        halves) — same thing with a featured-artist line
 *    70–85  title starts with the query (shorter extra = higher)
 *    65–80  query = artist name + the START of the title
 *        ("rappels telephone" → Rappels 2 by Téléphone)
 *    50–68  every typed word appears in title, artist, or (songs) the
 *        record the song is on
 *     0–40  some typed words appear
 *
 * `album` (songs only) is the record the song is on: typing
 * "rappels telephone" should lift Téléphone's songs FROM Rappels 2
 * above some unrelated single called "Telephone".
 */
export function matchScore(
  query: string,
  title: string,
  artist: string,
  album?: string
): number {
  const q = foldText(query);
  const t = foldText(title);
  const a = foldText(artist);
  if (!q) return 0;

  if (t === q) return 100;
  if (`${t} ${a}` === q || `${a} ${t}` === q) return 95;

  const qWords = words(q);
  const tWords = words(t);
  const aWords = new Set(words(a));

  // "rappels telephone": drop the artist's words from the query and
  // see whether what's left is exactly the title.
  const rest = qWords.filter((w) => !aWords.has(w)).join(" ");
  if (rest && rest !== q && rest === t) return 90;
  if (rest && rest !== q && t.startsWith(rest)) {
    const extra = tWords.length - words(rest).length;
    return Math.max(65, 80 - extra * 3);
  }

  if (t.startsWith(q)) {
    // "Rappels 2" for "rappels" — close, but the exact one wins.
    const extra = tWords.length - qWords.length;
    return Math.max(70, 85 - extra * 3);
  }

  const hay = new Set([...tWords, ...aWords, ...words(foldText(album ?? ""))]);
  // A typed word counts when it's a whole word, or the START of one
  // (people stop typing mid-word: "telep" should still find Téléphone).
  const hits = qWords.filter(
    (w) => hay.has(w) || [...hay].some((h) => h.startsWith(w))
  ).length;
  if (hits === qWords.length) {
    // All words present. More of the TITLE matched = better.
    const titleHits = qWords.filter((w) => tWords.some((h) => h.startsWith(w))).length;
    return 50 + Math.round((titleHits / qWords.length) * 18);
  }
  return Math.round((hits / qWords.length) * 40);
}

/**
 * Does an ARTIST name match the query well enough to show as an
 * "artist" result? Spotify's artist search pads its answer with
 * loosely related names (searching "Téléphone" also returns TLC and
 * Electric Light Orchestra) — those are noise in a picker.
 */
export function artistMatches(query: string, name: string): boolean {
  const q = foldText(query);
  const n = foldText(name);
  if (!q || !n) return false;
  if (n === q || n.startsWith(q)) return true;
  // "rappels telephone" → the artist Téléphone is IN the query.
  return ` ${q} `.includes(` ${n} `);
}
