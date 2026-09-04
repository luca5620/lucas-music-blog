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

**The one rule: the light has to agree.** If the plate is lit hard
from the left, the phone's rim light goes down its left edge and its
shadow falls to the right. A shadow pointing the wrong way gives away
a composite faster than anything else in the image. Every plate
prompt below says where its light comes from — match it.

### Why not let ChatGPT do the compositing

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

| # | Screen | State to capture |
|---|--------|------------------|
| S1 | Home, logged in | Feed with covers visible, scrolled to the top |
| S2 | Release page, upcoming album | LiveCountdown running, cover large |
| S3 | Live release room | Chat mid-conversation, LIVE badge + presence pile visible |
| S4 | /releases | Unreleased filter chip ON, grid of unreleased records |
| S5 | Debate page | Both covers, VS, vote bar split (not 50/50) |
| S6 | /your-taste | One fullscreen card, rating badge and review visible |
| S7a | Profile, PS2 theme | Nebula backdrop, full page |
| S7b | Profile, Xbox OG theme | Green on black, full page |
| S7c | Profile, Wii or LimeWire theme | Light theme, for contrast |
| S8 | Review page, big release | Rating badge + first lines of the review |
| S8b | Review page, unknown artist | Same crop, same zoom as S8 |
| S9 | The rating sheet | Mid-rating — the "two taps" moment |
| S10 | A list page | Ranked covers |

S7 needs three theme switches on your own profile — switch,
screenshot, switch back. S8 and S8b must be framed identically; the
whole point of post 7 is that the two pages are the same.

---

## Profile

- **Name:** Peak Music Reviews
- **Bio:** Rate albums, leaks and all. Live rooms on release night. Two-sided debates. Free, web + iOS.
- **Link:** peakmusicreviews.com
- **Pinned:** posts 1, 3 and 2 (intro, release night, unreleased).

## Hashtag set (rotate 10–15 per post, never the same 30)

#musicreviews #albumreview #albumrating #letterboxdformusic
#musicboard #musicapp #newmusic #musiccommunity #unreleasedmusic
#leakedmusic #releaseday #albumoftheyear #musicdebate #hiphopheads
#popheads #indiemusic #musicnerd #rateyourmusic #musicsocial
#musicdiscovery #vinylcommunity #musictaste #albumranking

---

## Post 1 — the introduction

**Use:** S1 inside the CRT screen. Slides 2–3: raw S1, raw S8.
**Attach to ChatGPT:** S1, S8.

This is the signature shot for the account. The whole brand is that
the site lives inside a CRT, so the real app goes inside the tube.

**Plate prompt:**
A vintage 1990s CRT television standing alone on a black void floor,
photographed slightly from below, three-quarter angle. The screen is
switched off and completely empty — a dark curved glass rectangle,
no image, no content, nothing on it. Faint blue light spills from
somewhere off frame onto the plastic housing and the dust on the
bezel. A chrome compact disc leans against the base, catching the
blue. Deep black surroundings, heavy negative space above the set.
Photographic still life.
+ style block

**Composite:** drop S1 into the empty screen, scale to fill the glass,
add a slight barrel warp so it follows the curve, lay a scanline
overlay across it at about 15% opacity, and add a soft blue bloom
spilling past the bezel onto the floor.

**One-shot alternative (screenshot attached):** *Place the attached
phone screenshot onto the screen of a vintage CRT television standing
in a black void. Keep the screenshot exactly as it is — do not
redraw, relabel or reinterpret anything on it. Curve it slightly to
follow the glass and add scanlines over it. Blue light spills onto
the housing. A chrome CD leans against the base.* + style block

**Caption:**
Letterboxd for music. Except this one does leaks.

Rate albums and songs 0 to 10. Write the review. Build the list.
Follow people whose taste you trust, or whose taste you want to argue
with.

Then the parts nobody else has: every upcoming album gets a countdown
and a live room the second it drops, debates have two sides and a
scoreboard, and unreleased music gets a page like anything else.

Free. Web and iOS. Link in bio.

---

## Post 2 — unreleased

**Use:** S4 in a phone frame, leaning in the scene. Slides 2–3: raw
S4, raw S2.
**Attach to ChatGPT:** S4, S2.

**Plate prompt:**
A blank white CD-R in a cracked jewel case lying on black velvet, shot
from directly above, handwriting on the disc in black marker that is
deliberately illegible scrawl. A single hard electric-blue light from
the left, everything else falling into black. Heavy film grain, dust
on the velvet, real fingerprints on the plastic. The right third of
the frame is empty black velvet with nothing on it — leave that space
completely clear. Photographic still life, cinematic, mysterious.
+ style block

**Composite:** stand a framed phone showing S4 in the empty right
third, as if propped against something out of frame. Blue rim light
down its left edge, long shadow to the right.

**One-shot alternative:** attach S4 and add — *stand a modern iPhone
in the empty right third of the scene showing the attached
screenshot, keeping the screenshot exactly as provided.*

**Caption:**
Every music app pretends leaks don't exist.

Half your library is snippets, reference tracks, and albums that got
shelved. You have opinions about them. Nowhere to put them.

Peak catalogs unreleased music by name and metadata only, never files,
so you can rate the leak next to the official release, rank the vault,
and argue about which version was better.

There's an Unreleased filter on the whole catalog. Link in bio.

---

## Post 3 — release night

