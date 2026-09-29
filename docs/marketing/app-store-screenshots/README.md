# App Store screenshots — the 1.2 set

*Written 2026-09-25 (Windows), turned into this folder 2026-09-28
(MacBook) so Astra can read it and do the making.*

> **✅ DONE 2026-09-28 — all seven made and UPLOADED to App Store
> Connect (1.2).** Steps 1–3 below worked as written. **Step 4 did
> not:** Astra hung "thinking" on the zip + brief. What worked instead
> is in [`tools/README.md`](tools/README.md): Astra makes the scene
> only (one chat, one mockup, one short prompt per shot), and Claude
> finishes each one in code — real screenshot pasted back over the
> phone's screen, headline set with the bundled fonts, exact size,
> JPEG. Also: shots.so's free tier exports 1× only, so the mockups
> were rebuilt at 2× (`tools/rebuild-mockup-2x.py`). Start from
> tools/README.md next time, not ASTRA-BRIEF.md.

**This file is for Luca.** It is the part only a person can do: getting
the real screens. Everything after that is in
[`ASTRA-BRIEF.md`](ASTRA-BRIEF.md), which Astra reads and follows.

Six iPhone shots + one iPad. The same rule as Instagram
(`../instagram-batch-1.md`): **AI never draws the app and never draws
lettering.** Real screenshot → shots.so phone → Astra builds the scene
AROUND the phone → the headline is set with real fonts, in code.

Order matters: the first three show up in App Store search results
without a tap, so the three things nobody else has go first.

```
app-store-screenshots/
├── README.md        ← you are here (your steps)
├── ASTRA-BRIEF.md   ← Astra's instructions: rules, pipeline, headlines, checks
├── prompts/         ← one scene prompt per shot (also paste-ready by hand)
├── fonts/           ← Chakra Petch Bold + Inter SemiBold, for the headlines
├── input/           ← YOU put screenshots here (names below)
└── output/          ← Astra's finished JPGs come back here
```

Screenshots in `input/` and `output/` are gitignored — they are big and
they stay on this Mac. Only the folder's instructions travel.

---

## Step 1 — Set the scene before capturing (5 min)

1. **Play the Aux Wars round first.** Shot 1 is the Bruno Mars vs The
   Weeknd room at the voting state, and it needs other people in it:
   topic `best pop song of the 2010s`, 24K Magic in one seat, Can't
   Feel My Face in the other, a few votes in and **not 50/50**,
   reactions flying. Get two or three friends in. Take the Instagram
   post 10 shots in the same round — one round, both uses.
2. **Check "Your Friends This Week"** has all three columns filled in.
   If it's thin, shot 6 becomes the home feed scrolled to the top.
