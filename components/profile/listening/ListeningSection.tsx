/**
 * ListeningSection — Profile-page composition of all listening widgets.
 * Server component. Auto-hides if the user has no listening data.
 */

import { getProfileListeningData } from "@/lib/db/listening";
import NowPlaying from "@/components/ui/NowPlaying";
import LifetimeStatsBlock from "./LifetimeStatsBlock";
import TopArtistsList from "./TopArtistsList";
import TopTracksList from "./TopTracksList";
import TopAlbumsGrid from "./TopAlbumsGrid";
import GenreBreakdown from "./GenreBreakdown";

interface Props {
  username: string;
  accentColor: string;
}

export default async function ListeningSection({
  username,
  accentColor,
}: Props) {
  const data = await getProfileListeningData(username);
  if (!data) return null;

  return (
    <section id="listening" className="px-4 sm:px-8 space-y-6 relative">
      {/* Section heading */}
      <div className="flex items-center gap-3">
        <span
          className="w-2 h-2 rounded-full"
          style={{
            background: accentColor,
            boxShadow: `0 0 8px ${accentColor}80`,
          }}
        />
        <span
          className="font-[family-name:var(--font-heading)] text-xs font-extrabold uppercase tracking-widest px-3 py-1 rounded"
          style={{
            color: accentColor,
            background: `${accentColor}10`,
            border: `1px solid ${accentColor}30`,
          }}
        >
          Listening
        </span>
        <div
          className="flex-1 h-[1px]"
          style={{
            background: `linear-gradient(90deg, ${accentColor}40, transparent)`,
          }}
        />
      </div>

      <h2 className="font-[family-name:var(--font-heading)] text-2xl sm:text-3xl font-extrabold text-[#e8e6e3]">
        What I&apos;m Playing
      </h2>

      {/* Live now-playing */}
      <NowPlaying accentColor={accentColor} />

      {/* Lifetime stats grid */}
      <LifetimeStatsBlock stats={data.stats} accentColor={accentColor} />

      {/* Top artists + genres — side by side on lg, stacked on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopArtistsList
          artists={data.topArtists}
          accentColor={accentColor}
        />
        <GenreBreakdown genres={data.genres} accentColor={accentColor} />
      </div>

      {/* Top tracks — full width */}
      <TopTracksList tracks={data.topTracks} accentColor={accentColor} />

      {/* Top albums — full width */}
      <TopAlbumsGrid albums={data.topAlbums} accentColor={accentColor} />

      <div className="scan-bar" />
    </section>
  );
}
