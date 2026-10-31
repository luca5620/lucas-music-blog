// ============================================================
// _shared/push-copy.ts — every word a push notification says, in all
// six site languages (2026-10-05).
//
// WHY A COPY TABLE HERE AND NOT messages/*.json: edge functions are
// deployed to Supabase on their own (Deno), not with the Next.js app,
// so they can't import the site's dictionaries. The notification lines
// below MIRROR the `notifications` namespace in messages/<locale>.json
// (the in-app bell) word for word — if you change a bell line there,
// change it here too, or the bell and the phone will disagree.
//
// Language per device comes from push_tokens.locale (migration 052),
// which /api/push/register fills from the site's language cookie.
//
// Never translated: "Aux War" (the feature's name — Luca's rule) and
// anything users wrote (record titles, display names).
// ============================================================

export const LOCALES = ["en", "es", "fr", "pt", "nl", "de"] as const;
export type Locale = (typeof LOCALES)[number];

/** Anything unknown/missing falls back to English, like the site does. */
export function asLocale(value: unknown): Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value)
    ? (value as Locale)
    : "en";
}

/* ---------- Notification lines (push-fanout) ---------- */

// `{title}` is either "" or ` "The Record"` (leading space included)
// — exactly how NotificationsBell.message() fills it, so each language
// can put the title wherever its grammar wants it.
type NotificationKey =
  | "follow"
  | "review_like"
  | "comment"
  | "comment_reply"
  | "post_like"
  | "list_like"
  | "new_review"
  | "new_post"
  | "new_list"
  | "new_debate"
  | "new_aux"
  | "aux_invite"
  | "other";

const NOTIFICATION_COPY: Record<Locale, Record<NotificationKey, string> & { someone: string }> = {
  en: {
    someone: "Someone",
    follow: "started following you",
    review_like: "liked your review of{title}",
    comment: "commented on your review of{title}",
    comment_reply: "replied to your comment on{title}",
    post_like: "liked your post{title}",
    list_like: "liked your list{title}",
    new_review: "posted a review of{title}",
    new_post: "posted{title}",
    new_list: "made a new list{title}",
    new_debate: "started a debate{title}",
    new_aux: "is hosting an Aux War{title}",
    aux_invite: "invited you to their Aux War{title}",
    other: "did something",
  },
  es: {
    someone: "Alguien",
    follow: "empezó a seguirte",
    review_like: "le gustó tu reseña de{title}",
    comment: "comentó tu reseña de{title}",
    comment_reply: "respondió a tu comentario en{title}",
    post_like: "le gustó tu publicación{title}",
    list_like: "le gustó tu lista{title}",
    new_review: "publicó una reseña de{title}",
    new_post: "publicó{title}",
    new_list: "hizo una lista nueva{title}",
    new_debate: "abrió un debate{title}",
    new_aux: "organiza una Aux War{title}",
    aux_invite: "te invitó a su Aux War{title}",
    other: "hizo algo",
  },
  fr: {
    someone: "Quelqu'un",
    follow: "a commencé à te suivre",
    review_like: "a aimé ta critique de{title}",
    comment: "a commenté ta critique de{title}",
    comment_reply: "a répondu à ton commentaire sur{title}",
    post_like: "a aimé ton post{title}",
    list_like: "a aimé ta liste{title}",
    new_review: "a publié une critique de{title}",
    new_post: "a publié{title}",
    new_list: "a fait une nouvelle liste{title}",
    new_debate: "a lancé un débat{title}",
    new_aux: "organise une Aux War{title}",
    aux_invite: "t'a invité à son Aux War{title}",
    other: "a fait quelque chose",
  },
  pt: {
    someone: "Alguém",
    follow: "começou a seguir você",
    review_like: "curtiu sua resenha de{title}",
    comment: "comentou sua resenha de{title}",
    comment_reply: "respondeu ao seu comentário em{title}",
    post_like: "curtiu seu post{title}",
    list_like: "curtiu sua lista{title}",
    new_review: "publicou uma resenha de{title}",
    new_post: "publicou{title}",
    new_list: "fez uma lista nova{title}",
    new_debate: "abriu um debate{title}",
    new_aux: "está criando uma Aux War{title}",
    aux_invite: "convidou você para uma Aux War{title}",
    other: "fez algo",
  },
  nl: {
    someone: "Iemand",
    follow: "volgt je nu",
    review_like: "likete je recensie van{title}",
    comment: "reageerde op je recensie van{title}",
    comment_reply: "antwoordde op je reactie bij{title}",
    post_like: "likete je post{title}",
    list_like: "likete je lijst{title}",
    new_review: "plaatste een recensie van{title}",
    new_post: "plaatste{title}",
    new_list: "maakte een nieuwe lijst{title}",
    new_debate: "startte een debat{title}",
    new_aux: "host een Aux War{title}",
    aux_invite: "nodigde je uit voor hun Aux War{title}",
    other: "deed iets",
  },
  de: {
    someone: "Jemand",
    follow: "folgt dir jetzt",
    review_like: "hat deine Rezension zu{title} geliked",
    comment: "hat deine Rezension zu{title} kommentiert",
    comment_reply: "hat auf deinen Kommentar zu{title} geantwortet",
    post_like: "hat deinen Post{title} geliked",
    list_like: "hat deine Liste{title} geliked",
    new_review: "hat eine Rezension zu{title} veröffentlicht",
    new_post: "hat{title} gepostet",
    new_list: "hat eine neue Liste{title} gemacht",
    new_debate: "hat eine Debatte{title} eröffnet",
    new_aux: "hostet eine Aux War{title}",
    aux_invite: "hat dich zu seiner Aux War eingeladen{title}",
    other: "hat etwas gemacht",
  },
};

