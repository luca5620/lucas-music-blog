/**
 * Reviews Page — Browsable archive of all reviews.
 * Filterable by genre, rating, and date.
 * Uses placeholder data for now — will be driven by markdown files.
 */

/* Placeholder review data — will come from /content/ markdown files later */
const reviews = [
  {
    title: "CHROMAKOPIA",
    artist: "Tyler, The Creator",
    rating: 8.7,
    genre: "Hip-Hop",
    date: "2025-10-28",
    snippet: "Tyler keeps evolving. This one feels more introspective without losing the energy.",
  },
  {
    title: "GNX",
    artist: "Kendrick Lamar",
    rating: 9.2,
    genre: "Hip-Hop",
    date: "2025-11-22",
    snippet: "Kendrick dropped this out of nowhere and it might be his most complete project yet.",
  },
  {
    title: "Brat",
    artist: "Charli XCX",
    rating: 8.4,
    genre: "Pop",
    date: "2025-06-07",
    snippet: "Messy, chaotic, self-aware pop. The kind of album you blast at 1am with the windows down.",
  },
  {
    title: "Hit Me Hard and Soft",
    artist: "Billie Eilish",
    rating: 7.9,
    genre: "Alternative",
    date: "2025-05-17",
    snippet: "Billie going for a more cohesive, less single-driven album. Respect the vision even if some tracks drag.",
  },
  {
    title: "The Great Impersonator",
    artist: "Halsey",
    rating: 7.5,
    genre: "Pop",
    date: "2025-10-25",
    snippet: "Genre-hopping concept album that sometimes works brilliantly and sometimes loses the thread.",
  },
  {
    title: "Wacky Sensations",
    artist: "Jean Dawson",
    rating: 8.8,
    genre: "Alternative",
    date: "2025-08-15",
    snippet: "Genre-bending chaos in the best way. Punk, hip-hop, shoegaze all crashing into each other.",
  },
];

/* Color mapping for genres */
function getGenreColor(genre: string) {
  switch (genre) {
    case "Hip-Hop": return "text-accent-primary";
    case "Pop": return "text-accent-cyan";
    case "Alternative": return "text-accent-rose";
    default: return "text-accent-primary";
  }
}

function getRatingColor(rating: number) {
  if (rating >= 9) return "text-accent-primary border-accent-primary";
  if (rating >= 8) return "text-accent-cyan border-accent-cyan";
  return "text-text-secondary border-border-bright";
}

export default function Reviews() {
  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="space-y-3">
        <h1 className="font-[family-name:var(--font-heading)] text-4xl font-extrabold text-accent-primary">
          Reviews
        </h1>
        <p className="text-text-secondary">
          Honest takes on albums and tracks. No filler, no pretentious breakdowns.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-2">
        {["All", "Hip-Hop", "Pop", "Alternative", "R&B"].map((genre) => (
          <button
            key={genre}
            className={`
              pixel-text text-xs uppercase tracking-widest px-4 py-2 rounded-full
              border transition-all duration-200
              ${genre === "All"
                ? "bg-accent-primary/15 text-accent-primary border-accent-primary/30"
                : "text-text-muted border-border-subtle hover:text-text-primary hover:border-border-medium"
              }
            `}
          >
            {genre}
          </button>
        ))}
      </div>

      {/* Review List */}
      <div className="space-y-4">
        {reviews.map((review) => (
          <article
            key={review.title}
            className="card-y2k p-5 flex gap-5 group cursor-pointer"
          >
            {/* Album Art Placeholder */}
            <div className="w-24 h-24 md:w-28 md:h-28 rounded-lg bg-bg-elevated flex items-center justify-center shrink-0">
              <span className="text-3xl group-hover:scale-110 transition-transform">💿</span>
            </div>

            {/* Review Content */}
            <div className="flex-1 space-y-2 min-w-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold text-text-primary group-hover:text-accent-primary transition-colors">
                    {review.title}
                  </h2>
                  <p className="text-sm text-text-secondary">{review.artist}</p>
                </div>
                {/* Rating Badge */}
                <div className={`rating-badge shrink-0 ${getRatingColor(review.rating)}`}>
                  {review.rating}
                </div>
              </div>

              <p className="text-sm text-text-secondary leading-relaxed line-clamp-2">
                {review.snippet}
              </p>

              <div className="flex items-center gap-3">
                <span className={`pixel-text text-xs uppercase tracking-widest ${getGenreColor(review.genre)}`}>
                  {review.genre}
                </span>
                <span className="text-text-muted text-xs">
                  {new Date(review.date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
