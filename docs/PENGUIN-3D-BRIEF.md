# GPT-6-Astra handoff: the Peak Music penguin as a real 3-D mascot

*Written 2026-09-15 for Luca. Paste this whole file to Astra as the
brief. It is the third Astra/Fable-style handoff in this repo — the
liquid material (shipped `dcaac13`) is the quality bar.*

---

## Task

Replace the flat penguin picture in the site header with an actual
3-D render of the mascot, give it a small animation that fires on
hover (web) and on tap (app), and build a **separate, longer** one-shot
animation for the mobile app's splash.

Work inside this repository — Next.js 16 App Router, React 19,
Tailwind v4 (CSS-first tokens in `app/globals.css`, there is no
tailwind config), deployed on Vercel from `main`. The iOS and Android
apps are Capacitor shells that load the live site, so **a push to
`main` updates the installed apps too**. Anything that needs Xcode is
a separate, clearly-marked step for the owner's MacBook, and the web
work must ship without it.

Deliver the model, the rendered assets, the integration code and the
re-render pipeline. Do not stop at a proposal, and do not hand back a
still image with a CSS hover-scale on it.

---

## The character — do not redesign it

The mascot already exists and is load-bearing brand: it is the App
Store icon, the favicon, the OG image, the auth screens, and it
appears in the Instagram campaign art.

- Reference: `public/penguin-logo.png` (the canonical mascot).
- The character description used to generate the campaign art is in
  `docs/marketing/instagram-batch-1.md` (see the post-1 prompt): a
  fluffy baby emperor penguin chick wearing large black padded
  headphones.

**Match it exactly**: same species, same chick proportions (big head,
round body, small flippers), same oversized black padded headphones.
A penguin that is merely *a* penguin is a failure of this task — a
returning user must not be able to tell that the mark was rebuilt,
only that it became real. Keep the silhouette close enough that the
new static frame can replace `penguin-logo.png` everywhere, including
at favicon size.

## Art direction

The whole site is skinned as physical media: it renders inside a CRT
television shell, with Xbox-360-blue accents, VHS/OSD typography and
a PlayStation-font wordmark. Read `app/globals.css` and open any page
for the register.

So the render is **a console-era character render**, not a film
still: the mascot as it would appear on the main menu of a 2003
game — a small studio setup, one key light with a soft fill, a gentle
rim light picking out the edge of the head and the headphones,
believable soft materials (down that reads as felt, matte plastic
headphones, a little specular in the eyes), on a clean transparent
background. No photoreal feather grooming, no subsurface-scattering
showcase, no cinematic depth of field.

It must survive being **28 pixels tall**. Silhouette first: check
every pose at 28px before you fall in love with it at 512px. If the
headphones stop reading at that size, the pose is wrong.

The site accent is `#1e90ff`; a cool rim light in that blue is
welcome, an all-over blue wash is not. The mark sits on near-black.
Ship it transparent, never on a plate.

---

## Where it appears

| Surface | File | Rendered size |
| --- | --- | --- |
| Site header (web + app, one component) | `components/ui/Navigation.tsx:96` | `w-7 h-7 sm:w-8 sm:h-8`, rounded-full |
| Auth screens | `components/auth/AuthShell.tsx:105` | 56px, rounded-2xl |
| OG image / schema logo | `app/layout.tsx`, `app/schema.tsx` | 512px static |
| iOS app icon | `ios/App/App/Assets.xcassets/AppIcon.appiconset` | static, Mac step |
| iOS native splash | `ios/App/App/Assets.xcassets/Splash.imageset` | static, Mac step |

The header mark is the primary target. In the current build it sits
at the **left** end of the header row on both web and in the app (the
top-right corner holds the CREATE button and the account avatar); the
owner refers to it as the little picture in the corner of the header.
Put the new mark wherever `penguin-logo.png` is used today — one
component, used everywhere — and do not move, resize or restyle the
header row. The header chrome and the app tab bar are frozen by the
owner: their positions were approved and are not to be touched.