3. Pick an **upcoming album** for the countdown (paste its Spotify link
   into search if it isn't in the catalog yet).

## Step 2 — Capture in the simulator (~20 min)

Why the simulator and not your phone: a perfect 9:41 status bar, the
exact Store resolution, and the iPad shot for free. It still loads the
live site, so everything on screen is real.

1. `npm run mobile:ios` → in Xcode's device menu pick **iPhone 17 Pro
   Max** (it's under iOS 26.5 — fine, the app supports it) → **Run**.
2. Clean status bar, in Terminal:
   ```bash
   xcrun simctl status_bar booted override --time 9:41 --batteryState charged --batteryLevel 100 --cellularMode active --cellularBars 4 --wifiMode active --wifiBars 3 --dataNetwork wifi
   ```
3. Log in as **luca**. **Settings → Performance → Low detail mode OFF**
   (low detail strips the glow and scanlines that make it look like
   ours).
4. For each shot, get the screen right, then save it straight into
   `input/` with the exact name from the table (this beats Cmd+S —
   Xcode 27 has no separate Simulator app):
   ```bash
   xcrun simctl io booted screenshot docs/marketing/app-store-screenshots/input/01-aux-wars-raw.png
   ```
   Change the file name for each one.

| # | File name | Screen | Exactly what must be on screen |
|---|-----------|--------|--------------------------------|
| 1 | `01-aux-wars-raw.png` | **Aux Wars room** | The Bruno Mars vs The Weeknd room at VOTING: both songs, split not 50/50, reactions visible. |
| 2 | `02-review-raw.png` | **Review page** | A review of a big, recognisable record, **the whole cover in frame** (never cut it), rating badge, reviewer + date, and whatever review text fits below — realistically one line, so pick a review whose FIRST line is a strong sentence on its own. |
| 3 | `03-countdown-raw.png` | **Countdown release page** | An upcoming album, countdown running, cover large. |
| 4 | `04-profile-raw.png` | **Profile, PS2 theme** | The nebula: banner, avatar, numbers, The Log, top of the review grid. |
| 5 | `05-your-taste-raw.png` | **Your Taste** | One fullscreen card: cover, rating badge, review readable. |
| 6 | `06-social-raw.png` | **Your Friends This Week** | All three columns filled (or the home feed at the top). |

Then stop, pick **iPad Pro 13-inch (M5)** in Xcode, Run again, repeat
the status-bar command, log in, and take:

| 7 | `07-ipad-raw.png` | **Home page** | Logged in, scrolled to the top, the whole TV frame on screen. |
|---|---|---|---|

Before every capture: no keyboard up, no half-loaded covers, no toast
or banner, no email address visible.

## Step 3 — shots.so (~10 min)

Each `-raw.png` → shots.so → **iPhone 17 Pro Max, black, front-facing,
no tilt**, background OFF (transparent), export PNG at the **largest
size it offers**. Same device and angle for all six so they read as one
set. The iPad: **iPad Pro, front-facing**. Save each next to its raw
one as `-mockup.png`:

`01-aux-wars-mockup.png`, `02-review-mockup.png` … `07-ipad-mockup.png`

When you're done, `input/` holds **14 files**: seven `-raw`, seven
`-mockup`.

## Step 4 — Hand it to Astra

Zip the folder (it's small without the output):

```bash
cd docs/marketing && zip -r ~/Desktop/app-store-screenshots.zip app-store-screenshots -x "*/output/*"
```

Upload `app-store-screenshots.zip` to Astra and paste this:

> Unzip the attached folder and read `ASTRA-BRIEF.md` first — it is
> your full instructions, and the files in `prompts/` are the scene for
> each shot. My screenshots are in `input/` (a `-raw` and a `-mockup`
> for each of the seven). Follow the brief exactly: build each scene
> around my phone without changing the phone or its screen, set the
> headlines in code with the fonts in `fonts/`, and export to the exact
> App Store sizes. Do shot 1 first and show it to me before doing the
> rest. When all seven are done, show me the contact sheet and give me
> the seven JPGs (and a zip of them).

**Doing shot 1 first on purpose:** if the look is wrong, you fix it
once instead of seven times. Reply with what to change, then "go ahead
with the rest".

If Astra can't take a zip, attach the two files for one shot plus
`ASTRA-BRIEF.md` and that shot's prompt file, and do them one at a
time with the same message.

## Step 5 — Check what comes back (5 min)

Open each JPG next to its `-raw.png` and look for drift — this is where
it goes wrong when it does:
- the **screen** is identical: ratings, song titles, tab bar labels, the
  status bar's 9:41;
- the **headline** is spelled right and nothing else has text on it;
- the size is exact — on the Mac: `sips -g pixelWidth -g pixelHeight output/*.jpg`
  (iPhone **1320 × 2868**, iPad **2064 × 2752**).

Anything off: tell Astra which shot and what, and have it redo just
that one. If the screen keeps drifting, the brief already tells it the
fallback (paste the mockup on in code, pixel for pixel).

## Step 6 — Upload

App Store Connect → version **1.2** → **iPhone 6.9" Display**: the six,
in order 1–6 (drag to reorder). **iPad 13" Display**: the one. Delete
the old 1.1 screenshots from both. Then carry on with the submit steps
in `ROADMAP.md` (SHIPPING 1.2).