function isNotificationKey(type: string): type is NotificationKey {
  return type in NOTIFICATION_COPY.en && type !== "someone";
}

/** The verb line under the actor's name — "liked your review of "X"". */
export function notificationBody(
  locale: Locale,
  type: string,
  title: string | null
): string {
  const copy = NOTIFICATION_COPY[locale];
  const line = isNotificationKey(type) ? copy[type] : copy.other;
  return line.replace("{title}", title ? ` "${title}"` : "");
}

/** "Someone", for an actor whose profile couldn't be read. */
export function someone(locale: Locale): string {
  return NOTIFICATION_COPY[locale].someone;
}

/* ---------- Weekly recap (push-recap) ---------- */

/** What the 055 SQL job computes per person (see send_weekly_recaps). */
export interface RecapStats {
  kind: "recap" | "nudge";
  username: string;
  /** Published reviews (= ratings) created in the window. */
  rated: number;
  /** Their average rating that week, one decimal. Null when rated = 0. */
  avg_rating: number | null;
  /** The week's highest-rated record (ties → most recent). */
  top_title: string | null;
  top_rating: number | null;
  /** Likes OTHER people left on their reviews in the window. */
  likes: number;
  /** New followers in the window. */
  new_followers: number;
}

interface RecapCopy {
  title: string;
  /** n ≥ 2 */
  ratedMany: string;
  /** n = 1 — the average would just repeat the top score. */
  ratedOne: string;
  likesMany: string;
  likesOne: string;
  followersMany: string;
  followersOne: string;
  nudge: string;
}