---

## The three animations

**1. The header mark — web.** The default state is a still. On hover
(`@media (hover: hover) and (pointer: fine)`) it plays once, ~700ms,
and settles back on exactly the poster frame: the chick looks up at
the cursor, one flipper flick, a short nod. Re-hovering re-triggers
it; leaving mid-animation returns to the poster without a snap.

**2. The header mark — app.** Same asset, same animation, triggered
on tap (the mark is the Home link, so it plays as the navigation
starts) and paired with `hapticTap()` from `lib/native.ts`, the way
every other app control is.

**3. The splash — mobile only, and it is its own performance.** Not a
longer version of the header loop. ~1.2–1.8s on true black, one shot,
ending on the exact pose of the static mark: the chick lands or fades
in, the headphones settle with a little weight, one beat-nod, and the
"Peak Music Reviews" wordmark in the PlayStation font resolves under
it. No sound.

The native splash stays as it is (Capacitor `SplashScreen`,
`launchShowDuration: 1200`, black, no spinner — `capacitor.config.ts`).
The animated splash is a **web overlay that takes over at first
paint**, so it ships through a normal deploy and needs no app rebuild:

- only inside the app shell (`html.native-app`, set by
  `components/ui/NativeMode.tsx`) — never on the website;
- only on a cold boot, not on every route change;
- it must never delay interactivity: content renders underneath, the
  overlay dismisses itself when the animation ends *or* on any tap,
  whichever comes first, and a failed asset dismisses it immediately
  rather than leaving a black screen. `components/ui/OfflineOverlay.tsx`
  is the existing full-screen-overlay pattern in this codebase.

---

## Hard technical rules

These are the constraints this codebase actually lives under. A
beautiful mascot that breaks one of them gets reverted.

1. **No new 3-D runtime in the bundle.** Do not add three.js,
   react-three-fiber or a glTF loader to the site. The default
   deliverable is **pre-rendered frames** (see Deliverables). The only
   WebGL on the site is `components/ui/LiquidField.tsx` — one shader
   canvas per surface — and the phone thermal budget is already spent
   on it. If you believe a live 3-D mark is genuinely necessary, argue
   it in writing first with a measured bundle and frame cost; do not
   just add it.
2. **Full effects are opt-out, not opt-in.** `html.low-detail` is
   **on by default** for every visitor (`components/ui/LowDetailToggle.tsx`,
   Settings → Performance). The still frame is therefore the mark most
   people will ever see: it has to be excellent on its own, and the
   animation is a bonus for people who turn effects on.
3. **Every new decorative effect needs a matching `.low-detail` rule
   at the END of `app/globals.css`** — a standing rule in this repo.
   Also honour `@media (prefers-reduced-motion: reduce)` and the app's
   sleep state (`.native-app:not(.motion-on)`, driven by
   `NativeMode.tsx`: motion wakes on touch, sleeps after 12s idle).
   The rating-badge animations in `globals.css` are the pattern for
   all three.
4. **Weight.** `public/penguin-logo.png` is 860KB for a 32px mark
   today — fix that while you are in here. Budget: the header's
   animated asset ≤ 120KB across every size you ship, the static
   poster ≤ 25KB, the splash asset ≤ 400KB. Keep one 512px static for
   OG and icons. Everything self-hosted under `public/` — no CDN, no
   external fetch (the app has to be able to show its own splash with
   no connection).
5. **No layout shift.** The mark keeps its exact box and intrinsic
   dimensions, with `width`/`height` attributes on every image
   element. Homepage LCP and CLS are watched here (a previous
   regression scored a 0.65 CLS).
6. **Tailwind v4 gotcha:** the `translate` / `rotate` / `scale`
   utilities are standalone CSS properties, so `transition: transform`
   does not animate them. Write moving styles as plain `transform` in
   `globals.css`. This has bitten this codebase before.
