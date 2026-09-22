"""Generate the splash curtain's frost — real dendrites, not a drawn line.

Luca, 2026-09-21: "the freezing effect does not look good at all, its
just a white line doing a circle, make an actual frosting effect around
the borders, where it looks detailed and have it actually look cold."

So the frost is grown, not stroked. Window frost is DENDRITIC: a stem
strikes inward from the cold edge and throws side branches at a steady
angle, each branch shorter than the last, each throwing its own — the
same rule a few times over is what reads as ice rather than as a
scribble. Around the ferns sits a scatter of hoar crystals (six-armed,
because that is the one thing everyone knows about snowflakes) and a
dusting of frozen specks.

OUTPUT: two SVG tiles, printed as CSS custom properties to paste into
app/globals.css between the GENERATED markers. Tiles, not one big
drawing, because a tile repeats along an edge at its own aspect ratio
on any screen — stretching one drawing to the width of a phone is what
makes frost look like smeared toothpaste. The vertical tile is the
horizontal one transposed, so all four edges are visibly the same ice.

    python3 scripts/build-frost.py           # prints the CSS block

Deterministic: the seed is fixed, so re-running prints the same tiles.
Change SEED for a different snowfall, then paste the new output.
"""
import math
import random

SEED = 20260921
W, H = 300.0, 100.0      # tile user units. H is the band depth; W/H sets
                         # how often the pattern repeats along the edge.
INK = "#dbeeff"          # ice white, a touch blue
BLOOM = "#68aee8"        # the cold halo under it

rnd = random.Random(SEED)
stems: list[list[tuple[float, float]]] = []
twigs: list[list[tuple[float, float]]] = []
crystals: list[list[tuple[float, float]]] = []


def grow(x: float, y: float, ang: float, length: float, depth: int) -> None:
    """One dendrite: walk inward, drifting, feathering as it goes.

    The branches matter more than the stem. Real window frost feathers:
    barbs leave the stem at a near-constant angle, CLOSE together, each
    a little shorter than the one before, so the fern reads as a soft
    plume. Spacing them out instead gives you a bare twig — which is
    what the first attempt at this looked like."""
    pts = [(x, y)]
    steps = max(5, int(length / 2.4))
    step = length / steps
    drift = rnd.uniform(-0.03, 0.03)       # gentle curve, never a straight ruler
    wander = rnd.uniform(0.012, 0.03)      # ...and it wanders as it goes
    barb_ang = math.radians(rnd.uniform(56, 68))   # constant per fern, as in ice
    for i in range(steps):
        ang += drift + rnd.uniform(-wander, wander)
        x += math.cos(ang) * step
        y += math.sin(ang) * step
        pts.append((x, y))
        if depth <= 0 or i < 1 or i >= steps - 1:
            continue
        remaining = 1.0 - i / steps        # barbs shrink toward the tip
        blen = length * 0.19 * remaining * rnd.uniform(0.6, 1.3)
        if blen < 1.3:
            continue
        for side in (-1, 1):
            if rnd.random() < 0.12:        # a few gaps keep it from looking woven
                continue
            a = ang + barb_ang * side + rnd.uniform(-0.16, 0.16)
            bx, by = x + math.cos(a) * blen, y + math.sin(a) * blen
            twigs.append([(x, y), (bx, by)])
            # only the longer barbs carry their own pair, halfway along
            if depth > 1 and blen > 9 and rnd.random() < 0.5:
                mx, my = x + math.cos(a) * blen * 0.5, y + math.sin(a) * blen * 0.5
                for s2 in (-1, 1):
                    a2 = a + barb_ang * s2
                    twigs.append([(mx, my), (mx + math.cos(a2) * blen * 0.42,
                                             my + math.sin(a2) * blen * 0.42)])
    stems.append(pts) if depth == 2 else twigs.append(pts)


def crystal(x: float, y: float, r: float) -> None:
    """A hoar crystal: six arms, each with a small pair of barbs."""
    for k in range(6):
        a = math.radians(60 * k + rnd.uniform(-6, 6))
        tip = (x + math.cos(a) * r, y + math.sin(a) * r)
        crystals.append([(x, y), tip])
        if r > 2.8:
            mid = (x + math.cos(a) * r * 0.55, y + math.sin(a) * r * 0.55)
            for side in (-1, 1):
                b = a + math.radians(55) * side
                crystals.append([mid, (mid[0] + math.cos(b) * r * 0.34,
                                       mid[1] + math.sin(b) * r * 0.34)])


# --- the tile ---------------------------------------------------------
# Frost grows in PATCHES, not in a row. So: a few big ferns at wide,
# uneven spacing, each with a cluster of smaller ones crowding its
# base, then loose hoar in the gaps. Angles vary widely — some ferns
# lie almost along the edge — because a row of identical plumes all
# pointing inward is a feather boa, not ice.
def fern(bx, scale, spread=26):
    grow(bx, rnd.uniform(-2.5, 0.5),
         math.radians(90 + rnd.uniform(-spread, spread)),
         H * scale * rnd.uniform(0.85, 1.15), 2)

for bx in (18.0, 104.0, 196.0, 268.0):           # the big ones, uneven
    bx += rnd.uniform(-12, 12)
    fern(bx, rnd.uniform(0.62, 0.95), 20)
    for _ in range(rnd.randint(2, 4)):           # the crowd at its foot
        fern(bx + rnd.uniform(-34, 34), rnd.uniform(0.13, 0.3), 42)
