# Instagram — batch 1 (rewritten 2026-09-04)

Luca's order: Instagram → TikTok → Meta ads, before the remaining
directories. This file is the paste source for the first eight posts.
Captions are in Luca's voice (direct, normal case, no marketing gloss).
Never "Rate & Review".

**What changed on 2026-09-04 and why.** Luca generated post 1 in
ChatGPT and it read "a little too much AI". It will always read that
way, because a pure text-to-image prompt has nothing real to hold on
to: the model invents a music app that isn't ours — fake UI, fake
album art, garbled text, airbrushed surfaces, everything lit
perfectly. Those are the tells, and no amount of prompt wording
removes them.

So the method changes. **AI never draws the product. AI draws the
room the product is sitting in.** Every image in this batch is a real
screenshot of the real app composited into an AI-generated background
plate. The grid becomes an extension of the work already built
instead of a parallel imaginary version of it.

---

## The method — plate + screenshot

Three steps per image.

1. **Capture** the real screen on the iPhone (master list below —
   capture the whole set once, reuse across posts).
2. **Generate a background plate** in ChatGPT: the environment only.
   No phone, no screen content, no interface, no text. Deliberate
   empty space where the screenshot goes.
3. **Composite** in Canva (or Figma, or any editor): drop the
   screenshot into a device frame, place it in the empty space, add a
   blue glow behind it and a soft shadow under it.

Free device frames: Apple's own Design Resources
(developer.apple.com/design/resources — official iPhone bezels as
PNG), or Canva's "phone mockup" frames. Use a real iPhone frame, not
a generic rounded rectangle.

### The angled phone — posts 3 and 5

The one thing worth taking from Luca's reference is that the device is
a **physical object in the scene**: tilted in three-quarter
perspective, edge and thickness visible, catching light down one
side. That reads as a product photograph. A flat rectangle pasted on
a background reads as a slide.

Two posts in this batch use it — **post 3** (one hero phone, floating)
and **post 5** (three phones staggered in a row, the closest thing to
the reference). Everything else stays straight-on or flat, so the
angle keeps its impact.

Don't ask AI for the angled phone, and don't warp the screenshot by
hand in Canva — hand-warping smears the text and that's the whole
thing we're protecting. Use a mockup generator, which rotates the
device in real 3D while keeping the screenshot pixel-accurate:

- **shots.so** — free tier, best angles, exports transparent PNG
- **previewed.app** / **appmockup.com** — free, App-Store-shaped
  angled devices, also transparent PNG
- **Rotato** — paid, nicest output, has a trial

Flow: upload the real screenshot → pick an iPhone at a three-quarter
angle → turn the background off so it exports as a transparent PNG →
drop that PNG onto the AI plate in Canva → add the blue glow behind
it and a shadow beneath it.

### Screenshots only go in phone-shaped frames

Learned the hard way on 2026-09-04: the first version of post 1 put
the home feed inside a CRT television, and it looked wrong. A
portrait phone screenshot forced into a 4:3 tube is stretched or
letterboxed no matter what, the interface reads as the wrong shape,
and the generated set's brand badge and knob labels garble into
nonsense. The CRT is our design language *inside* the app; it is not
a container for a photo of the app. **Screenshots go in phone frames.
Nothing else.**

**The one rule: the light has to agree.** If the plate is lit hard
from the left, the phone's rim light goes down its left edge and its
shadow falls to the right. A shadow pointing the wrong way gives away
a composite faster than anything else in the image. Every plate
prompt below says where its light comes from — match it.

### The flow that actually worked (validated 2026-09-04)

Luca ran post 1 this way and it came out right, so this is the
method now — it beats the three-step version above:

1. **Screenshot → shots.so.** Build the device mockup first (he used
   an iPhone 17), so the screenshot is already sitting in a real
   phone at a real angle with correct glass and edges.
