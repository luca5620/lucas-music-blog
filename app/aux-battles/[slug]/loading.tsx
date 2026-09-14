import ShimmerLines from "@/components/ui/ShimmerLines";

/**
 * The room's loading screen (Luca 2026-09-14: opening a private room
 * "goes black for a second and looks off").
 *
 * The page is force-dynamic and does real work before it can paint —
 * the room, the bracket, the chat backlog, and for a private room the
 * seat check and the code on top. Without a loading.tsx, Next has
 * nothing to show while that runs and the CRT shell sits on an empty
 * black frame. This puts the room's SHAPE there instantly instead:
 * the header, the stage, the chat column. Same skeleton language as
 * the rest of the site, and the real page slots straight into it.
 */
export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Header panel */}
        <section className="panel-xbox-glow p-4 sm:p-5 space-y-3 relative overflow-hidden">
          <span className="block h-3 w-40 rounded bg-bg-elevated animate-pulse" />
          <span className="block h-8 w-2/3 rounded bg-bg-elevated animate-pulse" />
          <span className="block h-3 w-32 rounded bg-bg-elevated animate-pulse" />
          <div className="scan-bar" />
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-5">
          {/* The stage */}
          <section className="panel-xbox p-4 sm:p-6 space-y-4 relative overflow-hidden">
            <span className="block h-3 w-24 rounded bg-bg-elevated animate-pulse" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className="rounded-lg border border-border-subtle bg-black/25 p-3 sm:p-4 space-y-3"
                >
                  <span className="block h-8 w-36 rounded-full bg-bg-elevated animate-pulse" />
                  <span className="block h-[152px] lg:h-[352px] rounded-lg bg-bg-elevated animate-pulse" />
                </div>
              ))}
            </div>
            <div className="scan-bar" />
          </section>

          {/* The chat column */}
          <section className="panel-xbox p-4 sm:p-5 relative overflow-hidden hidden xl:block">
            <ShimmerLines lines={7} />
            <div className="scan-bar" />
          </section>
        </div>
      </div>
    </div>
  );
}
