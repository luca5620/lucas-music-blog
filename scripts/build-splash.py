"""Rebuild the iOS launch image, and the mascot the web curtain uses.

Luca, 2026-09-21: "I want the splash to look exactly the same as the
old one, the only difference should be that you remove the circle and
just make it the penguin with the bottom fading out. dont change any
of the text color, size or placement, and you can make the penguin
slightly bigger if you want."

So this rebuilds the 1.0 launch image in place rather than designing a
new one:

  * THE WORDMARK IS NOT REDRAWN. Its pixels are lifted verbatim from
    the 1.0 image (scripts/splash-wordmark.png) and pasted back at the
    same coordinates, so colour, size and placement cannot drift by so
    much as a pixel — not this time and not the next time someone runs
    this. For the record, measured off the 1.0 image: the PlayStation
    face at 105px with .015em tracking, ink box 903x74 at y=1684,
    centred. components/ui/SplashCurtain.tsx renders live text at
    exactly those metrics (in vh — see below) so the two are the same
    wordmark; that fit was confirmed by re-rendering it and diffing
    against these very pixels (93% overlap, the rest being antialiasing).
  * THE CIRCLE IS GONE. The 1.0 image held the bird inside a 619px
    disc which carried the grey photo backdrop with it. Here the bird
    is the cut-out (public/penguin/mark-*), free-standing on black,
    with its bottom faded out — the same treatment as the nav mascot.
  * THE BIRD IS 10% BIGGER. Correlating the cut-out against the disc
    put the 1.0 bird at 593px tall, so 652px here. Its head sits within
    20px of where it always did; the extra goes to the fading body.

RESOLUTION: the cut-out ships at 512px tall, which would have to be
upscaled 1.3x at this size. penguin-logo.png is 1024px and is the same
photo the cut-out was made from, so the bird is rebuilt at full size —
that photo's pixels with the cut-out's alpha channel scaled up over
them. A matte can be soft; the feathers can't. (The box below came
from a correlation search, 0.9995.)

    python3 scripts/build-splash.py

Android's splash drawables still carry the 1.0 circle. They are a
different set of aspect ratios and Android is not the build in flight
— see ROADMAP.
"""
from pathlib import Path
from PIL import Image, ImageCms

ROOT = Path(__file__).resolve().parents[1]
IMG = 2732                      # the launch image is a square, shown scaleAspectFill

# ...but it SHIPS at 2400, because iOS pre-renders the launch storyboard
# into a cached image at install time and refuses any launch image whose
# raw bitmap exceeds ~25,000,000 bytes (width x height x 4). 2732 comes
# to 29,855,296 and is rejected: SpringBoard logs "has a bad launch image
# until it is updated" and shows BLACK instead. That is what put a
# second of black at the front of every launch on 2026-09-21 — and it
# was latent long before, hidden by a cached snapshot that an unrelated
# Info.plist edit finally invalidated. 2400 is 23,040,000, ~8% under the
# limit, and only a 1.065x upscale on a 3x phone, so the bird is not
# visibly softer. Composition stays in 2732 units because the wordmark
# is lifted verbatim from the 1.0 image at those coordinates; the whole
# canvas is scaled down once, at the end, which leaves every fraction
# the CSS depends on exactly as it was.
SHIP = 2400

# --- the composition, in launch-image pixels ------------------------
# Divide any of these by IMG for the fraction of the screen HEIGHT they
# occupy, which is what SplashCurtain uses: a square shown aspectFill on
# a portrait phone is scaled by height, so 1px here == (100/2732)vh.
BIRD_H = 652                    # 1.0 had the bird at 593; +10%
BIRD_BOTTOM = 1600              # where the fade reaches nothing
FADE_FROM = 0.78                # alpha 1 -> 0 across the last 22%
WORDMARK_AT = (908, 1678)       # top-left of the lifted strip

# The bird inside penguin-logo.png (left, top, width, height).
BIRD_IN_LOGO = (71, 46, 881, 978)


def cutout() -> Image.Image:
    """The mascot at full photographic resolution: the 1024px photo's
    pixels wearing the 512px cut-out's alpha."""
    logo = Image.open(ROOT / "public/penguin-logo.png").convert("RGB")
    mark = Image.open(ROOT / "public/penguin/mark-512.webp").convert("RGBA")
    x, y, w, h = BIRD_IN_LOGO
    rgb = logo.crop((x, y, x + w, y + h))
    alpha = mark.split()[-1].resize((w, h), Image.Resampling.LANCZOS)
    out = rgb.convert("RGBA")
    out.putalpha(alpha)
    return out


