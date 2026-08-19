/**
 * CRTShell — the television every page renders inside.
 * A slim plastic bezel around a true-black tube. Deliberately
 * unbranded and quiet — the content is the picture.
 */
export default function CRTShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="crt-tv">
      <div className="crt-screen">{children}</div>
    </div>
  );
}
