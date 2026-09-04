# Translation guide

How the six languages (English, Spanish, French, Brazilian Portuguese,
Dutch, German) are managed, and the rules every translation follows.
Read this before translating anything, and paste the **Style** and
**Glossary** sections into the Tolgee project description so the AI
translator follows them too.

## The setup in one paragraph

The site renders with `next-intl`. Every piece of copy we wrote lives in
`messages/<locale>.json` (ICU message format, nested by namespace). Tolgee
is the translation platform: the JSON files are pushed to it, translated
and reviewed there (AI first, native reader second), and pulled back into
the repo. Tolgee never touches the site at runtime — the repo files are
what ships. `docs/TRANSLATION-GUIDE.md` (this file) and
`docs/tolgee-glossary.csv` are the source of truth for tone and terms.

## Commands

```bash
npm run i18n:push        # repo → Tolgee (new keys + English source)
npm run i18n:pull        # Tolgee → repo (all six files, then commit)
npm run i18n:push:force  # first upload, or to overwrite Tolgee with the repo
```

They read `TOLGEE_API_KEY` from the environment (put it in `.env.local`,
never in Vercel — the site doesn't need it, only the CLI does). Use a
**project-scoped** API key (Tolgee → the project → Integrate → API keys)
with at least `keys.view`, `keys.edit`, `translations.view`,
`translations.edit` and `import` scopes; a project key needs no project
id in the config. Config is `.tolgeerc.json` at the repo root.

One rule that protects the site: `i18n:pull` only writes keys that are
*Translated* or *Reviewed* in Tolgee. A key left untranslated in a
language is simply absent from that file, and next-intl then shows the
key path (e.g. `lists.editor.keepIt`) on screen. So after pushing new
English keys, run **Translate with AI** for all five languages before
you pull.

## First-time setup (Luca's hands, ~15 minutes)

1. Create a free account at [app.tolgee.io](https://app.tolgee.io) and a
   project named **Peak Music Reviews**. Base language **English (en)**;
   add **es, fr, pt, nl, de** (Tolgee's language tags must match these
   two-letter codes exactly — they're the file names).
2. Project → Integrate → **API keys** → create a project key with the
   scopes above. Put it in `.env.local` as `TOLGEE_API_KEY=…`.
3. Project settings → **Description**: paste the *Style* section of this
   file (the AI translator reads it). Optionally set the language notes
   per language (e.g. Spanish: "tú, neutral Latin-American, no
   vosotros").
4. Project → **Glossaries** → import `docs/tolgee-glossary.csv`. Map the
   columns to the six languages and the description field.
5. In the repo: `npm run i18n:push:force` — the six files upload as the
   initial state (English as source, the current translations marked
   *Translated*, none *Reviewed*).
6. In Tolgee, filter Spanish to *Translated* and re-run **Translate with
   AI** on the strings that read badly (or on everything — the glossary
   and description now steer it), then read through and mark each one
   **Reviewed**. Same for French. Portuguese, Dutch and German can wait
   for a native reader from the community.
7. `npm run i18n:pull`, then commit the six message files.

From then on the loop below is the whole process.

## What gets translated — and what never does

Translate ONLY the words we wrote: menus, buttons, labels, hints, empty
states, error copy, placeholders. **Never** translate:

- reviews, lists, posts, chat, debate takes — they read the way their
  authors meant them
- catalog data: artist, album and track names, release types stay in
  English as the data has them
- page metadata (titles/descriptions/OpenGraph) and JSON-LD — English by
  decision, SEO is English
- the report reason string sent to moderators (mod tools read one
  language)
- the Privacy Policy and Terms of Use — a translated legal text can be
  read as a binding version
- admin tools (staff only)
- product and brand names: Peak Music Reviews, Spotify, Apple Music,
  Genius, Bandcamp, stats.fm, YouTube, TikTok, Musicboard, and the theme
  names (Broadcast, PS2 · Nebula, Xbox OG, LimeWire, Soul Reaper, Robot
  Rock…)

## Style

- **Voice:** a knowledgeable friend, not a brand. Short, direct, a bit
  playful. Broadcast/CRT flavour is part of the identity (ON AIR, NO
  SIGNAL, TUNING…, "the room") — keep the metaphor, don't flatten it into
  corporate copy.
- **Register:** informal singular "you" everywhere. Spanish **tú**
  (neutral Latin-American vocabulary, no vosotros), French **tu**,
  Portuguese **você** (Brazilian spelling and vocabulary), Dutch **je/jij**,
  German **du**. Never usted / vous / Sie / u.
- **Length:** uppercase tags (`vhs-label`, `label-xbox`, `osd-text`,
  `pixel-text`) and buttons have very little room. Keep those within
  ~30% of the English length; prefer a shorter synonym over a wrapped
  label. Long-form sentences (hints, empty states) can breathe.
- **Punctuation:** keep the English "—" dashes and "…" where they exist;
  French gets its spaces before ? ! : ; German capitalises nouns; Dutch
  compounds stay closed (Spotify-playlist, communityfeed).
- **Placeholders:** `{n}`, `{title}`, `{name}`, `{date}` are variables —
  keep them exactly, move them where the grammar wants. ICU plurals
  (`{n, plural, one {…} other {…}}`) must keep both branches (French
  and Portuguese use "one" for 0 and 1). Rich tags (`<b>…</b>`,
  `<link>…</link>`, `<a>…</a>`) wrap a clickable or bold span — keep the
  tag pair, translate what's inside it.
- **Numbers and dates** are formatted by code in the viewer's locale;
  never hard-code them in a string.
- **No machine-translation tells:** avoid word-for-word calques
  ("dejar caer tu opinión" for "drop your take"), avoid over-formal
  synonyms, avoid English word order. When a phrase is idiomatic in
  English, find the idiom in the target language or say it plainly.

## Glossary (the core terms)

| English | Meaning | es | fr | pt-BR | nl | de |
|---|---|---|---|---|---|---|
| release | any record: album, EP, single, mixtape | lanzamiento | sortie | lançamento | release | Release |
| review | a member's rating + words on a release | reseña | critique | resenha | recensie | Rezension |
| rating | the 0–10 number | calificación / nota | note | nota | cijfer | Bewertung |
| take | a short opinion (casual) | opinión | avis | opinião | mening | Meinung |
| live room / the room | the realtime chat under a release | sala en vivo / la sala | salle en direct / la salle | sala ao vivo / a sala | live room / de room | Live-Raum / der Raum |
| debate | a two-sided vote with chat | debate | débat | debate | debat | Debatte |
| list | a curated set of releases (Letterboxd-style) | lista | liste | lista | lijst | Liste |
| post | freeform long-form writing, may embed a video | publicación | post | post | post | Post |
| drop / drops (verb) | a release coming out | salir | sortir | sair | uitkomen | erscheinen |
| unreleased | leaked / never officially released | inédito | inédit | inédita | onuitgebracht | unveröffentlicht |
| leak | an unreleased song that got out | filtración | leak | vazamento | leak | Leak |
| loosie | a stray single, not on an album | (canción) suelta | loosie | (faixa) avulsa | losse track | Loosie |
| follow / following (a person or release) | | seguir / siguiendo | suivre / abonné | seguir / seguindo | volgen / volgend | folgen / folge ich |
| follower(s) | | seguidor(es) | abonné(s) | seguidor(es) | volger(s) | Follower |
| like(s) | | me gusta | like(s) | curtida(s) | like(s) | Like(s) |
| showcase | a block a member arranges on their profile (plain "section" in ES/FR — "vitrina" read as a shop window) | sección | section | vitrine | showcase | Showcase |
| badge | trophy/role marker under a username | insignia | badge | emblema | badge | Badge |
| streak | consecutive days of Song of the Day | racha | série | sequência | reeks | Streak |
| Your Taste | the personalised fullscreen feed (product name, translated) | Tu gusto | Tes goûts | Seu gosto | Jouw smaak | Dein Geschmack |
| Song of the Day | daily pick feature | Canción del día | Morceau du jour | Música do dia | Nummer van de dag | Song des Tages |
| Community Feed | the home reviews module | Feed de la comunidad | Flux de la communauté | Feed da comunidade | Communityfeed | Community-Feed |
| ON AIR | live-room status stamp | AL AIRE | À L'ANTENNE | NO AR | ON AIR | ON AIR |
| NO SIGNAL | the empty-state voice | SIN SEÑAL | PAS DE SIGNAL | SEM SINAL | GEEN SIGNAAL | KEIN SIGNAL |
| TUNING… | loading state | SINTONIZANDO… | RÉGLAGE… | SINTONIZANDO… | AFSTEMMEN… | SENDERSUCHE… |
| low detail mode | the performance toggle | modo ligero | mode léger | modo de baixo detalhe | lage-detailmodus | Modus mit wenig Details |
| sign in / sign up | | iniciar sesión / registrarse | se connecter / s'inscrire | entrar / cadastrar-se | inloggen / aanmelden | anmelden / registrieren |
| draft | unpublished | borrador | brouillon | rascunho | concept | Entwurf |

Add a row here whenever a new product term appears, then re-import
`docs/tolgee-glossary.csv` (same rows, machine-readable).

## Where the platform stands (2026-09-03)

Tolgee cloud was tried and hit its free-plan ceiling (500 keys; we have
893) — the paid tiers with the glossary-aware AI cost €179/month, so the
cloud project is parked. The CLI config and scripts stay in the repo for
the day a self-hosted Tolgee (Docker, no key limit) is worth an afternoon.
Until then the loop is: translate against this guide, then a native
reader marks lines on a side-by-side review page (English | target) and
the fixes land in `messages/<locale>.json` by hand. Spanish and French
were fully rewritten this way on 2026-09-03.

## The review loop

1. Add keys to `messages/en.json` first (code + English in one commit).
2. `npm run i18n:push` — the new keys land in Tolgee untranslated.
3. In Tolgee: **Translate with AI** for the five languages (it uses the
   glossary and project description), then a native reader marks each
   string **Reviewed** — or fixes it — in the editor. Spanish and French
   get the first pass, they're the ones Luca can read.
4. `npm run i18n:pull` — commit the six files together.

Machine-translated strings that nobody has reviewed are marked
*Translated*, not *Reviewed*, in Tolgee, so it's always visible which
ones a human has actually read.
