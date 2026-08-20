/**
 * LiquidAtmosphere — monopo's molten light: three blurred blobs of
 * sage green, molten amber, and deep oxblood drifting slowly behind
 * content. Pure CSS (see CHROME DISC + LIQUID LIGHT in globals.css),
 * transform-only animation, always aria-hidden.
 *
 * Sits at -z behind content, so the PARENT must carry
 * `relative isolate` (same pattern as ThemeBackdrop) — without
 * `isolate` the -z-10 layer can slip behind the parent's background
 * and vanish.
 *
 * Variants:
 *  - "panel": blobs wrap around a contained hero panel
 *  - "page":  blobs concentrated across the top of a full page
 */
export default function LiquidAtmosphere({
  variant = "panel",
}: {
  variant?: "panel" | "page";
}) {
  return (
    <div
      className="absolute inset-0 -z-10 overflow-hidden pointer-events-none"
      aria-hidden="true"
    >
      {variant === "panel" ? (
        <>
          <div className="liquid-blob liquid-a w-[420px] h-[420px] -top-32 -left-24" />
          <div className="liquid-blob liquid-b w-[380px] h-[380px] top-1/3 -right-28" />
          <div className="liquid-blob liquid-c w-[340px] h-[340px] -bottom-28 left-1/4" />
        </>
      ) : (
        <>
          <div className="liquid-blob liquid-a w-[460px] h-[460px] -top-40 -left-28" />
          <div className="liquid-blob liquid-b w-[400px] h-[400px] -top-24 right-[15%]" />
          <div className="liquid-blob liquid-c w-[360px] h-[360px] top-40 left-[35%]" />
        </>
      )}
    </div>
  );
}