2. **Hand the finished mockup to ChatGPT** as an attachment, with the
   scene prompt, and tell it plainly **not to change the phone or
   anything on its screen** — only to build the world around it.
3. It places the mockup into the generated scene and lights it.

That works because the model is being asked to composite an object it
can see, not to imagine an interface. The screen survives. Check the
ratings and the tab bar labels on the way out anyway — when it does
drift, it drifts subtly.

Keep the empty-screen plate version below in your pocket for any
scene where this drifts, or where you want the screen brighter than
the model will render it.

### Why not let ChatGPT do the compositing from scratch

You can attach the screenshot and ask it to build the scene around it
— each post below has a one-shot prompt for that. But GPT Image
**redraws** what you attach: our UI comes back close but wrong, text
garbles, ratings turn into nonsense numbers. Use the one-shot version
only where the phone is small, tilted, or partly out of frame. Any
time the screen is meant to be readable, composite it yourself. It
takes two minutes and it is the difference between "an app" and "our
app".

### Always attach reference screenshots

Even for a plate with no phone in it, attach 2–3 real screenshots to
the ChatGPT message and say so in the prompt. It is the fastest way
to get the palette, the black, the blue and the grain right without
describing them three times. Every prompt below ends with the style
block, and the style block does this.

### The style block — paste at the end of every prompt

