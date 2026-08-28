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
      {/* NO status-bar scrim (Luca 2026-08-28: the solid band read as
          a flat black strip over the liquid). The status-bar zone is
          the same surface as everything else — the wash flows through
          it; scrolled content passes under the clock. */}
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
            {/* md: sizes = DESKTOP PROMINENCE (Luca 2026-08-26, see
                globals.css): the phone-tuned blobs looked lost on a
                monitor, so at md+ every blob grows ~40% and the
                hidden md:block string below doubles the density.
                Phone sizes are untouched — small screens keep the
                exact wash Luca already approved (and mobile web holds
                these still anyway, so no extra GPU cost there). */}
            <div className="liquid-blob liquid-a w-[560px] h-[560px] md:w-[800px] md:h-[800px] -top-40 -left-32" />
            <div className="liquid-blob liquid-c w-[500px] h-[500px] md:w-[720px] md:h-[720px] top-[55vh] left-1/3" />
            <div className="liquid-blob liquid-b w-[480px] h-[480px] md:w-[700px] md:h-[700px] top-[115vh] -right-40" />
            <div className="liquid-blob liquid-a w-[520px] h-[520px] md:w-[760px] md:h-[760px] top-[190vh] left-1/2" />
            <div className="liquid-blob liquid-c w-[520px] h-[520px] md:w-[760px] md:h-[760px] top-[245vh] -left-44" />
            <div className="liquid-blob liquid-b w-[500px] h-[500px] md:w-[720px] md:h-[720px] top-[310vh] left-1/4" />
            <div className="liquid-blob liquid-a w-[460px] h-[460px] md:w-[660px] md:h-[660px] top-[365vh] -right-32" />
            <div className="liquid-blob liquid-b w-[500px] h-[500px] md:w-[720px] md:h-[720px] top-[430vh] left-1/4" />
            {/* Desktop-only fillers, slotted into the vh gaps the
                original string left open. */}
            <div className="liquid-blob liquid-b hidden md:block w-[680px] h-[680px] top-[25vh] right-[12%]" />
            <div className="liquid-blob liquid-a hidden md:block w-[640px] h-[640px] top-[85vh] left-[8%]" />
            <div className="liquid-blob liquid-c hidden md:block w-[700px] h-[700px] top-[155vh] left-[55%]" />
            <div className="liquid-blob liquid-a hidden md:block w-[660px] h-[660px] top-[275vh] right-[5%]" />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