7. **Six languages.** Any user-visible string (alt text, aria labels)
   lives in `messages/{en,es,fr,pt,nl,de}.json` and is read through
   `next-intl` — no hardcoded English.
8. **iOS WKWebView:** if you choose video over frames it must be
   `muted` + `playsinline` + `preload="auto"`, with a PNG poster and a
   real fallback when the codec is unsupported. Animated WebP or APNG
   sequences are preferred precisely because they have no playback
   policy attached.
9. **Verification is `npm run build` plus the dev server.** There is
   no test suite. Lint must stay at 0 errors.

---

## Deliverables

1. **The model.** A Blender scene (`.blend`) plus a `.glb` export,
   rigged enough for the three animations. Committed under
   `assets/penguin/` (source assets — never served to the browser).
2. **A re-render pipeline.** A Blender Python script under
   `scripts/penguin/` that builds or loads the scene and renders each
   animation to a numbered PNG sequence at the sizes we need, plus the
   packing step that turns those frames into the shipped assets. The
   owner must be able to ask for "a new wave animation" later and get
   it without re-modelling. Put the exact commands in a short README
   next to the script.
3. **The shipped assets** in `public/penguin/`: the static poster
   (@1x/@2x/@3x, transparent), the header animation, the splash
   animation, and a 512px static that takes over `penguin-logo.png`'s
   role in OG/schema. State which format you chose and why.
4. **The code.** One `components/ui/PenguinMark.tsx` (poster by
   default, animation on hover/tap, all three motion policies
   honoured), wired into `Navigation.tsx` and `AuthShell.tsx`; one
   splash overlay component gated to `html.native-app`; the CSS in
   `globals.css`, with its `.low-detail`, reduced-motion and
   `.motion-on` lines added to the blocks where those lists already
   live.
5. **Icon and splash stills for the Mac step** (app icon PNG, the
   2732×2732 splash images) as loose files, plus three lines in
   `docs/MACBOOK-IOS-SETUP.md` saying where they go. Do not edit the
   Xcode project.
6. **A ROADMAP.md entry** under a dated Done section describing what
   shipped and what is left for the Mac — that file is the handoff
   between the owner's two machines.

Code in this repo is **heavily commented on purpose** — the owner is
learning from it. Match that density: say why, not what.

---

## Acceptance criteria

- `npm run build` passes; `npm run lint` reports 0 errors.
- With low-detail ON (the default) the header shows a still 3-D
  penguin and nothing animates anywhere.
- With full effects on, hover on web and tap in the app each play the
  animation once and settle on the poster frame — no drift, no jump.
- At 28px the mark is still instantly the same character as the App
  Store icon.
- A cold app boot shows the native black splash, then the animated
  splash, then the app — no black gap, no double penguin, no waiting
  on a download.
- New bytes on a first page load stay inside the budget above, and
  homepage LCP does not regress.
- `prefers-reduced-motion`, `.low-detail` and the app's 12-second idle
  sleep each stop the motion.

## Do not

- Do not redesign the character, the header layout, the tab bar or the
  wordmark.
- Do not introduce a second WebGL context, a physics library, a
  scroll-linked 3-D scene, or a mascot that follows the cursor around
  the page.
- Do not make the splash longer than ~1.8s, and never block
  interaction behind it.
- Do not tie the mascot's colours to the profile-theme accent system;
  the mark stays brand-constant while everything around it recolours.
- Do not ship an animation that only reads at 512px.

## Open question for the owner (answer before building the splash)

The native splash is 1200ms today. If the animated web splash plays
after it, the combined curtain is ~2.5–3s. Either keep both and
shorten the native one to ~600ms (a one-line change in
`capacitor.config.ts`, no Xcode needed), or let the animation be the
whole splash. Recommend one and say which; do not change the native
duration without flagging it.