def faded(bird: Image.Image, height: int) -> Image.Image:
    """Scaled to `height`, with the bottom faded out instead of ending
    on a straight cut. Matches the CSS mask on .splash-penguin:
    linear-gradient(to bottom, #000 FADE_FROM, transparent 100%).

    The ramp is LINEAR in alpha in both places on purpose: a CSS
    gradient from #000 to `transparent` interpolates alpha linearly
    with the colour held at black, so the baked fade and the live one
    are the same fade. Change one, change the other.

    (Written the long way round rather than with split()/putalpha in
    one breath, because `Image.split()` hands back COPIES of the
    channels: the first version of this function faded a throwaway
    band and returned the bird untouched, and the launch image shipped
    with a hard cut across the belly — which is exactly what Luca saw.
    The band is edited and then explicitly put back.)"""
    w = round(bird.width * height / bird.height)
    b = bird.resize((w, height), Image.Resampling.LANCZOS)
    alpha = b.split()[-1]
    px = alpha.load()
    start = int(height * FADE_FROM)
    for row in range(start, height):
        k = 1.0 - (row - start) / max(1, height - start)
        for col in range(w):
            px[col, row] = int(px[col, row] * k)
    b.putalpha(alpha)
    return b


def main() -> None:
    bird = faded(cutout(), BIRD_H)
    canvas = Image.new("RGB", (IMG, IMG), (0, 0, 0))
    canvas.paste(bird, ((IMG - bird.width) // 2, BIRD_BOTTOM - BIRD_H), bird)

    word = Image.open(ROOT / "scripts/splash-wordmark.png").convert("RGB")
    canvas.paste(word, WORDMARK_AT)

    shipped = canvas.resize((SHIP, SHIP), Image.Resampling.LANCZOS)
    shot = ROOT / "ios/App/App/Assets.xcassets/Splash.imageset"
    for old in shot.glob("*.png"):
        old.unlink()
    # ONE file, no @2x/@3x. The three that used to be here were byte
    # identical, and actool collapsed them into the 3x slot anyway — so
    # every device decoded the full bitmap regardless. A single
    # unscaled ("Universal / single scale") image says what is meant.
    # sRGB is tagged explicitly: an untagged launch image can render
    # slightly different greys from the web curtain drawn next to it.
    srgb = ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes()
    shipped.save(shot / f"splash-{SHIP}x{SHIP}.png", icc_profile=srgb)
    (shot / "Contents.json").write_text(
        '{\n'
        '  "images" : [\n'
        '    {\n'
        f'      "filename" : "splash-{SHIP}x{SHIP}.png",\n'
        '      "idiom" : "universal"\n'
        '    }\n'
        '  ],\n'
        '  "info" : {\n'
        '    "author" : "xcode",\n'
        '    "version" : 1\n'
        '  }\n'
        '}\n')
    print(f"launch image: bird {bird.width}x{bird.height} at "
          f"y {BIRD_BOTTOM - BIRD_H}..{BIRD_BOTTOM}, wordmark untouched; "
          f"shipped at {SHIP}x{SHIP} ({SHIP*SHIP*4/1e6:.1f}MB decoded)")

    # The curtain draws the same bird live, so it needs a source big
    # enough not to be the softer of the two at handoff: 208pt tall on
    # a 3x phone is ~626px.
    full = cutout()
    web = ROOT / "public/penguin/mark-768.webp"
    full.resize((round(full.width * 768 / full.height), 768),
                Image.Resampling.LANCZOS).save(web, quality=86, method=6)
    print(f"{web.name}: {web.stat().st_size // 1024}KB")

    print("\nthe numbers app/globals.css must keep in step (1px here = %.6gvh):" % (100 / IMG))
    for label, px in (("penguin height", BIRD_H), ("penguin top", BIRD_BOTTOM - BIRD_H),
                      ("penguin bottom", BIRD_BOTTOM)):
        print(f"  {label:<16} {px:>5}px  {px / IMG * 100:8.3f}vh")
    print(f"  wordmark         105px  {105 / IMG * 100:8.3f}vh font-size, .015em tracking")
    print(f"  wordmark ink top 1684px {1684 / IMG * 100:8.3f}vh")


if __name__ == "__main__":
    main()
