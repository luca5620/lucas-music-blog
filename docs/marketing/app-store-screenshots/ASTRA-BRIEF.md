# Brief for Astra — Peak Music Reviews App Store screenshots

You are making the seven App Store screenshots for **Peak Music
Reviews**, a music review and social app (think Letterboxd for albums)
whose whole look is physical media: CRT scanlines, VHS, consoles,
vinyl, an electric-blue glow on true black. Read this whole file before
making anything. Where this file and a prompt file disagree, this file
wins.

## The three rules that matter more than anything else

1. **Never change the phone or anything on its screen.** The
   `-mockup.png` files are finished product photos of the real app.
   Every pixel of the screen — text, ratings, covers, tab bar, the
   9:41 status bar — must come out exactly as it went in. Do not
   redraw, restyle, sharpen, re-light, translate or "improve" it. You
   build only the world *around* the device. A screenshot with a
   drifted screen is useless to us, however good the scene is.
2. **Image generation draws no lettering at all.** No words, letters,
   numbers, logos, signage or watermarks anywhere in a generated scene.
   The only text on the finished image is the headline, and you set
   that **in code** with the font files in `fonts/` — never by asking
   the image model to write it.
3. **No people, hands or faces**, and no real album covers, artists or
   brands in the scene. Shot 1 is about Bruno Mars vs The Weeknd, but
   that lives on the phone's screen only; the scene says it with light
   and objects.

## What's in the folder

- `input/NN-name-raw.png` — the raw simulator screenshot. Use it as a
  **reference** for palette and to check the screen didn't drift.
- `input/NN-name-mockup.png` — the same screenshot inside a black
  iPhone (or iPad) frame, transparent background. **This is the object
  you place in the scene.**
- `prompts/NN-name.md` — the scene for that shot.
- `fonts/` — ChakraPetch-Bold.ttf and Inter-SemiBold.ttf (both SIL Open
  Font License).
- `output/` — where the finished files go.

The seven shots, in order:

| # | Input prefix | Prompt | Final size (px) |
|---|---|---|---|
| 1 | `01-aux-wars` | `prompts/01-aux-wars.md` | 1320 × 2868 |
| 2 | `02-review` | `prompts/02-review.md` | 1320 × 2868 |
| 3 | `03-countdown` | `prompts/03-countdown.md` | 1320 × 2868 |
| 4 | `04-profile` | `prompts/04-profile.md` | 1320 × 2868 |
| 5 | `05-your-taste` | `prompts/05-your-taste.md` | 1320 × 2868 |
| 6 | `06-social` | `prompts/06-social.md` | 1320 × 2868 |
| 7 | `07-ipad` | `prompts/07-ipad.md` | 2064 × 2752 |

**Do shot 1 first and show it to Luca before doing the rest.** Only go
on when he says so.

## The pipeline, per shot

### 1. Build the scene around the device

Attach the shot's `-mockup.png` and its `-raw.png` (plus one or two
other `-raw.png` files as palette reference) to the image generation,
and use the prompt file's **Scene** paragraph followed by the **style
block** below, word for word.

### 2. Check the screen before going further

Compare the device screen in what came back against the `-raw.png`.
Look hardest at the small things, because that's where drift hides:
the rating numbers, song and album titles, usernames, the tab bar
labels, 9:41. If **anything** on the screen differs, do not use that
image. Try once more; if it drifts again, use the fallback.

### 2b. Fallback — guaranteed-exact screen

