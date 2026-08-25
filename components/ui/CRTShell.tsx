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
      {/* APP-ONLY (display:none on web): the ONE liquid field for the
          whole app surface. In the shell the screen is transparent
          over the same black, so this layer glows through the borders
          AND behind the modules as a single unbroken wash — no edge
          for a blob to get clipped by (Luca 2026-08-24). Edge blobs
          feed the ring, mid-canvas blobs cover where the old screen
          wash lived. Colors ride --liquid-1/2/3, so profile themes
          recolor it like every other liquid layer.
          THERMAL MODE (2026-08-25): the three biggest mid-canvas
          blobs carry .liquid-still — painted but parked, so the
          alive ring costs a fraction of the GPU (see globals.css). */}
      <div className="crt-bezel-liquid" aria-hidden="true">
        <div className="liquid-blob liquid-a w-[340px] h-[340px] -top-24 left-[10%]" />
        <div className="liquid-blob liquid-b w-[300px] h-[300px] -top-20 right-[18%]" />
        <div className="liquid-blob liquid-c w-[320px] h-[320px] top-[14%] -left-28" />
        <div className="liquid-blob liquid-still liquid-a w-[500px] h-[500px] top-[8%] left-1/3" />
        <div className="liquid-blob liquid-b w-[320px] h-[320px] top-[26%] -right-28" />
        <div className="liquid-blob liquid-still liquid-c w-[480px] h-[480px] top-[36%] left-1/2" />
        <div className="liquid-blob liquid-a w-[300px] h-[300px] top-[46%] -left-24" />
        <div className="liquid-blob liquid-c w-[300px] h-[300px] top-[58%] -right-24" />
        <div className="liquid-blob liquid-still liquid-b w-[480px] h-[480px] top-[64%] left-1/4" />
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
              canvas behind everything, spread down the full page.
              Anchored in vh (NOT %): percentage tops resolve against
              the final page height, so every blob slid down when the
              streamed feeds arrived — Lighthouse scored that as a 0.65
              layout shift on an invisible backdrop. vh offsets never
              move; blobs past a short page's bottom just clip. */}
          <div className="crt-liquid" aria-hidden="true">
            <div className="liquid-blob liquid-a w-[560px] h-[560px] -top-40 -left-32" />
            <div className="liquid-blob liquid-c w-[500px] h-[500px] top-[55vh] left-1/3" />
            <div className="liquid-blob liquid-b w-[480px] h-[480px] top-[115vh] -right-40" />
            <div className="liquid-blob liquid-a w-[520px] h-[520px] top-[190vh] left-1/2" />
            <div className="liquid-blob liquid-c w-[520px] h-[520px] top-[245vh] -left-44" />
            <div className="liquid-blob liquid-b w-[500px] h-[500px] top-[310vh] left-1/4" />
            <div className="liquid-blob liquid-a w-[460px] h-[460px] top-[365vh] -right-32" />
            <div className="liquid-blob liquid-b w-[500px] h-[500px] top-[430vh] left-1/4" />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
