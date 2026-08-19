/**
 * Rating + genre color helpers.
 * Extracted from the old static lib/reviews.ts so the color language
 * survives now that all review data lives in the database.
 */

export function getGenreColor(genre: string) {
  switch (genre) {
    case "Hip-Hop":
      return "text-accent-primary";
    case "Pop":
      return "text-accent-cyan";
    case "Alternative":
      return "text-accent-rose";
    case "R&B":
      return "text-accent-glow";
    default:
      return "text-accent-primary";
  }
}

export function getRatingHex(rating: number) {
  if (rating === 10) return "#1e90ff";
  if (rating >= 9.5) return "#c084fc";
  if (rating >= 9) return "#c084fc";
  if (rating >= 8) return "#2563eb";
  if (rating >= 7) return "#06b6d4";
  if (rating >= 6) return "#166534";
  if (rating >= 5) return "#84cc16";
  if (rating >= 4) return "#facc15";
  if (rating >= 3) return "#fb923c";
  if (rating >= 2) return "#ef4444";
  // Bottom of the barrel (0–1.9): light gray, NOT dark gray — this
  // color lands on near-black surfaces, so it must stay readable.
  return "#a1a1aa";
}

export function getRatingColor(rating: number) {
  if (rating === 10) return "rating-perfect text-[#1e90ff] border-[#1e90ff]";
  if (rating >= 9.5) return "rating-elite text-purple-400 border-purple-400";
  if (rating >= 9) return "text-purple-400 border-purple-400";
  if (rating >= 8) return "text-[#2563eb] border-[#2563eb]";
  if (rating >= 7) return "text-[#06b6d4] border-[#06b6d4]";
  if (rating >= 6) return "text-[#166534] border-[#166534]";
  if (rating >= 5) return "text-[#84cc16] border-[#84cc16]";
  if (rating >= 4) return "text-yellow-400 border-yellow-400";
  if (rating >= 3) return "text-orange-400 border-orange-400";
  if (rating >= 2) return "text-red-500 border-red-500";
  // Was text-neutral-900 — black-on-black, the 0 was literally
  // invisible on dark panels. Light gray reads everywhere.
  return "text-neutral-300 border-neutral-500";
}
