# Carousel kit (Instagram, 1080×1350)

Built 2026-10-22 for the 100-members post (Option A, "CRT channel"
look). Text slides are designed in HTML/CSS with the site's fonts and
real data, then rendered with headless Chrome — never text stamped on
an AI image, never AI-drawn UI.

| File | What it does |
|---|---|
| `app.js` | Real **iPhone app view** screenshots of the live site (390×844 @3x). Fakes the Capacitor bridge so `.native-app` + the app's top bar and tab bar render, and turns Low detail off. Run with `MSYS_NO_PATHCONV=1 node app.js "release=releases/<slug>,home="` in Git Bash. |
| `slides.js` | Slides 2–3: the CRT-channel stats slide and the app-plug slide (phone frame + iOS status bar + App Store badge). Data is hard-coded at the top (`D`) — re-pull it from Supabase each time. |
| `slide1.js` | Slide 1: fits a designed "CH 01" screen into the blank TV screen of a Sol (ChatGPT) photo. Measure the screen rectangle (`S`) for each new photo. |

Setup (one time, in an empty folder outside the repo):
`npm i puppeteer-core@23.11.1`, plus fonts from github.com/google/fonts
(ChakraPetch-Bold, VT323-Regular, Inter, PermanentMarker,
SpecialElite) in a sibling `fonts/` folder. Uses the installed Chrome
at `C:/Program Files/Google/Chrome/Application/chrome.exe` (change on
the Mac). `slide1.js` borrows `sharp` from this repo's node_modules.

Rules: info goes ON the slides (captions don't get read); every
carousel ends on the app-plug slide; Reprised is the community idea
only — never copy their layouts.
