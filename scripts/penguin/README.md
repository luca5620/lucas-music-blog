# Penguin render pipeline

Requires Blender **4.5.9 LTS** (this machine: `../tools/blender-4.5.9-windows-x64/blender.exe`)
and a Python with **Pillow** (`py -m pip install pillow`).
From the repository root:

```sh
blender --background --python scripts/penguin/render.py -- --header-only
py scripts/penguin/pack.py
```

`--poster-only` renders just frame 1 for a fast character/lighting check;
without either flag the renderer also renders the splash range (31–73),
which is only worth doing once the character is approved. `--samples=N`
sets the poster budget (default 160; the 96px header frames take a
quarter of it). `--nofur` skips every coat — a debugging aid, because
with the fur on you cannot see what the meshes are doing.

The script builds the scene, saves `assets/penguin/penguin.blend`,
exports `penguin.glb` with the animated object controls, and renders
numbered transparent PNGs into ignored `assets/penguin/frames/`. Open
the blend to inspect the named head, flipper, headphone and landing
controls. Add future gestures by keying those controls; the original
image is a visual reference, never a billboard texture.

## The coat

The down is **real hair** — Cycles curves under a Principled Hair
shader, one system per colour region, with the region painted as a
vertex group so the boundary feathers instead of cutting. Two Blender
traps are load-bearing and cost a full round of renders each:

* `ParticleSettings.material` is **one-based**. Slot 0 is index 1. A
  fur system pointed at the wrong number renders in the *skin*
  material, which is what made the first attempt look like smooth
  plastic.
* `factor_random` is in emitter **velocity** units, not a fraction of
  the hair length. `0.45` there grows half-unit hairs and the bird
  vanishes inside a cotton ball.

The eyes and the beak sit in deliberately **bald** zones (see `bald()`)
so they read; without them the coat swallows the face.

## What ships

Frames are **3:4 portrait**, because the mark is a whole standing bird
and a square wastes a third of its pixels on empty sides. Header frames
are a single lossless WebP sprite sheet; CSS steps through 22 poses in
700ms, which allows instant cancellation for the motion policies (an
animated image decoder cannot be cancelled). There is no 3-D runtime on
the site. Poster variants total at most 25,000 bytes and the header
sheet at most 120,000 bytes; packing fails when either budget is
exceeded. Inspect `assets/penguin/header-28px.png` after every
animation edit — it shows every pose at the real header size on the
real black.

Keep the canonical `public/penguin-logo.png` until the owner approves
the replacement render for auth, social cards and native icons. The new
header no longer requests that original 860KB file.

The `.blend` and the `.glb` are build output (git-ignored): `render.py`
rebuilds both in about half a minute, so the script is the model of
record, not a binary nobody can diff.