for _ in range(6):                               # loose ones in the gaps
    fern(rnd.uniform(0, W), rnd.uniform(0.1, 0.24), 48)
for _ in range(11):                              # hoar crystals near the cold edge
    crystal(rnd.uniform(2, W - 2), abs(rnd.gauss(0, 1)) * H * 0.2 + 1.5,
            rnd.uniform(1.4, 3.6))
specks = []


def path_d(polylines, transpose: bool, dp: int = 1) -> str:
    """Polylines → one `d` string, wrapped so the tile repeats seamlessly.

    Anything crossing a side edge is drawn again one tile over; the SVG
    clips it, so the half that left the tile arrives back on the other
    side and the seam disappears."""
    out = []
    for pts in polylines:
        span = [p[0] for p in pts]
        shifts = [0.0]
        if min(span) < 0:
            shifts.append(W)
        if max(span) > W:
            shifts.append(-W)
        for s in shifts:
            moved = [(x + s, y) for x, y in pts]
            if transpose:
                moved = [(y, x) for x, y in moved]
            out.append("M" + "L".join(f"{x:.{dp}f} {y:.{dp}f}" for x, y in moved))
    return "".join(out)


def svg(transpose: bool) -> str:
    """The tile.

    Two things the paths can't do cheaply, feTurbulence does for ~300
    bytes each: a low-frequency PATCH layer (frost never covers glass
    evenly — it blooms in blotches) and a high-frequency GRAIN layer
    (the sugary crystal dust that makes it read as frozen rather than
    drawn). stitchTiles='stitch' is what keeps the noise seamless where
    one tile meets the next. The dendrites then sit on top as the
    structure your eye actually names 'frost'."""
    w, h = (H, W) if transpose else (W, H)
    fade = ("linearGradient" if True else "")
    # the ice thins inward: one gradient, turned to match the edge
    grad = (f"<linearGradient id='f' x1='0' y1='0' x2='{'1' if transpose else '0'}' "
            f"y2='{'0' if transpose else '1'}'>"
            "<stop offset='0' stop-color='#fff' stop-opacity='1'/>"
            "<stop offset='.45' stop-color='#fff' stop-opacity='.55'/>"
            "<stop offset='1' stop-color='#fff' stop-opacity='0'/></linearGradient>"
            "<mask id='m'><rect width='100%' height='100%' fill='url(#f)'/></mask>")
    noise = (
        "<filter id='patch' x='0' y='0' width='100%' height='100%' primitiveUnits='userSpaceOnUse'>"
        "<feTurbulence type='fractalNoise' baseFrequency='.035' numOctaves='3' seed='4' stitchTiles='stitch'/>"
        "<feColorMatrix values='0 0 0 0 .80  0 0 0 0 .89  0 0 0 0 1  1.6 0 0 0 -.62'/></filter>"
        "<filter id='grain' x='0' y='0' width='100%' height='100%' primitiveUnits='userSpaceOnUse'>"
        "<feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' seed='11' stitchTiles='stitch'/>"
        "<feColorMatrix values='0 0 0 0 .88  0 0 0 0 .94  0 0 0 0 1  1.9 0 0 0 -1.15'/></filter>")
    return (
        f"<svg xmlns='http://www.w3.org/2000/svg' width='{w:g}' height='{h:g}' "
        f"viewBox='0 0 {w:g} {h:g}'>"
        f"<defs>{grad}{noise}"
        f"<path id='s' d='{path_d(stems, transpose)}'/>"
        f"<path id='t' d='{path_d(twigs, transpose, 0)}'/>"
        f"<path id='c' d='{path_d(crystals, transpose, 0)}'/>"
        "</defs>"
        "<g mask='url(#m)'>"
        "<rect width='100%' height='100%' filter='url(#patch)' opacity='.3'/>"
        "<rect width='100%' height='100%' filter='url(#grain)' opacity='.32'/>"
        # bloom: a wide, faint pass under the lines, so the ice glows
        # cold without a (costly) CSS blur filter
        f"<g fill='none' stroke='{BLOOM}' stroke-linecap='round' opacity='.34'>"
        "<use href='#s' stroke-width='3'/><use href='#t' stroke-width='1.9'/>"
        "</g>"
        f"<g fill='none' stroke='{INK}' stroke-linecap='round'>"
        "<use href='#s' stroke-width='.72' opacity='.9'/>"
        "<use href='#t' stroke-width='.44' opacity='.7'/>"
        "<use href='#c' stroke-width='.42' opacity='.55'/>"
        "</g>"
        "</g></svg>")


def data_uri(s: str) -> str:
    for a, b in (("<", "%3C"), (">", "%3E"), ("#", "%23"), ('"', "'")):
        s = s.replace(a, b)
    return f'url("data:image/svg+xml,{s}")'


h_uri, v_uri = data_uri(svg(False)), data_uri(svg(True))
print("/* ---- BEGIN GENERATED FROST (scripts/build-frost.py) ---- */")
print(f"  --splash-frost-h: {h_uri};")
print(f"  --splash-frost-v: {v_uri};")
print("/* ---- END GENERATED FROST ---- */")
import sys
print(f"\n/* tile aspect {W/H:.3f}:1 · {len(stems)} stems, {len(twigs)} twigs, "
      f"{len(crystals)} crystal arms, {len(specks)} specks · "
      f"{len(h_uri)//1024}KB each */", file=sys.stderr)