Generate the scene as an **empty plate**: same prompt, but replace the
first sentence of the style block with *"There is no phone in this
image: leave a clear, softly lit empty space where an upright phone
would stand, centred horizontally in the lower two-thirds."* Then, in
code, paste the `-mockup.png` onto the plate at full quality (alpha
composite, no resampling of the screen beyond one clean resize), and
add, under it, a soft contact shadow (black, ~45% opacity, blurred,
slightly wider than the phone) and, behind it, a faint electric-blue
glow (#1e90ff, ~25% opacity, large blur). Match the shadow's direction
to the plate's light source.

### 3. Fit to the exact size

Scale and crop to the final size in the table — **never stretch**.
Keep the device centred horizontally. If the generated image is shorter
than 9:19.5, extend the **top** (it is empty dark space by design) by
outpainting or a matching dark gradient; never crop into the device.
The device should fill roughly the lower 62–68% of the height, with
its bottom edge at least 4% above the bottom of the canvas.

### 4. Set the headline, in code

Use the fonts in `fonts/` (e.g. Pillow `ImageFont.truetype`). Two
lines, centred horizontally, in the top third:

- **Line 1**: `ChakraPetch-Bold.ttf`, **UPPERCASE**, electric blue
  **#1e90ff**, 120 px on iPhone. If it is wider than 1160 px, shrink it
  until it fits. Letter-spacing about +2%. Give it a soft glow: the
  same text blurred ~20 px behind it at ~35% opacity, same blue.
- **Line 2**: `Inter-SemiBold.ttf`, sentence case as written below,
  warm off-white **#e8e6e3**, 64 px on iPhone. Max width 1100 px; wrap
  onto a second line at a natural break if needed (line height 1.25).
- Gap between line 1 and line 2: 36 px.
- The whole block's vertical centre sits at **15% of the canvas
  height**. It must not touch the device; if it would, move it up.
- **iPad**: multiply every size above by 1.56 (width 2064 / 1320),
  max widths 1800 / 1700 px.

Headlines, exactly as written (use the curly apostrophe ’ in shot 6):

| # | Line 1 (blue) | Line 2 (off-white) |
|---|---|---|
| 1 | SONG VS SONG | Start an Aux War. Let the room vote. |
| 2 | RATE IT | Review every album you hear. |
| 3 | WAITING ON AN ALBUM? | Count down with everyone else. |
| 4 | YOUR PROFILE | Pick a console. Make it yours. |
| 5 | YOUR TASTE | Find your next favorite record. |
| 6 | YOUR FRIENDS | See who's winning this week. |
| 7 (iPad) | YOUR MUSIC, | on the big screen. |

If shot 6's screenshot turns out to be the home feed instead of the
Friends board, use: **THE FEED** / *Every review from people you
follow.*

### 5. Export

- **JPEG, quality 95, RGB, no alpha channel, sRGB.** App Store Connect
  rejects any image with transparency.
- Exactly the final size in the table, to the pixel.
- Names: `output/01-aux-wars.jpg`, `output/02-review.jpg` …
  `output/07-ipad.jpg`.

### 6. Hand back

- A **contact sheet**: all seven side by side (small is fine), in order,
  so the set can be judged as a strip — it is shown that way on the
  App Store.
- The seven JPGs, and a zip of them.
- One line per shot: its pixel size, and whether you used step 1 or
  the 2b fallback.

## The style block — end every scene prompt with this, unchanged

> Do not change the phone or anything on its screen in any way — it is
> a finished product photo; build only the scene around it. Keep the
> phone upright, centred horizontally, filling the lower two-thirds of
> the frame. Leave the TOP THIRD of the image as calm, dark, empty
> space with no objects and no detail — a headline will be set there
> later. Match the palette, texture and mood of the attached
> screenshots: true black (#000000), electric blue glow (#1e90ff),
> warm off-white (#e8e6e3), chrome and glass. Fine CRT scanlines,
> light film grain. One hard light source, deep falloff, real shadows.
> Photographic, 50mm lens, shallow depth of field — not a 3D render,
> not an illustration, no stock-photo gloss. Do not invent any app
> interface or screen content. No text, letters, numbers, logos or
> watermarks anywhere. No people, hands or faces. Tall portrait,
> 9:19.5 (1320×2868); if that ratio isn't available, 9:16 and extend
> the top afterwards.

For the iPad (shot 7), swap "phone" for "iPad" throughout and the last
sentence for: *"Portrait, 3:4 (2064×2752)."*

## Consistency across the set

The seven are seen together as one strip. Keep them one family: the
same true-black ground, the same blue, the same grain, the device the
same size and height on every iPhone shot, and the headline in the
same place. Each scene can change its props and its accent light; it
should not change its camera, its darkness or its device position.

## Apple's rules this respects (don't break them)

Real app screens only; no ranking or superlative claims in headlines
("#1", "best app"); no other app's name; no prices; no device other
than the one the screenshot is for.
