/**
 * CRTShell — the television every page renders inside.
 * Plastic bezel, powered-on tube, OSD channel text, brand chin
 * with a breathing power LED. Replaces the old PS1 case frame.
 */
export default function CRTShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="crt-tv">
      <div className="crt-screen">
        {/* On-screen display — pinned to the tube, not the page */}
        <div className="crt-osd" aria-hidden="true">
          <span className="osd-rec">●</span> CH 03 · PEAK
        </div>
        {children}
      </div>

      {/* Bezel chin: brand + power LED */}
      <div className="crt-chin" aria-hidden="true">
        <span className="crt-brand">PEAK·VISION</span>
        <span className="crt-led" />
      </div>
    </div>
  );
}
