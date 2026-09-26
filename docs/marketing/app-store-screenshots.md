# App Store screenshots — the 1.2 set (written 2026-09-25)

Six iPhone screenshots + one iPad. Same method as Instagram
(`instagram-batch-1.md`): **AI never draws the product and never draws
lettering.** Real screenshot → shots.so device mockup → Astra builds the
scene AROUND the phone → Canva adds the headline in our own type and
exports at the exact Store size.

Order matters: the first three show up in App Store search results
without a tap, so the three things nobody else has go first.

## 1. Capture (Mac simulator, one sitting, ~20 min)

Why the simulator and not your phone: it gives a perfect 9:41 status
bar, the exact Store resolution, and the iPad shot for free. It still
loads the live site, so everything on screen is real data.

1. `npm run mobile:ios` → run on **iPhone 17 Pro Max** (6.9", saves
   1320×2868 — the one iPhone size Apple requires).
2. Clean status bar, in Terminal:
   `xcrun simctl status_override booted --time 9:41 --batteryState charged --batteryLevel 100 --cellularBars 4 --wifiBars 3`
3. Log in as **luca**. **Settings → Performance → Low detail mode OFF**
   (low detail strips the glow and scanlines that make the screens
   look like ours).
4. Take each shot with **Cmd+S** (saves a PNG to the Desktop).

| # | Screen | Exactly what must be on screen |
|---|--------|--------------------------------|
| 1 | **Aux Wars room** | The Bruno Mars vs The Weeknd room from post 10, at the VOTING state: both songs, the vote split NOT 50/50, reactions visible. Take this same moment for Instagram post 10 — one round, both uses. |
| 2 | **Review page** | A review of a big, recognisable record. Cover, rating badge and the first 3–4 lines of the review text. Scrolled so nothing is cut mid-line. |
| 3 | **Countdown release page** | An upcoming album (paste its Spotify link into search if it isn't in yet). Countdown running, cover large. |
| 4 | **Profile in a console theme** | Your profile in **PS2** (the nebula). Banner, avatar, numbers, The Log, top of the review grid. |
| 5 | **Your Taste** | One fullscreen card: cover, rating badge, review readable. |
| 6 | **Social** | "Your Friends This Week" with all three columns filled in. If it's thin, use the home feed scrolled to the top instead. |

Then switch the simulator to **iPad Pro 13-inch** (saves 2064×2752),
same status-bar command, and take:

| iPad | **Home page**, logged in, scrolled to the top — the whole TV frame on screen. |
|------|----|

Before each Cmd+S: no keyboard up, no half-loaded covers, no toast or
banner, no email address visible.

## 2. shots.so

Each screenshot → shots.so → iPhone 17 Pro Max (black), **front-facing,
no tilt**, transparent background, export PNG. Same device and angle
for all six so the strip reads as one set. iPad: iPad Pro, front-facing.

## 3. Astra — one prompt per shot

Attach the shots.so PNG **plus 2 raw screenshots** from the set
(palette reference), then paste the shot's scene paragraph followed by
the style block. Every prompt ends with the style block, unchanged.

### The style block (paste at the end of every prompt)

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
> 9:19.5 (1320×2868); if that ratio isn't available, 9:16 and I'll
> extend the top.

### Scene paragraphs

**1 — Aux Wars.** The phone stands on a dark club floor between two
coloured lights: hard gold from the left, hard crimson from the right,
meeting exactly on the phone. Two coiled aux cables lie on the floor
at its base, their jacks pointing at each other, nearly touching.
Haze in the air catches both beams.

**2 — Review.** The phone leans against a stack of vinyl sleeves on a
dark wooden desk, sleeves blank and unbranded, edges worn. A single
desk lamp glows blue from above. A pair of headphones rests beside it,
cable trailing out of frame.

**3 — Countdown.** The phone stands in darkness in front of a
turntable with its lid up; the platter is empty and the tonearm is
parked, waiting. One narrow blue beam from behind outlines the
turntable's edge. A thin trail of dust hangs in the beam.

**4 — Profile themes.** The phone stands on a black floor inside a
soft cloud of deep indigo and violet light, like a nebula glowing just
behind it, with a few pinpoint silver sparkles drifting in the air.
The light spills onto the floor as a purple reflection.

**5 — Your Taste.** The phone lies at a slight angle on a dark
surface covered in loose, blank, unbranded CD cases and a few bare
discs, their rainbow undersides catching the blue light. Only the
area around the phone is in focus.

**6 — Social.** The phone stands on a dark table with the soft,
out-of-focus glow of three other phone screens behind it at different
distances — just blue rectangles of light in the dark, no content
visible on them. Warm off-white bokeh in the far background.

**iPad.** The iPad stands on a dark desk against a black wall, one
hard blue light from above, a pair of headphones and a single blank
vinyl sleeve beside it. Same style block, but: iPad instead of phone,
and the ratio is **3:4 portrait (2064×2752)**.

## 4. Canva — headline + export

Custom size **1320 × 2868** (iPad: **2064 × 2752**). Drop the Astra
image in, fill the canvas. Headline in the top third, centred:
line 1 in **Chakra Petch Bold, electric blue #1e90ff**, line 2 in
**Inter Semibold, off-white #e8e6e3**, uppercase line 1 only.

| # | Line 1 (blue) | Line 2 (white) |
|---|---------------|----------------|
| 1 | SONG VS SONG | Start an Aux War. Let the room vote. |
| 2 | RATE IT | Review every album you hear. |
| 3 | WAITING ON AN ALBUM? | Count down with everyone else. |
| 4 | YOUR PROFILE | Pick a console. Make it yours. |
| 5 | YOUR TASTE | Find your next favorite record. |
| 6 | YOUR FRIENDS | See who's winning this week. |
| iPad | YOUR MUSIC, | on the big screen. |

Export **JPG, quality 100** — Store screenshots can't carry
transparency, and a PNG with alpha is rejected on upload.

Apple's rules this respects: real app screens only, no ranking claims
("#1", "best"), no other app's name, no prices.

## 5. Upload

App Store Connect → 1.2 → iPhone 6.9" Display: the six in order 1–6.
iPad 13" Display: the one. The older 1.1 screenshots come off.
