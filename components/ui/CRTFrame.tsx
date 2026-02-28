/**
 * CRTFrame — Wraps page content inside an AWGE-inspired 3D CRT monitor bezel.
 * The content appears as if displayed on an old TV screen, complete with
 * vignette edges and depth shadows.
 */
export default function CRTFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="crt-frame mx-4 md:mx-8 lg:mx-auto crt-flicker">
      <div className="crt-screen">
        {children}
      </div>
    </div>
  );
}
