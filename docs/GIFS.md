# GIFs (KLIPY) — setup + rules

Shipped 2026-10-11. Members can add a GIF to a review (on its own
instead of words, or at the bottom under them) and to comments and
replies. The code is in `lib/gif.ts`, `components/ui/GifPicker.tsx`,
`GifAttach.tsx` and `GifView.tsx`.

## Why KLIPY

Google shut the Tenor API down on 2026-06-30. Discord, WhatsApp and
others moved to **KLIPY** (or GIPHY). KLIPY is free, has its own
content rating filter, and lets us block search terms and keywords
from a dashboard — so the library is hosted and moderated on their
side, and we never store a single GIF file.

## Turning it on (Luca's hands — ~10 minutes)

The GIF button is **invisible until this is done**. Everything else
is already live.

1. **Run migration `058-gifs.sql`** in the Supabase SQL Editor.
2. Go to **partner.klipy.com** (the KLIPY Partner Panel), sign up,
   open **API Keys** and create a platform (name: Peak Music Reviews,
   type: web + iOS).
3. Copy the app key. In **Vercel → the project → Settings →
   Environment Variables**, add `NEXT_PUBLIC_KLIPY_APP_KEY` = that key
   (all environments), then **redeploy** (NEXT_PUBLIC values are baked
   in at build time — a redeploy is required).
4. In the Partner Panel (**partner.klipy.com/manage-content**), set the **content filter** to the strictest
   level and add any blocked search terms you want (slurs etc.).
   The code also sends `content_filter=high` on every request.
5. While the key is in **Testing** mode KLIPY allows only **100
   requests an hour** across everyone. Once it works, click
   **request Production access** in the Partner Panel for unlimited.

## KLIPY's rules we follow (don't break these)

- Search calls go **from the member's browser** straight to
  `api.klipy.com` — no proxying through our server (needs their
  written OK). That's why the key is a public `NEXT_PUBLIC_` one and
  why `next.config.ts` allows `https://api.klipy.com` in connect-src.
- GIFs load from the **exact URL** KLIPY returned. Never re-host,
  copy or rewrite them. We store only the URL + width/height.
- Results show **in KLIPY's order**, unfiltered by us.
- Search box placeholder is exactly **"Search KLIPY"** — the ONE
  required attribution. "Powered by KLIPY" marks are optional; we keep
  one in the picker (goodwill for Production access) and none on shown
  GIFs (Luca 2026-10-11). Those strings are deliberately not translated.

## Safety

- Migration 058 makes the **database reject any GIF URL that isn't
  on KLIPY's media hosts** (`static*.klipy.com`), so nobody can sneak
  in an image from some random server, even by calling the API
  directly.
- KLIPY gets a **random per-device id**, never the account id, so GIF
  searches can't be tied to a profile.
- A GIF review/comment can be reported with the existing report
  button like any other review/comment.