> Match the palette, texture and mood of the attached screenshots.
> Palette: true black background (#000000), electric blue glow
> (#1e90ff), warm off-white (#e8e6e3), chrome and glass accents.
> Texture: fine CRT scanlines, light film grain, slight VHS colour
> bleed at the frame edges. Lighting: one hard blue source, deep
> falloff, real shadows. Photographic — 50mm lens, shallow depth of
> field, visible dust and fingerprints, imperfect. Not a 3D render,
> not an illustration, no glossy stock-photo cleanliness. Do not
> invent any app interface, screen content or user interface
> elements. No text of any kind, no watermarks, no logos. 4:5
> portrait, 1080x1350.

The load-bearing lines are "do not invent any app interface" and "not
a 3D render". Those two kill most of the AI look on their own.

### Carousels

Slide 1 is the composite (the scroll-stopper). Slides 2–3 are **raw
screenshots, untouched** — full bleed, no frame, no AI. Product shots
convert; mood images only earn the tap. Every post below is a
carousel unless it says otherwise.

---

## Master screenshot list — capture once, reuse everywhere

Before capturing: **Settings → Performance → turn full effects ON**
(low detail is the default now, and it strips the glow and the
scanlines that make our screens look like ours). Clear notification
banners, use a clean account with a real-looking library, and check
that no personal email or real username is visible.

| Screen | Where | State to capture |
|--------|-------|------------------|
| **The home feed** | Home tab, logged in | Scrolled to the top, feed covers and ratings visible |
| **The countdown page** | A release page for an upcoming album | Countdown running, cover large |
| **The live room** | The room on a release page | Chat mid-conversation, LIVE badge and presence pile visible |
| **The unreleased grid** | /releases | Unreleased filter chip ON, full grid of unreleased records |
| **The debate page** | Any debate | Both covers, the VS, vote bar split — not 50/50 |
| **The Your Taste card** | /your-taste | One fullscreen card, rating badge and review readable |
| **The PS2 profile** | Your profile, PS2 theme | Nebula backdrop, full page |
| **The Xbox OG profile** | Your profile, Xbox OG theme | Green on black, full page |
| **The light-theme profile** | Your profile, Wii or LimeWire | The bright one, for contrast |
| **The review page** | A review of a big release | Rating badge + the first lines of the review |
| **The unknown-artist review** | A review of someone nobody's heard of | Same crop, same zoom as the review page above |
| **The rating sheet** | Mid-rating on any record | The "two taps" moment |
| **The list page** | Any list | Ranked covers |

The three profile shots are three theme switches on your own profile —
switch, screenshot, switch back. The review page and the
unknown-artist review have to be framed identically; the whole point
of post 7 is that the two pages are the same page.

### Status — week 1, shot on 2026-09-04

- **The home feed — good, use as-is.** Density and ratings read well.
- **The countdown page (Pylon) — good, one reshoot pending.** "1 here"
  and "No reviews yet" are both in frame, and together they read
  quiet. Crop below the cover, or reshoot near the drop so the
  countdown reads hours rather than 13 days.
- **The live room — rejected.** One message, "1 HERE", 60% empty
  black. The picture argued against the caption. Post 3 was
  restructured around the countdown instead, and the room moved to
  the **Pylon drop, 18 September 2026** — get four or five people
  into the room first, then shoot it live.
- **The unreleased grid — the best shot in the batch**, and the whole
  wedge in one image (Carti, Juice WRLD, Young Nudy, Kendrick, Uzi,
  Kanye, Ariana, d4vd). Two fixes before use: it was captured
  mid-scroll so the status bar sits on the filter chips — scroll to
  the very top — and 11 of 12 tiles read UNRATED, which looks like an
  empty catalog. Rate five or six first, then reshoot.
- **The review page — use the MF DOOM one.** 9.6, readable review
  text, and "review by slim", a reviewer who isn't Luca, which is the
  social proof. Back off about 150px so the status bar isn't sitting
  on the artwork. The House of Balloons alternative was dropped: no
  review text in frame, and the cover is an implied nude that
  Instagram removes posts over.

Album art in these shots is fine for Instagram — it's our own product
UI. It is a different bar for the App Store, where Apple expects
rights to third-party content shown in a listing. Plan around it when
the 1.1.1 set gets made; it doesn't affect this batch.

---

## Profile

- **Handle:** @peakmusicreviews
- **Name field:** Peak Music Reviews — this field is keyword-indexed
  by Instagram search, so it carries "music reviews" for us. Don't
  put a slogan here.
- **Bio** (150 char limit):

  > every album. every leak. every argument.
  > Rate 0–10 · live rooms on release night · debates
  > Free. Web + iOS ↓

  Same opening line as post 1 and the homepage, so the ad, the bio
  and the door all say one thing. Lowercase on the tagline is
  deliberate.

- **Link:** peakmusicreviews.com
- **Category:** Music / App Page.
- **Pinned:** posts 1, 3 and 2 (intro, release night, unreleased).

## Hashtag set (rotate 10–15 per post, never the same 30)

#musicreviews #albumreview #albumrating #letterboxdformusic
#musicboard #musicapp #newmusic #musiccommunity #unreleasedmusic
#leakedmusic #releaseday #albumoftheyear #musicdebate #hiphopheads
#popheads #indiemusic #musicnerd #rateyourmusic #musicsocial
#musicdiscovery #vinylcommunity #musictaste #albumranking

---

## Post 1 — the introduction

**Use:** the home feed, in the phone standing in the snow. Slides 2–3:
the home feed raw, then the review page raw.
**Attach to ChatGPT:** `public/penguin-logo.png` (the mascot) and the
home feed.

This is the mascot post, and it's the account's face. One subject, a
lot of empty sky, nothing cluttering it. Simple reads as confident;
busy reads as a vibecoded app trying too hard.

**This post does not use the style block.** It's a daylight scene, not
a black room — the style block's true black and CRT scanlines would
fight it. The palette comes free: Antarctic ice is already our blue.
Use the alternate block at the bottom of this post instead.

**Plate prompt:**
A single fluffy baby emperor penguin chick wearing large black padded
over-ear headphones, standing on smooth blue-white Antarctic ice
under a pale overcast sky, photographed at eye level with a long
lens. Standing upright in the snow beside it is a modern black
iPhone, tilted slightly, and its screen is switched off — pure black
glass, completely empty, no interface, no content, no reflected
image. Soft cold daylight, drifting snow in the air, the ice and a
distant ridge falling out of focus behind. Generous empty sky above
the penguin.

**Match the penguin in the attached image exactly** — same species,
same grey down, same black padded over-ear headphones, same
proportions. Photographic wildlife shot, 85mm lens, natural light,
real depth of field, no invented interfaces, no text of any kind, no
watermarks, no logos. 4:5 portrait, 1080x1350.

**Composite:** run the home feed through shots.so as a slightly angled
iPhone, transparent background, and drop it into the scene where the
plate's phone is. Light in this one is flat overcast daylight, so
keep the shadow short and soft and add a faint cool reflection across
the glass — a screen this bright in daylight needs a little haze on
it or it looks pasted.

**If the penguin comes back wrong** (wrong species, no headphones,
cartoon style), regenerate rather than settling — it's the mascot and
people will see it a hundred times. Say *"keep the penguin identical
to the attached photo, change only the scene around it."*

**Caption:**
every album. every leak. every argument.

Rate anything 0 to 10, released or not. Live rooms on release night.
Debates with two sides and a scoreboard.

Free. Web and iOS. Link in bio.

Keep the tagline in lowercase — it's stylized that way on the
homepage and matching it makes the line read as a brand mark instead
of a sentence. The link in bio goes to that same homepage, so the ad
and the door now open with the same words.

**"Letterboxd for music" is retired** (Luca, 2026-09-04). It explains
us in a competitor's terms, and the strategy is that brand names win
this category — borrowing one makes us sound like the clones we're
trying not to be. Don't reintroduce it in TikTok scripts or ad copy.

**Longer version, for when the post gets pinned** — a cold audience
decides in two seconds, but people arriving at a pinned post will
read:

> every album. every leak. every argument.
>
> Rate albums and songs 0 to 10. Write the review. Build the list.
> Follow people whose taste you trust, or whose taste you want to
> argue with.
>
> Then the parts nobody else has: every upcoming album gets a
> countdown and a live room the second it drops, debates have two
> sides and a scoreboard, and unreleased music gets a page like
> anything else.
>
> Free. Web and iOS. Link in bio.

**Alternate style block — daylight scenes only (this post):**

> Photographic, natural light, 85mm lens, shallow depth of field,
> real texture and imperfection. Cold overcast palette: blue-white
> ice, pale grey sky, black. Not a 3D render, not an illustration,
> not a cartoon, no glossy stock-photo cleanliness. Do not invent any
> app interface, screen content or user interface elements. No text
> of any kind, no watermarks, no logos. 4:5 portrait, 1080x1350.

**The mascot is available for other posts too**, but keep it rare —
it's the account's face, not a sticker. Post 8 (the Android testers
ask) is the natural second home for it, since a recruitment post
wants a friendly face. Everything in between stays product-first.

---

## Post 2 — unreleased

**Use:** the unreleased grid. Slides 2–3: the unreleased grid raw,
then the countdown page raw.

**Before anything:** reshoot the unreleased grid — rate five or six
tiles first so it isn't a wall of UNRATED, and capture from the very
top of the page so the status bar isn't sitting on the filter chips.
The screenshot *is* the pitch on this post; the scene is packaging.

**Prep:** run that screenshot through shots.so as an angled iPhone,
transparent background. That mockup PNG is what gets attached — see
"The flow that actually worked".

Two versions were written on 2026-09-04 so Luca could generate both
and pick. **Attach the mockup PNG only** — nothing else. Both prompts
are self-contained; no style block to append.

### Version A — pure product

Cleanest, most professional, almost nothing generated so almost
nothing can go wrong. Slightly generic.

> The attached image is a finished iPhone mockup. Do not change the
> phone, its angle, its frame, or anything on its screen — keep the
> screenshot exactly as provided, pixel for pixel. Build only the
> scene around it.
>
> Place it floating in a deep black void, tilted as it already is, lit
> by a single hard electric-blue light from the upper left. Electric
> blue glow (#1e90ff) blooming softly outward from behind the phone,
> a long soft shadow falling down and to the right, a faint mirror
> reflection of the phone on a black glass floor beneath it, fine
> dust drifting in the light. Everything else falls into true black
> (#000000) with generous empty space above the phone.
>
> Photographic — 50mm lens, shallow depth of field, light film grain,
> real imperfection. Not a 3D render, not an illustration, no glossy
> stock-photo cleanliness. No text of any kind, no watermarks, no
> logos. 4:5 portrait, 1080x1350.

### Version B — the burned CD-R ✅ CHOSEN (Luca, 2026-09-04)

The physical-media version, closest to the site's own language. Luca
generated A, B and C and picked this one. Worth remembering for later
posts: the two versions with a real object in frame both beat the
floating-product one, because the object gives the eye somewhere to
land and the phone reads as a thing in a place rather than a render.

> The attached image is a finished iPhone mockup. Do not change the
> phone, its angle, its frame, or anything on its screen — keep the
> screenshot exactly as provided, pixel for pixel. Build only the
> scene around it.
>
> Place it standing upright on black velvet, propped as if leaning
> against something just out of frame, occupying the right side of
> the picture. On the left, lying on the velvet, is a blank white
> CD-R half out of a cracked jewel case, with handwriting on the disc
> in black marker that is deliberately illegible scrawl. A single
> hard electric-blue light from the upper left, everything else
> falling into true black. Blue rim light down the phone's left edge
> and a long shadow to the right. Heavy film grain, dust on the
> velvet, real fingerprints on the plastic.
>
> Photographic still life — 50mm lens, shallow depth of field,
> cinematic, mysterious. Not a 3D render, not an illustration, no
> glossy stock-photo cleanliness. No readable text anywhere, no
> watermarks, no logos. 4:5 portrait, 1080x1350.

### Version C — the vault

Added 2026-09-04 after Luca preferred B to A in generation: he liked
the physical object, so this is the same family with a more specific
one. An unlabeled external drive is where leak collections actually
live — it's the object that audience owns, which makes the post about
them before it's about us.

> The attached image is a finished iPhone mockup. Do not change the
> phone, its angle, its frame, or anything on its screen — keep the
> screenshot exactly as provided, pixel for pixel. Build only the
> scene around it.
>
> Place it on a dark desk, standing upright and leaning against a
> scuffed black external hard drive that lies on its side. The drive
> is completely blank — no brand, no label, no lettering, no logo
> anywhere on it, just worn plastic and a scratched surface. A
> tangled USB cable coils across the desk in front of them. A single
> hard electric-blue light from the upper left, everything else
> falling into true black. Blue rim light down the phone's left edge
> and a long shadow to the right. Dust on the desk, real fingerprints
> and scuffs on the drive, heavy film grain. Generous empty black
> space above.
>
> Photographic still life — 50mm lens, shallow depth of field,
> cinematic, the feeling of something private. Not a 3D render, not
> an illustration, no glossy stock-photo cleanliness. No readable
> text anywhere, no watermarks, no logos. 4:5 portrait, 1080x1350.

The "completely blank drive" line is load-bearing for the same reason
the CRT failed: any lettering the model invents comes back garbled,
and a nonsense brand name on the hero object kills the shot.

**Caption:**
Every music app pretends leaks don't exist.

Rate the leak next to the official release. Rank the vault. Argue
about which version was better.

Unreleased filter on the whole catalog. Link in bio.

**Hashtags for this post** (the unreleased-leaning half of the set):
#unreleasedmusic #leakedmusic #musicreviews #albumrating #musicapp
#hiphopheads #musiccommunity #musicboard #newmusic #musicnerd
#musicdiscovery #albumreview

**Longer version, if the short one underperforms:**

> Every music app pretends leaks don't exist.
>
> Half your library is snippets, reference tracks, and albums that
> got shelved. You have opinions about them. Nowhere to put them.
>
> Peak catalogs unreleased music by name and metadata only, never
> files, so you can rate the leak next to the official release, rank
> the vault, and argue about which version was better.
>
> There's an Unreleased filter on the whole catalog. Link in bio.

---

## Post 3 — release night

**Use:** the countdown page as slide 1's phone — **angled hero, see
"The angled phone" above.** Slide 2: the countdown page raw, full
bleed. Slide 3: the unreleased grid raw — "here's what's coming".
**Attach to ChatGPT:** the countdown page, the unreleased grid.

This is the hero shot of the batch: one phone tilted in space, lit
blue, floating in a dark room at midnight.

**The post is the countdown, not the room (decided 2026-09-04).**
The room screenshot was rejected — one message and "1 HERE" in an
empty black panel argues against every word of the caption. The
countdown carries the post on its own: it's the anticipation, and
anticipation is what a still image can actually show. **The room gets
its own post after the Pylon drop on 18 September** — get four or
five people in the room first, shoot it live while it's moving, and
run it as the follow-up with a "this is what it looked like" caption.
That post is worth more once it's real than this one is by faking it.

**Prep:** run the countdown page through shots.so as an angled iPhone
(tilt it more than the others — 15–20° — this is the one post where
the device is the hero), transparent background. Attach that mockup
and nothing else.

**Prompt:**

> The attached image is a finished iPhone mockup. Do not change the
> phone, its angle, its frame, or anything on its screen — keep the
> screenshot exactly as provided, pixel for pixel. Build only the
> scene around it.
>
> Place it floating in the middle of a dark bedroom at midnight, seen
> from slightly above and to the left. Hard electric-blue light from
> the upper left washes across an unmade bed and a wall and falls off
> fast into black. Dozens of tiny out-of-focus blue and white light
> points drift upward through the air around the phone like rising
> bokeh, thrown out of focus by the glow coming off the screen. Rim
> light down the phone's left edge, soft shadow falling down and to
> the right. Motion blur in the light points, heavy film grain,
> late-night stillness, nobody in the room.
>
> Photographic, available light, 50mm lens, shallow depth of field,
> real imperfection. Not a 3D render, not an illustration, no glossy
> stock-photo cleanliness. No text of any kind, no watermarks, no
> logos. 4:5 portrait, 1080x1350.

If you can catch the countdown at something dramatic — 00:00:07 — go
back and screenshot that frame first; the whole post is anticipation
and the number carries it.

**Caption:**
Album drops at midnight. Everyone listens alone. Then 40 separate
threads.

Not here. Every upcoming album gets a countdown and a room that opens
before the drop.

Follow a release. Be in the room when it lands. Link in bio.

**Optional first comment** — the screenshot names the record, so
naming it in a comment gives the post something to react to and seeds
the room before the 18th:

> That's Pylon on the screen — beabadoobee, September 18. Room's
> already open.

**Hashtags for this post** (the release-day-leaning half of the set):
#releaseday #newmusic #albumoftheyear #musicreviews #musicapp
#musiccommunity #listeningparty #musicdiscovery #albumreview
#musicnerd #newmusicfriday #musicsocial

---

## Post 4 — debates

**Use:** the debate page in a phone frame, centred. Slides 2–3: the
debate page raw, and a raw shot of the same debate's chat scrolled
down.
**Attach to ChatGPT:** the debate page.

**Plate prompt:**
A black room split down the middle by light: the left half washed in
electric blue, the right half in deep red, the two colours meeting in
a hard vertical seam at the centre. Empty — no objects, no people, no
screens, no text. Smoke or haze catching both beams. The centre seam
has a clear vertical column of empty space running top to bottom.
Photographic, theatrical lighting, high contrast, arcade energy.
+ style block

**Composite:** framed phone showing the debate page standing in the centre column,
straddling the seam so blue lights its left edge and red lights its
right. Don't add a chrome "VS" — the screenshot already has one.

**Caption:**
Blonde or Channel Orange. Pick a side.

Debates on Peak have two sides, a record on each, a live vote, and a
chat where you defend yourself. The scoreboard updates as the room
decides.

Start one about anything. Two albums. Two eras. Two versions of the
same song. Link in bio.

---

## Post 5 — profile themes

**Use:** the three profile shots — PS2, Xbox OG, light theme — as
**three angled phones, see "The angled phone" above.** This is the
post closest to Luca's reference. Slides 2–4: each theme raw, full
bleed. Best carousel in the batch; the themes sell themselves in
screenshots and die in description.
**Attach to ChatGPT:** the three profile shots.

**Plate prompt:**
An empty black studio space: a black brushed-metal floor receding into
darkness, shot from slightly above at eye level with the floor. Hard
electric-blue light from the upper left, dust hanging in the air,
faint reflections on the metal. Nothing is standing on the floor —
the scene is completely empty, no objects, no phones, no screens, no
text. Photographic product still life, deep falloff into black.
+ style block

**Composite:** export the three profile shots from shots.so as three
angled iPhones, same tilt, transparent background. Stand them in a
staggered row with the middle one slightly forward, overlapping a
little, left to right: PS2 nebula, Xbox OG green, then the light
theme last so the row ends bright. Light is upper left, so every phone gets its rim
light on the left edge and its shadow stretching down-right across
the metal — three shadows, all parallel.

**Caption:**
Your profile is a channel, not a form.

Ten themes built from console eras and internet history. PS2 boot
screen. Xbox OG. Xbox 360. PS3. PS4. Wii. LimeWire. Each one recolors
the whole page.

Arrange the blocks you want. Pin a review. Put a song on the door.
Add a playlist. Link in bio.

---

## Post 6 — Your Taste

**Use:** the Your Taste card, screen filling most of the frame.
Slides 2–3: the Your Taste card raw, then a second one on a different
card to show the swipe.
**Attach to ChatGPT:** the Your Taste card.

**Plate prompt:**
A hand holding a modern smartphone vertically at arm's length in a
dark room, shot from the front. The phone screen is switched off and
completely black — no interface, no content, no glare. Blue light
coming from the screen's direction lights the fingers and the edge of
the frame. Everything behind falls into black. Real skin texture,
slight handheld motion. Photographic, available light, shallow depth
of field.
+ style block

**Composite:** drop the Your Taste card into the black screen at full brightness, then
add blue spill onto the fingers so the light matches the screen.

**Caption:**
A feed tuned to you. Not the algorithm.

Your Taste is a fullscreen channel of reviews from people who rate
the way you do. One take at a time, the music playing under it. Swipe
to the next.

Rate a few records and it starts tuning. Link in bio.

---

## Post 7 — small artists

**Use:** the review page (big release) and the unknown-artist review,
side by side. Slides 2–3: both raw.
**Attach to ChatGPT:** the review page, the unknown-artist review.

This one only works with real screenshots. The claim is "these two
pages are identical", and an AI drawing of two album covers proves
nothing.

**Plate prompt:**
A black shelf photographed straight on in a dark room, two identical
empty slots side by side, nothing on the shelf — no objects, no
covers, no screens, no text. Both slots lit by exactly the same
electric-blue light from above so neither is favoured. Dust on the
shelf, real shadows, heavy grain. Photographic still life,
symmetrical, calm.
+ style block

**Composite:** a framed phone in each slot — same size, same angle,
same glow. The symmetry is the message. Big release on the left,
unknown on the right.

**Caption:**
Small artists get the same page as the big drop.

Same rating. Same review. Same live room on release night. If someone
here writes about your record, it sits next to the album of the year,
not under it.

If you make music, get your record on here and send the link to your
people. If you write about music, go find someone nobody has written
about yet. Link in bio.

---

## Post 8 — Android testers

**Use:** the home feed in a phone frame. Slide 2: the home feed raw. A
single image is fine here — it's a recruitment post, not a showcase.
**Attach to ChatGPT:** the home feed.

**Plate prompt:**
An Android phone lying face up on a black desk next to a vintage CRT
television that is switched off, shot from above at an angle. The
phone screen is completely black and empty — no interface, no
content. A small green LED somewhere in frame is the only warm light;
everything else is blue. Cables, dust, a workbench feel, like
something mid-build. Photographic, available light.
+ style block

**Composite:** drop the home feed into the black Android screen. Leave the CRT
dark — the joke is that this one isn't switched on yet.

**Caption:**
Android is in closed testing. We need testers.

iOS is on the App Store. The Android build is done and Google Play
needs a group of testers before it goes public. If you're on Android
and want in first, comment "android" or DM and I'll send the link.

You get the app early. We get to launch. Link in bio.

---

## Post 9 — the room, after the Pylon drop (18 September 2026)

**Use:** a real live room captured on release night, full bleed, no AI
at all. Slide 2: the countdown at 00:00:0x if you catch it. Slide 3: the
release page the morning after with the first ratings on it.

Not a plate post. The whole value is that it's unretouched proof the
room filled up, so it should look like a screenshot, not like an ad.

**Before the drop:** get four or five people into the room — friends,
the r/Musicboard arrivals, anyone from the Discord — and be in there
yourself from a few minutes before midnight. Shoot while the chat is
moving. Ten messages beats one perfect one.

**Caption (draft):**
Pylon dropped at midnight and the room filled up.

This is what release night looks like here. Countdown runs on the
release page, the room opens before the drop, and everyone who
followed it lands in the same chat when it hits. No 40 separate
threads.

Next one's already on the calendar. Follow a release and you'll get
pulled in. Link in bio.

---

## Cadence for the first two weeks

- Week 1: posts 1, 3, 2 (Mon / Wed / Fri). Stories daily: one raw
  screenshot each.
- Week 2: posts 4, 5, 7 (Mon / Wed / Fri). Post 8 whenever the Play
  tester count is low. Post 6 saved for week 3.
- **18 September: post 9**, the night of the Pylon drop, out of
  sequence. It's the only post in the batch that can't be made early,
  so it goes up when it happens.
- Every post: reply to every comment within the first hour. Instagram
  weights early replies.

## Where the App Store reference fits (2026-09-04)

The reference Luca dropped is a competitor's App Store listing:
angled phone mockups on a flat colour ground, big two-line headline
with the first word in an accent colour. Three notes:

- **The angled phone is worth taking, and it's taken** — posts 3 and
  5 use it, built with a mockup generator so the screenshot stays
  pixel-accurate. See "The angled phone" above. Kept to two posts on
  purpose: on a grid where everything else is flat-on or a still
  life, the tilted device is an event. On a grid where every post is
  a floating phone, it's a template.
- **Don't feed the image to ChatGPT.** It's a competitor's marketing
  art — the model will copy their teal-on-charcoal palette and their exact
  composition, which is the one thing the standing naming rule says
  to stay away from. What's useful in it is the *layout*, and layout
  is free: it's the standard App Store screenshot convention, and it
  is described in words in this file already.
- **It belongs on the App Store, not Instagram.** That angled-phone-
  with-headline format is built for a store listing carousel, and new
  screenshots are exactly what 1.1.1 is waiting on. Same method works
  — real screenshot, our palette, headline set in the app's own type
  rather than generated.

## TikTok (next)

The same eight ideas become 15–30 second screen recordings with a
voice line — recordings, not AI images, for the same reason this file
was rewritten. Post 3 (release night) and post 2 (unreleased) first.
Draft scripts come when Luca is ready.