// Each line is written to sit MID-SENTENCE (they're joined with " · "
// and only the very first letter of the whole body is capitalized),
// which is why the English reads "you rated…" not "You rated…".
const RECAP_COPY: Record<Locale, RecapCopy> = {
  en: {
    title: "Your week in music",
    ratedMany: "you rated {n} records (avg {avg}, top: {top} {topRating})",
    ratedOne: "you rated 1 record: {top} ({topRating})",
    likesMany: "your reviews got {n} likes",
    likesOne: "your reviews got 1 like",
    followersMany: "{n} new followers",
    followersOne: "1 new follower",
    nudge: "Anything on repeat this week? Give it a rating before Monday.",
  },
  es: {
    title: "Tu semana en música",
    ratedMany: "calificaste {n} discos (media {avg}, top: {top} {topRating})",
    ratedOne: "calificaste 1 disco: {top} ({topRating})",
    likesMany: "tus reseñas recibieron {n} me gusta",
    likesOne: "tus reseñas recibieron 1 me gusta",
    followersMany: "{n} seguidores nuevos",
    followersOne: "1 seguidor nuevo",
    nudge: "¿Qué tuviste en repeat esta semana? Califícalo antes del lunes.",
  },
  fr: {
    title: "Ta semaine en musique",
    ratedMany: "tu as noté {n} disques (moy. {avg}, top : {top} {topRating})",
    ratedOne: "tu as noté 1 disque : {top} ({topRating})",
    likesMany: "tes critiques ont reçu {n} j'aime",
    likesOne: "tes critiques ont reçu 1 j'aime",
    followersMany: "{n} nouveaux abonnés",
    followersOne: "1 nouvel abonné",
    nudge: "Un disque en boucle cette semaine ? Note-le avant lundi.",
  },
  pt: {
    title: "Sua semana em música",
    ratedMany: "você avaliou {n} discos (média {avg}, top: {top} {topRating})",
    ratedOne: "você avaliou 1 disco: {top} ({topRating})",
    likesMany: "suas resenhas receberam {n} curtidas",
    likesOne: "suas resenhas receberam 1 curtida",
    followersMany: "{n} novos seguidores",
    followersOne: "1 novo seguidor",
    nudge: "Algum disco no repeat esta semana? Avalie antes de segunda.",
  },
  nl: {
    title: "Jouw week in muziek",
    ratedMany: "je beoordeelde {n} platen (gem. {avg}, top: {top} {topRating})",
    ratedOne: "je beoordeelde 1 plaat: {top} ({topRating})",
    likesMany: "je recensies kregen {n} likes",
    likesOne: "je recensies kregen 1 like",
    followersMany: "{n} nieuwe volgers",
    followersOne: "1 nieuwe volger",
    nudge: "Iets op repeat deze week? Geef het een cijfer vóór maandag.",
  },
  de: {
    title: "Deine Woche in Musik",
    ratedMany: "du hast {n} Platten bewertet (Ø {avg}, Top: {top} {topRating})",
    ratedOne: "du hast 1 Platte bewertet: {top} ({topRating})",
    likesMany: "deine Rezensionen bekamen {n} Likes",
    likesOne: "deine Rezensionen bekamen 1 Like",
    followersMany: "{n} neue Follower",
    followersOne: "1 neuer Follower",
    nudge: "Diese Woche was in Dauerschleife? Bewerte es vor Montag.",
  },
};

/**
 * Same display rule as lib/rating.ts formatRating: whole numbers lose
 * the pointless decimal (10, 7), everything else keeps exactly one
 * (9.4). The site shows "." in every language, so this does too.
 */
