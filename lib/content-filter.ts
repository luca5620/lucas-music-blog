/**
 * Objectionable-content filter — the "method for filtering
 * objectionable content" App Store guideline 1.2 requires of any
 * UGC app. Every API route that accepts user-authored text runs it
 * through checkContent() before writing to the database; a match
 * rejects the whole submission with a 400.
 *
 * Scope is deliberate: this blocks SLURS and TARGETED-HARASSMENT
 * phrases, not profanity. "This album is shit" is a music review;
 * a racial slur is a Terms violation. Everything greyer than a
 * bright-line slur is handled by the report queue + 24h moderation
 * (the other half of our 1.2 compliance), so the list should stay
 * short and unambiguous — do NOT grow it with ordinary swearing.
 *
 * Matching is done on a normalized copy of the text (lowercased,
 * common leetspeak digits mapped back to letters) with word
 * boundaries, so "cla55ic"-style masking is caught but innocent
 * substrings inside longer words are not.
 */

// Bright-line terms: hate slurs + direct self-harm harassment.
// Word-boundary matched against normalized text; plural "s" allowed.
const BLOCKED_TERMS: string[] = [
  // Racial / ethnic slurs
  "nigger",
  "kike",
  "spic",
  "chink",
  "gook",
  "wetback",
  "beaner",
  "raghead",
  // Homophobic / transphobic slurs
  "faggot",
  "fagot",
  "tranny",
  // Direct harassment / self-harm bait
  "kill yourself",
  "kys",
  "go die",
];

// Leetspeak → letters. Applied before matching so "f4ggot" and
// "k1ke" don't slip through on a technicality.
const LEET: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "8": "b",
  "@": "a",
  "$": "s",
  "!": "i",
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[0134578@$!]/g, (c) => LEET[c] ?? c);
}

// Build the patterns once at module load. \b works because every
// term starts/ends with a letter after normalization.
const PATTERNS: RegExp[] = BLOCKED_TERMS.map(
  (term) => new RegExp(`\\b${term.replace(/ /g, "\\s+")}s?\\b`, "i")
);

/**
 * True if the text contains a blocked term. Null/undefined/empty
 * text is trivially clean.
 */
export function containsBlockedContent(
  text: string | null | undefined
): boolean {
  if (!text) return false;
  const normalized = normalize(text);
  return PATTERNS.some((re) => re.test(normalized));
}

/**
 * Check any number of user-authored text fields at once. Returns an
 * error message to send back with a 400, or null if everything is
 * clean. Routes call this right after shape validation:
 *
 *   const dirty = checkContent(title, bodyText);
 *   if (dirty) return NextResponse.json({ error: dirty }, { status: 400 });
 */
export function checkContent(
  ...fields: (string | null | undefined)[]
): string | null {
  for (const field of fields) {
    if (containsBlockedContent(field)) {
      return "That text contains language we don't allow. Peak Music Reviews has zero tolerance for slurs and harassment — see the Terms of Use.";
    }
  }
  return null;
}
