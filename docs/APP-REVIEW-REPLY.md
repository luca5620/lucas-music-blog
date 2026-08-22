# Reply kit — Guideline 2.1 "Information Needed" (2026-08-20)

Apple did NOT reject the app. This is their standard "tell us more before we
review" message. You reply once, with a video + the text below, and the
review continues.

## What you do (order matters)

1. **Record the video on your iPhone** — follow the script below.
2. **Verify the demo account** — log in at peakmusicreviews.com as
   `applereview` and confirm the password still works. If you never created
   it, create + email-confirm it now.
3. **Reply in App Store Connect**: My Apps → Peak Music Reviews → the
   App Review message thread → **Reply** → paste the "REPLY TEXT" section
   below → attach the video → send.
4. **Also paste the same text** into App Review Information → **Notes**
   (and the demo credentials into Sign-In Information) so future
   submissions don't bounce on this again.

---

## Screen recording script (~3 minutes)

Must be recorded on your **physical iPhone** on the **latest iOS**.
Control Center → screen record (add it via Settings → Control Center if
missing). Start recording BEFORE launching the app — the video must open
with the app launch. Trim in Photos afterward; keep it under a few
hundred MB.

1. **Launch** — home screen → tap the Peak Music Reviews icon, let the
   splash/home load.
2. **Registration** — from the logged-out splash, register a throwaway
   account (use a real inbox you control). Switch to Mail, tap the
   confirmation link, return to the app logged in. (This throwaway gets
   deleted on camera in step 8 — nice and tidy.)
3. **Core flow: review** — search the catalog, open a release, write a
   short review with a rating, publish it, show the review page.
4. **Browse** — scroll the home feed / Your Taste, open a list, open a
   community release page.
5. **Debate** — open a debate, vote a side, send one chat message.
6. **Profile** — open your profile, flip through a console theme or two.
7. **UGC moderation (they explicitly asked)** — tap the 🚩 report button
   on someone's review or comment; then open a user's profile and tap
   **Block**, show their content gone from the feed, then unblock.
8. **Account deletion (they explicitly asked)** — Settings → Profile →
   Delete Account → delete the throwaway account from step 2, ending
   back at the logged-out screen.
9. **Login** — log back in as `applereview` to show the login flow. Stop
   recording.

There are no purchases, subscriptions, or sensitive-permission prompts
(no location/contacts/camera/ATT), so nothing else needs to be shown.

---

## REPLY TEXT (paste everything below into the reply + Notes)

Thank you for the review. Responses to each requested item:

**1. Screen recording** — Attached. Captured on a physical iPhone running
the latest iOS. It begins at app launch and shows: account registration
with email confirmation, writing and publishing a review, browsing feeds
and lists, voting and chatting in a debate, profile themes,
user-generated-content moderation (reporting content and blocking /
unblocking a user), in-app account deletion, and login.

**2. Devices and operating systems tested** — Physical device: iPhone
[YOUR MODEL, e.g. iPhone 15 Pro], iOS [VERSION]. Additionally tested in
Xcode simulators (iPhone 16 Pro Max, latest iOS) and across desktop and
mobile browsers against the production backend.

**3. App functions and target audience** — Peak Music Reviews is a free
social platform for music fans (general audience, rated 12+ for
user-generated content). The problem it solves: film lovers have
dedicated social log/rating platforms, but music fans lack an equivalent
with live community energy. Users rate and review albums and songs on a
0–10 scale, build and share lists, join live release-day chat rooms,
take sides in structured debates with voting and live chat, follow other
users, and customize a personal profile. The value: one place to log
your music taste, discover releases through people rather than
algorithms, and discuss them in real time.

**4. Setup and access instructions** — No setup, sample files, or
configuration required. Demo account (also entered in Sign-In
Information): username `applereview`, password [PASSWORD]. Reviewers may
also register freely — registration requires only an email address
(with confirmation link) and a username. Main features are reachable
from the bottom navigation: Home (feed), Search (catalog → write a
review from any release page), Lists, Debates, Profile. Content
reporting is available via the 🚩 button on any review, comment, or
chat message; user blocking via the Block button on any profile;
account deletion via Settings → Profile → Delete Account.

**5. External services used** —
- Supabase: user authentication (email/password), database, and file
  storage (avatars/banners).
- Resend: transactional email delivery (account confirmation emails)
  via SMTP.
- Spotify Web API and Genius API: music release metadata and album
  artwork only, via their official developer APIs. The app does not
  stream, play, or download any audio.
- Vercel: web hosting/CDN for the backend.
The app contains no payment processors, no subscriptions or in-app
purchases, no ads, no third-party analytics or tracking SDKs, and no
AI services.

**6. Regional differences** — None. The app functions identically in
all regions; all content is user-generated and currently in English.

**7. Regulated industry / protected material** — The app does not
operate in a regulated industry. Third-party material is limited to
album artwork and catalog metadata retrieved through the official
Spotify and Genius developer APIs in accordance with their developer
terms; no audio content is reproduced or distributed.

---

Fill in before sending: **[YOUR MODEL]**, **[VERSION]**, **[PASSWORD]**.
