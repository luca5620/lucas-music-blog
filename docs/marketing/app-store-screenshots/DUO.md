# iPhone Duo screenshots (1.3)

*Written 2026-11-02 (Windows), for after the Duo simulator pass.*

Apple wants two sets: **inner screen 2007×2853** and **outer screen
1398×2034** (portrait). Up to 10 each; they earn the "Made for iPhone
Duo" badge now and are required on every submission from April 2027.

## The plan: same story as the 1.2 set, no AI this time

The 1.2 set (6 iPhone + 1 iPad) already tells the story. The Duo sets
reuse the **same six shots, the same order and the same headlines**, so
the listing reads as one set on every device. The difference: no
ChatGPT/Astra scene and no shots.so frame (shots.so has no Duo frame,
and the AI scene step was the slow, drifty part). Instead Claude
composes each one in code:

- background = the site's own liquid colours from that shot's cover
  (same idea as the share cards), not an AI plate;
- the REAL simulator screenshot, pixel-exact, in a plain rounded
  device outline drawn in code (no Apple product art needed);
- headline set with the bundled fonts (Chakra Petch + Inter), exact
  size, JPEG, no alpha.

Why this one: the simulator already gives the exact pixel size (the
inner screen is 669×951 points at 3×, the outer 466×678 at 3×), so the
raw captures can't drift, and it's one session of capturing from you +
one of composing from Claude — no back-and-forth with an image tool.

Fallback if you'd rather ship fast: upload the raw captures as they
are (they're already the right size). Fine for Apple, plainer to look at.

## Your part (MacBook, ~25 min)

1. `npm run mobile:ios` → device menu → **iPhone Duo** (needs Xcode
   27.1+) → Run. Log in as **luca**, **Settings → Low detail mode OFF**.
2. Clean status bar:
   ```bash
   xcrun simctl status_bar booted override --time 9:41 --batteryState charged --batteryLevel 100 --cellularMode active --cellularBars 4 --wifiMode active --wifiBars 3 --dataNetwork wifi
   ```
3. **Unfolded (inner screen), portrait.** For each shot get the screen
   right, then:
   ```bash
   xcrun simctl io booted screenshot docs/marketing/app-store-screenshots/input/duo-inner-01-aux-wars.png
   ```
   Change the name each time (`duo-inner-01` … `duo-inner-06`).
4. **Fold it** (Device Hub → fold), run step 2 again if the bar resets,
   and take the same six as `duo-outer-01` … `duo-outer-06`.
5. Check each file's size: inner = 2007×2853, outer = 1398×2034
   (`sips -g pixelWidth -g pixelHeight <file>`). If a shot came out
   sideways, the screen was rotated — rotate back and retake.
6. Push nothing (the folder is gitignored). Zip `input/` and get it to
   Windows (AirDrop/Drive), or run the composing on the Mac — tell
   Claude which.

| # | Name | Screen | Must be on screen |
|---|---|---|---|
| 01 | aux-wars | Aux Wars room | the staged room (staff menu → "Staged Aux War · App Store") at voting, not 50/50 |
| 02 | review | Review page | big recognisable record, whole cover in frame, rating + reviewer + date |
| 03 | countdown | Upcoming release page | countdown running, cover large |
| 04 | profile | Your profile | banner, avatar, numbers, The Log, top of the grid |
| 05 | your-taste | Your Taste | one full-screen card, review readable |
| 06 | social | Social | the friends-this-week board filled in (or home at the top) |

Before every capture: no keyboard, no half-loaded covers, no toast, no
email address, **no Christmas look in the store shots** — the snow and
lights end Dec 30 but the screenshots stay up for months. Claude can
add a one-time `?noseason` switch for capturing if needed; ask first.

## Claude's part

Compose the 12 finished JPEGs from `input/` (script goes in `tools/`,
like `finish2.py`), show them to you, then you drag them into App Store
Connect → 1.3 → iPhone Duo (inner) and (outer).
