/**
 * LiquidAtmosphere — the flowing pigment-under-glass material behind
 * hero content (see LiquidField + lib/liquidMaterial.ts; this used to
 * be three blurred circles drifting — Astra's handoff 2026-09-11
 * replaced them with one connected field).
 *
 * Sits at -z behind content, so the PARENT must carry
 * `relative isolate` (same pattern as ThemeBackdrop) — without
 * `isolate` the -z-10 layer can slip behind the parent's background
 * and vanish.
 *
 * Variants:
 *  - "panel": the richest expression, boxed inside a hero panel
 *  - "page":  a full-page top wash, veiled so it dissolves toward
 *             the edges instead of ending in a line
 */
import LiquidField from "@/components/ui/LiquidField";

export default function LiquidAtmosphere({
  variant = "panel",
}: {
  variant?: "panel" | "page";
}) {
  return (
    <div
      className={`absolute inset-0 -z-10 overflow-hidden pointer-events-none ${
        variant === "page" ? "liquid-veil" : ""
      }`}
      aria-hidden="true"
    >
      <LiquidField context={variant} />
    </div>
  );
}