**Use:** S2 (countdown) as slide 1's phone — **angled hero, see "The
angled phone" above.** Slide 2: raw S3 (the live room). Slide 3: raw
S1.
**Attach to ChatGPT:** S2, S3.

This is the hero shot of the batch: one phone tilted in space, lit
blue, floating in a dark room at midnight.

**Plate prompt:**
A dark bedroom at midnight, seen from slightly above and to the left.
No people, no phone, no screen, no furniture in the centre of the
frame. Hard electric-blue light coming from the upper left, washing
across an unmade bed and a wall and falling off fast into black.
Dozens of tiny out-of-focus blue and white light points drifting
upward through the air like rising bokeh. The centre of the frame is
completely empty dark space — leave it clear, nothing floating in it.
Motion blur in the light points, heavy grain, late-night stillness.
Photographic, available light.
+ style block

**Composite:** export S2 from shots.so as an iPhone at a three-quarter
angle, tilted maybe 15–20°, transparent background. Drop it into the
empty centre so it floats. Light comes from the upper left in this
plate, so: rim light down the phone's left edge, soft shadow falling
down and right, and a blue bloom behind the phone that pushes the
bokeh out of focus around it. If you can catch the countdown at
something dramatic — 00:00:07 — capture that frame.

**Caption:**
Album drops at midnight. Everyone listens alone. Then 40 separate
threads.

Not here. Every upcoming album gets a countdown and a live room that
opens before the drop. When it lands, everyone who followed it is in
one chat, reacting track by track.

Follow a release. Be in the room. Link in bio.

---

## Post 4 — debates

**Use:** S5 in a phone frame, centred. Slides 2–3: raw S5, and a raw
shot of the same debate's chat scrolled down.
**Attach to ChatGPT:** S5.

**Plate prompt:**
A black room split down the middle by light: the left half washed in
electric blue, the right half in deep red, the two colours meeting in
a hard vertical seam at the centre. Empty — no objects, no people, no
screens, no text. Smoke or haze catching both beams. The centre seam
has a clear vertical column of empty space running top to bottom.
Photographic, theatrical lighting, high contrast, arcade energy.
+ style block

**Composite:** framed phone showing S5 standing in the centre column,
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

**Use:** S7a, S7b, S7c as **three angled phones, see "The angled
phone" above** — the post closest to Luca's reference. Slides 2–4:
each theme raw, full bleed. Best carousel in the batch; the themes
sell themselves in screenshots and die in description.
**Attach to ChatGPT:** S7a, S7b, S7c.

**Plate prompt:**
An empty black studio space: a black brushed-metal floor receding into
darkness, shot from slightly above at eye level with the floor. Hard
electric-blue light from the upper left, dust hanging in the air,
faint reflections on the metal. Nothing is standing on the floor —
the scene is completely empty, no objects, no phones, no screens, no
text. Photographic product still life, deep falloff into black.
+ style block

**Composite:** export S7a, S7b, S7c from shots.so as three angled
iPhones, same tilt, transparent background. Stand them in a staggered
row with the middle one slightly forward, overlapping a little, left
to right: indigo nebula, acid green, then the light theme last so the
row ends bright. Light is upper left, so every phone gets its rim
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

**Use:** S6, screen filling most of the frame. Slides 2–3: raw S6, and
a second S6 on a different card to show the swipe.
**Attach to ChatGPT:** S6.

**Plate prompt:**
A hand holding a modern smartphone vertically at arm's length in a
dark room, shot from the front. The phone screen is switched off and
completely black — no interface, no content, no glare. Blue light
coming from the screen's direction lights the fingers and the edge of
the frame. Everything behind falls into black. Real skin texture,
slight handheld motion. Photographic, available light, shallow depth
of field.
+ style block

**Composite:** drop S6 into the black screen at full brightness, then
add blue spill onto the fingers so the light matches the screen.

**Caption:**
A feed tuned to you. Not the algorithm.

Your Taste is a fullscreen channel of reviews from people who rate
the way you do. One take at a time, the music playing under it. Swipe
to the next.

Rate a few records and it starts tuning. Link in bio.

---

## Post 7 — small artists

**Use:** S8 (big release) and S8b (nobody's heard of them), side by
side. Slides 2–3: both raw.
**Attach to ChatGPT:** S8, S8b.

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

**Use:** S1 in a phone frame. Slide 2: raw S1. A single image is fine
here — it's a recruitment post, not a showcase.
**Attach to ChatGPT:** S1.

**Plate prompt:**
An Android phone lying face up on a black desk next to a vintage CRT
television that is switched off, shot from above at an angle. The
phone screen is completely black and empty — no interface, no
content. A small green LED somewhere in frame is the only warm light;
everything else is blue. Cables, dust, a workbench feel, like
something mid-build. Photographic, available light.
+ style block

**Composite:** drop S1 into the black Android screen. Leave the CRT
dark — the joke is that this one isn't switched on yet.

**Caption:**
Android is in closed testing. We need testers.

iOS is on the App Store. The Android build is done and Google Play
needs a group of testers before it goes public. If you're on Android
and want in first, comment "android" or DM and I'll send the link.

You get the app early. We get to launch. Link in bio.

---

## Cadence for the first two weeks

- Week 1: posts 1, 3, 2 (Mon / Wed / Fri). Stories daily: one raw
  screenshot each, a release room when something drops.
- Week 2: posts 4, 5, 7 (Mon / Wed / Fri). Post 8 whenever the Play
  tester count is low. Post 6 saved for week 3.
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
