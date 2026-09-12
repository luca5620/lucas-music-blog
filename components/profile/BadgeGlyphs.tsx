/* ---- Badge glyphs (currentColor) — shared by the badges row, the
   profile stats strip and the hover card. No "use client": these are
   plain SVGs and render on either side. ---- */

export function TrophyGlyph({ className = "w-[18px] h-[18px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M6 2h12v2h3v3c0 2.8-2.1 5.1-4.8 5.4A6 6 0 0 1 13 15.9V18h3v2H8v-2h3v-2.1a6 6 0 0 1-3.2-3.5C5.1 12.1 3 9.8 3 7V4h3V2zm0 4H5v1c0 1.5.9 2.8 2.2 3.3A6 6 0 0 1 6 7V6zm12 0v1c0 1.2-.4 2.3-1.2 3.3C18.1 9.8 19 8.5 19 7V6h-1z" />
    </svg>
  );
}

export function HeartGlyph({ className = "w-[18px] h-[18px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 21s-7.5-4.6-9.6-9.1C.9 8.6 2.6 5 6.2 5c2 0 3.4 1.1 4.3 2.4h3C14.4 6.1 15.8 5 17.8 5c3.6 0 5.3 3.6 3.8 6.9C19.5 16.4 12 21 12 21z" />
    </svg>
  );
}

export function ShieldGlyph({ className = "w-[18px] h-[18px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className={className} aria-hidden>
      <path d="M12 2.5l8 3v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10v-6l8-3z" strokeLinejoin="round" />
      <path d="M8.5 12l2.3 2.3L15.5 9.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
