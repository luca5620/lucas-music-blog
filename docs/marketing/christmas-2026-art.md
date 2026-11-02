# Christmas 2026 — generated art for the site theme

Luca, 2026-11-02: the Santa hat and the gift should be generated (ChatGPT /
Astra) "to complete" the theme, instead of the hand-drawn SVG versions that
shipped first. Three images, all **transparent-background PNGs**. When they
come back, Claude drops them in and swaps out the drawings — the theme code
(lib/season.ts, globals.css "CHRISTMAS 2026") stays the same.

**Why the hat is generated ALONE, not on the penguin:** generators redraw
whatever they're given, so "the penguin wearing a Santa hat" comes back with
a subtly different face and headphones. A hat-only image is laid over the
REAL penguin, works at every size (44px header, sign-in page) and moves with
the tap animation.

Where they go when done (Claude does this):
- `public/seasonal/santa-hat.png` → `.penguin-santa` in PenguinMark.tsx
- `public/seasonal/gift-bow.png` → the bow on the Rewind card (RewindPrompt.tsx)
- `public/seasonal/gift-ribbon.png` → the ribbon bands on the Rewind card

---

## 1. Santa hat

**Attach:** `public/penguin-logo.png` (or `public/penguin/mark-768.webp`) —
for scale, lighting and style only.

> Generate ONLY a Santa hat, as a PNG with a fully transparent background —
> no penguin, no head, no shadow on the ground, nothing else in the image.
> It must look like it belongs on the attached penguin mascot: the same
> realistic, soft, photographic plush style and the same soft front lighting.
> Classic red velvet Santa hat with a thick fluffy white fur brim and a white
> pompom; seen from the front at eye level, as if worn straight on a head
> facing the camera, tipped very slightly back, with the tip flopping down to
> the viewer's RIGHT so the pompom hangs beside the brim. The brim's
> underside should be a gentle curve that would sit snugly on a round head
> about as wide as the brim. Natural fabric folds, subtle shading, crisp clean
> edges against the transparent background. No text, no logos. Square
> 1024×1024, the hat centered and filling about 80% of the width.

If the background comes back white or checkered instead of truly
transparent, ask: "same image, but export it as a PNG with a real alpha
transparent background."

## 2. Gift bow

> Generate ONLY a red satin gift bow, as a PNG with a fully transparent
> background — no box, no ribbon running off it, no shadow. Seen straight
> from the front. Two full rounded loops left and right, a neat knot in the
> middle, and two short ribbon tails hanging down with notched (V-cut) ends.
> Deep Christmas red (#c8102e) with soft satin highlights and darker folds,
> photographic and clean, not cartoonish. No text. 1024×640, the bow centered.

## 3. Gift ribbon strip

> Generate a straight horizontal strip of red satin ribbon, as a PNG with a
> fully transparent background. Perfectly straight and level, the same width
> along its whole length, edge to edge across the image, with subtle satin
> sheen and two thin darker lines along the top and bottom edges. It must
> tile seamlessly left-to-right (the left and right edges should match). Same
> red as a classic Christmas gift ribbon (#c8102e). No bow, no knot, no text.
> 1024×96.

---

**After saving:** drop the three PNGs anywhere on the Mac (Downloads is fine)
and tell Claude — it checks they're really transparent, trims and sizes them,
and wires them in.
