/**
 * CRTShell — the frame every page renders inside.
 * A slim plastic bezel around a true-black screen, with the classic
 * game-disc-box spine down the left: vertical "Peak Music" in the
 * PlayStation font and the ESRB-style "R for Real" rating badge.
 * The spine hides on phones (see globals.css).
 */
export default function CRTShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="crt-tv">
      {/* Bezel liquid: the same molten light bleeding through the gray
          plastic ring around the screen, so the app's borders are as
          alive as the modules (Luca 2026-08-24). Clipped to the bezel
          radius; .crt-body paints over it, so only the ring — and the
          status-bar band in the app shell — shows the glow. Colors
          ride --liquid-1/2/3, so profile themes recolor it like every
          other liquid layer. */}
      <div className="crt-bezel-liquid" aria-hidden="true">
        <div className="liquid-blob liquid-a w-[340px] h-[340px] -top-24 left-[10%]" />
        <div className="liquid-blob liquid-b w-[300px] h-[300px] -top-20 right-[18%]" />
        <div className="liquid-blob liquid-c w-[320px] h-[320px] top-[14%] -left-28" />
        <div className="liquid-blob liquid-b w-[320px] h-[320px] top-[26%] -right-28" />
        <div className="liquid-blob liquid-a w-[300px] h-[300px] top-[46%] -left-24" />
        <div className="liquid-blob liquid-c w-[300px] h-[300px] top-[58%] -right-24" />
        <div className="liquid-blob liquid-b w-[320px] h-[320px] top-[76%] -left-28" />
        <div className="liquid-blob liquid-a w-[300px] h-[300px] top-[88%] -right-24" />
        <div className="liquid-blob liquid-c w-[320px] h-[320px] -bottom-24 left-[22%]" />
      </div>
      <div className="crt-body">
        {/* Left spine — the disc-box edge */}
        <div className="crt-spine" aria-hidden="true">
          <span className="crt-spine-brand">Peak Music</span>
          <div className="crt-spine-rating">
            <span className="crt-rating-letter">R</span>
            <span className="crt-rating-text">Real</span>
          </div>
        </div>

        {/* The screen — all site content */}
        <div className="crt-screen">
          {/* Site-wide liquid wash: molten light drifting on the black
              canvas behind everything, spread down the full page */}
          <div className="crt-liquid" aria-hidden="true">
            <div className="liquid-blob liquid-a w-[560px] h-[560px] -top-40 -left-32" />
            <div className="liquid-blob liquid-c w-[500px] h-[500px] top-[10%] left-1/3" />
            <div className="liquid-blob liquid-b w-[480px] h-[480px] top-[22%] -right-40" />
            <div className="liquid-blob liquid-a w-[520px] h-[520px] top-[38%] left-1/2" />
            <div className="liquid-blob liquid-c w-[520px] h-[520px] top-[48%] -left-44" />
            <div className="liquid-blob liquid-b w-[500px] h-[500px] top-[62%] left-1/4" />
            <div className="liquid-blob liquid-a w-[460px] h-[460px] top-[72%] -right-32" />
            <div className="liquid-blob liquid-b w-[500px] h-[500px] -bottom-40 left-1/4" />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
