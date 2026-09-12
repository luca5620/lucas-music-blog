/** 12400 → "12.4K", 1200000 → "1.2M" — profile numbers stay one word
    (the stats strip, the hover card). Under 1000 prints as-is. */
export function compactCount(n: number): string {
  const safe = Math.max(0, Math.floor(n));
  if (safe < 1000) return String(safe);
  if (safe < 1_000_000) {
    return `${(safe / 1000).toFixed(safe < 10_000 ? 1 : 0).replace(/\.0$/, "")}K`;
  }
  return `${(safe / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}