function formatRating(rating: number): string {
  const r = Math.round(rating * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

/** Long album titles would eat the whole banner — cap them. */
function shortTitle(title: string): string {
  const t = title.trim();
  return t.length > 40 ? `${t.slice(0, 39).trimEnd()}…` : t;
}

function fill(line: string, values: Record<string, string>): string {
  return line.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");
}

/**
 * The recap push for one person in one language. Returns null when
 * there's genuinely nothing to say (the SQL job shouldn't send those,
 * but a recap with an empty body must never reach a phone).
 */
export function recapAlert(
  locale: Locale,
  s: RecapStats
): { title: string; body: string; href: string } | null {
  const copy = RECAP_COPY[locale];

  if (s.kind === "nudge") {
    // Tapping a nudge goes straight to "rate something".
    return { title: copy.title, body: copy.nudge, href: "/reviews/new" };
  }

  const parts: string[] = [];
  if (s.rated > 0) {
    const top = s.top_title ? `"${shortTitle(s.top_title)}"` : "";
    const topRating = s.top_rating != null ? formatRating(s.top_rating) : "";
    if (s.rated === 1) {
      parts.push(fill(copy.ratedOne, { top, topRating }));
    } else {
      parts.push(
        fill(copy.ratedMany, {
          n: String(s.rated),
          avg: s.avg_rating != null ? formatRating(s.avg_rating) : "",
          top,
          topRating,
        })
      );
    }
  }
  if (s.likes > 0) {
    parts.push(
      s.likes === 1 ? copy.likesOne : fill(copy.likesMany, { n: String(s.likes) })
    );
  }
  if (s.new_followers > 0) {
    parts.push(
      s.new_followers === 1
        ? copy.followersOne
        : fill(copy.followersMany, { n: String(s.new_followers) })
    );
  }
  if (parts.length === 0) return null;

  const joined = parts.join(" · ");
  const body = joined.charAt(0).toUpperCase() + joined.slice(1);
  // Tapping a recap opens their own profile — where the week's ratings
  // now live. Encoded anyway, so an odd handle can never break the link.
  return { title: copy.title, body, href: `/profile/${encodeURIComponent(s.username)}` };
}

/* ---------- Song of the Day streak saver (push-recap, type STREAK) ---------- */

// Migration 060 sends these at 6pm Pacific to people with a 3+ day
// Song of the Day streak who haven't picked today. "Song of the Day"
// matches the profile widget's name in each language (profile.sotd in
// messages/<locale>.json). "About to end", not "at midnight": the
// day resets at PACIFIC midnight, which isn't midnight for anyone
// outside the US west coast. Plain and calm on purpose — the growth
// skill's rule: a streak push states the fact, never guilt-trips.

/** What the 060 SQL job sends per person (see send_sotd_streak_savers). */
export interface StreakSave {
  username: string;
  streak: number;
}

const STREAK_COPY: Record<Locale, { title: string; body: string }> = {
  en: {
    title: "Your {n}-day streak is about to end",
    body: "Pick today's song of the day to keep it going.",
  },
  es: {
    title: "Tu racha de {n} días está por terminar",
    body: "Elige tu canción del día para mantenerla.",
  },
  fr: {
    title: "Ta série de {n} jours est sur le point de finir",
    body: "Choisis ton morceau du jour pour la garder.",
  },
  pt: {
    title: "Sua sequência de {n} dias está quase acabando",
    body: "Escolha a música do dia para manter.",
  },
  nl: {
    title: "Je streak van {n} dagen loopt bijna af",
    body: "Kies je nummer van de dag om hem vast te houden.",
  },
  de: {
    title: "Dein {n}-Tage-Streak läuft gleich ab",
    body: "Wähl deinen Song des Tages, um ihn zu halten.",
  },
};

/** The streak-saver push for one person in one language. */
export function streakAlert(
  locale: Locale,
  s: StreakSave
): { title: string; body: string; href: string } {
  const copy = STREAK_COPY[locale];
  return {
    title: fill(copy.title, { n: String(s.streak) }),
    body: copy.body,
    // Their own profile — the Song of the Day picker lives there.
    href: `/profile/${encodeURIComponent(s.username)}`,
  };
}

/* ---------- Saved record is out (push-recap, type DROP) ---------- */

// Migration 062 sends these at midnight Eastern (the drop moment) to
// people who saved a record that comes out today and haven't rated it.
// One push per person per day: the first record they saved is named,
// the rest are counted. Plain and calm, like the streak saver.

/** What the 062 SQL job sends per person (see send_saved_drop_pushes). */
export interface SavedDrop {
  username: string;
  title: string;
  artist: string;
  slug: string;
  more: number;
}

const DROP_COPY: Record<
  Locale,
  { title: string; titleMore: string; body: string; bodyMore: string }
> = {
  en: {
    title: "Out now: {title}",
    titleMore: "Out now: {title} + {n} more",
    body: "{artist} · you saved it. Be one of the first to rate it.",
    bodyMore: "Records you saved just came out. Be one of the first to rate them.",
  },
  es: {
    title: "Ya disponible: {title}",
    titleMore: "Ya disponible: {title} + {n} más",
    body: "{artist} · lo guardaste. Sé de los primeros en calificarlo.",
    bodyMore: "Salieron discos que guardaste. Sé de los primeros en calificarlos.",
  },
  fr: {
    title: "Disponible : {title}",
    titleMore: "Disponible : {title} + {n} autres",
    body: "{artist} · tu l'as gardé. Sois parmi les premiers à le noter.",
    bodyMore: "Des disques que tu as gardés viennent de sortir. Sois parmi les premiers à les noter.",
  },
  pt: {
    title: "Saiu: {title}",
    titleMore: "Saiu: {title} + {n}",
    body: "{artist} · você salvou. Seja um dos primeiros a avaliar.",
    bodyMore: "Discos que você salvou acabaram de sair. Seja um dos primeiros a avaliar.",
  },
  nl: {
    title: "Nu uit: {title}",
    titleMore: "Nu uit: {title} + {n} meer",
    body: "{artist} · je hebt hem bewaard. Wees een van de eersten die hem beoordeelt.",
    bodyMore: "Platen die je bewaarde zijn net uit. Wees een van de eersten die ze beoordeelt.",
  },
  de: {
    title: "Jetzt draußen: {title}",
    titleMore: "Jetzt draußen: {title} + {n} weitere",
    body: "{artist} · du hast es gespeichert. Bewerte es als einer der Ersten.",
    bodyMore: "Platten, die du gespeichert hast, sind gerade erschienen. Bewerte sie als einer der Ersten.",
  },
};

/** The saved-record-is-out push for one person in one language. */
export function dropAlert(
  locale: Locale,
  d: SavedDrop
): { title: string; body: string; href: string } {
  const copy = DROP_COPY[locale];
  const title = shortTitle(d.title);
  if (d.more > 0) {
    return {
      title: fill(copy.titleMore, { title, n: String(d.more) }),
      body: copy.bodyMore,
      // Several records → their Saved tab, where all of them are.
      href: `/profile/${encodeURIComponent(d.username)}?tab=saved`,
    };
  }
  return {
    title: fill(copy.title, { title }),
    // No artist on file → drop the "artist · " part rather than show a
    // lone dot, and capitalise what's left.
    body: d.artist
      ? fill(copy.body, { artist: d.artist })
      : capitalise(copy.body.replace("{artist} · ", "")),
    href: `/releases/${encodeURIComponent(d.slug)}`,
  };
}

function capitalise(line: string): string {
  return line.charAt(0).toUpperCase() + line.slice(1);
}

/* ---------- Rewind is ready (push-recap, type REWIND) ---------- */

// Migration 063 sends this once, on December 1 at 10am Eastern, to
// everyone with an iPhone and at least 3 records rated that year (the
// same bar /rewind uses). Tapping it opens /rewind.

/** What the 063 SQL job sends per person (see send_rewind_pushes). */
export interface RewindReady {
  username: string;
  year: number;
  total: number;
}

const REWIND_COPY: Record<Locale, { title: string; body: string }> = {
  en: {
    title: "Your {year} Rewind is ready",
    body: "{total} records, your top 10 and the numbers. Tap to watch.",
  },
  es: {
    title: "Tu Rewind {year} está listo",
    body: "{total} discos, tu top 10 y los números. Toca para verlo.",
  },
  fr: {
    title: "Ton Rewind {year} est prêt",
    body: "{total} disques, ton top 10 et les chiffres. Touche pour le voir.",
  },
  pt: {
    title: "Seu Rewind {year} está pronto",
    body: "{total} discos, seu top 10 e os números. Toque para ver.",
  },
  nl: {
    title: "Je Rewind {year} staat klaar",
    body: "{total} platen, je top 10 en de cijfers. Tik om te kijken.",
  },
  de: {
    title: "Dein Rewind {year} ist da",
    body: "{total} Platten, deine Top 10 und die Zahlen. Tippe zum Ansehen.",
  },
};

/** The "your Rewind is ready" push for one person in one language. */
export function rewindAlert(
  locale: Locale,
  r: RewindReady
): { title: string; body: string; href: string } {
  const copy = REWIND_COPY[locale];
  return {
    title: fill(copy.title, { year: String(r.year) }),
    body: fill(copy.body, { total: String(r.total) }),
    href: "/rewind",
  };
}

// ------------------------------------------------------------
// Community Spotlight — Monday 10am New York (migration 068)
// ------------------------------------------------------------
// One push a week to everyone with the app on an iPhone who hasn't
// rated the week's record yet. Tapping it opens the album page, where
// the members' score sits as ?.? on the record label until they rate.

/** What the 068 SQL job sends per person (see send_spotlight_pushes). */
export interface SpotlightWeek {
  username: string;
  title: string;
  artist: string;
  slug: string;
}

const SPOTLIGHT_COPY: Record<Locale, { title: string; body: string }> = {
  en: {
    title: "This week's spotlight: {title}",
    body: "{artist}. Listen, rate it and see how you compare with everyone.",
  },
  es: {
    title: "El spotlight de esta semana: {title}",
    body: "{artist}. Escúchalo, puntúalo y mira cómo te comparas con los demás.",
  },
  fr: {
    title: "Le spotlight de la semaine : {title}",
    body: "{artist}. Écoute, note-le et compare ta note à celle des autres.",
  },
  pt: {
    title: "O spotlight da semana: {title}",
    body: "{artist}. Ouça, avalie e veja como você se compara com todo mundo.",
  },
  nl: {
    title: "De spotlight van deze week: {title}",
    body: "{artist}. Luister, beoordeel het en zie hoe je scoort tegenover de rest.",
  },
  de: {
    title: "Das Spotlight der Woche: {title}",
    body: "{artist}. Hör rein, bewerte es und sieh, wie du im Vergleich liegst.",
  },
};

/** The Monday spotlight push for one person in one language. */
export function spotlightAlert(
  locale: Locale,
  s: SpotlightWeek
): { title: string; body: string; href: string } {
  const copy = SPOTLIGHT_COPY[locale];
  return {
    title: fill(copy.title, { title: s.title }),
    // No artist on record (rare Genius imports) → drop the "{artist}. "
    body: s.artist
      ? fill(copy.body, { artist: s.artist })
      : fill(copy.body, { artist: "" }).replace(/^\.\s*/, ""),
    href: `/releases/${s.slug}`,
  };
}
