const fs = require('fs');
const path = require('path');

// Directory containing the streaming history JSON files
const historyDir = path.join('C:', 'ClaudeWork', 'Spotify Extended Streaming History');

// Read all audio streaming history files
const files = fs.readdirSync(historyDir).filter(f => f.startsWith('Streaming_History_Audio_') && f.endsWith('.json'));

let allEntries = [];
for (const file of files) {
  const filePath = path.join(historyDir, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  allEntries = allEntries.concat(data);
}

console.error(`Loaded ${allEntries.length} total entries from ${files.length} files`);

// Normalize strings: replace smart quotes with regular ones for matching
function normalize(str) {
  if (!str) return '';
  return str
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")  // smart single quotes -> apostrophe
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"');  // smart double quotes -> regular quotes
}

// ---- Top 10 Artists: find most played track per artist ----
const topArtists = [
  'The Weeknd',
  'Kanye West',
  'Frank Ocean',
  'Travis Scott',
  'glaive',
  'Steve Lacy',
  'Drake',
  'D. Savage',
  'Playboi Carti',
  'Coldplay',
];

// For each artist, accumulate ms_played per track and pick the top one
const artistImages = {};
for (const artist of topArtists) {
  const trackMs = {}; // key: trackName, value: { ms: number, uri: string }
  for (const entry of allEntries) {
    if (normalize(entry.master_metadata_album_artist_name) === artist && entry.spotify_track_uri) {
      const trackName = entry.master_metadata_track_name || 'Unknown';
      if (!trackMs[trackName]) {
        trackMs[trackName] = { ms: 0, uri: entry.spotify_track_uri };
      }
      trackMs[trackName].ms += entry.ms_played || 0;
      // Keep the URI from the entry (they should all be the same for the same track)
      if (!trackMs[trackName].uri && entry.spotify_track_uri) {
        trackMs[trackName].uri = entry.spotify_track_uri;
      }
    }
  }

  // Find the track with the most ms_played
  let bestTrack = null;
  let bestMs = 0;
  for (const [trackName, info] of Object.entries(trackMs)) {
    if (info.ms > bestMs) {
      bestMs = info.ms;
      bestTrack = { trackName, ...info };
    }
  }

  if (bestTrack && bestTrack.uri) {
    const trackId = bestTrack.uri.replace('spotify:track:', '');
    artistImages[artist] = trackId;
    console.error(`  Artist "${artist}" -> most played track: "${bestTrack.trackName}" (${(bestMs / 60000).toFixed(1)} min) -> ${trackId}`);
  } else {
    artistImages[artist] = null;
    console.error(`  Artist "${artist}" -> NO TRACK FOUND`);
  }
}

// ---- Top 10 Tracks: find the spotify track ID for each ----
const topTracks = [
  { track: 'House Of Balloons / Glass Table Girls', artist: 'The Weeknd' },
  { track: 'needy', artist: 'Ariana Grande' },
  { track: 'Mercury', artist: 'Steve Lacy' },
  { track: "Ain't Bout Nun", artist: 'RealYungPhil' },
  { track: 'JOKER, PT. 2', artist: 'D. Savage' },
  { track: 'Space Boy (feat. Lucki)', artist: 'Manny Laurenko' },
  { track: 'Butterfly', artist: "Pi'erre Bourne" },
  { track: 'Them > You (Gotta Go!)', artist: 'Autumn!' },
  { track: 'Devil In A New Dress', artist: 'Kanye West' },
  { track: 'HONEST', artist: 'Baby Keem' },
];

const trackIds = {};
for (const { track, artist } of topTracks) {
  const key = `${track}|||${artist}`;

  // Try exact match first (with normalized strings)
  let found = null;
  for (const entry of allEntries) {
    if (
      normalize(entry.master_metadata_track_name) === track &&
      normalize(entry.master_metadata_album_artist_name) === artist &&
      entry.spotify_track_uri
    ) {
      found = entry.spotify_track_uri.replace('spotify:track:', '');
      break;
    }
  }

  // If no exact match, try case-insensitive match
  if (!found) {
    const trackLower = track.toLowerCase();
    const artistLower = artist.toLowerCase();
    for (const entry of allEntries) {
      if (
        entry.master_metadata_track_name &&
        entry.master_metadata_album_artist_name &&
        normalize(entry.master_metadata_track_name).toLowerCase() === trackLower &&
        normalize(entry.master_metadata_album_artist_name).toLowerCase() === artistLower &&
        entry.spotify_track_uri
      ) {
        found = entry.spotify_track_uri.replace('spotify:track:', '');
        break;
      }
    }
  }

  // If still not found, try partial match on track name + exact artist
  if (!found) {
    const trackLower = track.toLowerCase();
    const artistLower = artist.toLowerCase();
    for (const entry of allEntries) {
      if (
        entry.master_metadata_track_name &&
        entry.master_metadata_album_artist_name &&
        normalize(entry.master_metadata_album_artist_name).toLowerCase() === artistLower &&
        entry.spotify_track_uri &&
        (normalize(entry.master_metadata_track_name).toLowerCase().includes(trackLower) ||
         trackLower.includes(normalize(entry.master_metadata_track_name).toLowerCase()))
      ) {
        found = entry.spotify_track_uri.replace('spotify:track:', '');
        console.error(`  Track "${track}" by "${artist}" -> partial match on "${entry.master_metadata_track_name}"`);
        break;
      }
    }
  }

  trackIds[key] = found;
  if (found) {
    console.error(`  Track "${track}" by "${artist}" -> ${found}`);
  } else {
    console.error(`  Track "${track}" by "${artist}" -> NOT FOUND`);
  }
}

// ---- Top 5 Albums: find any track from each album ----
const topAlbums = [
  { album: 'House Of Balloons - Original', artist: 'The Weeknd' },
  { album: 'Blonde', artist: 'Frank Ocean' },
  { album: 'UTOPIA', artist: 'Travis Scott' },
  { album: 'My Beautiful Dark Twisted Fantasy', artist: 'Kanye West' },
  { album: 'Thursday - Original', artist: 'The Weeknd' },
];

const albumTrackIds = {};
for (const { album, artist } of topAlbums) {
  const key = `${album}|||${artist}`;

  // Try exact match first (with normalized strings)
  let found = null;
  for (const entry of allEntries) {
    if (
      normalize(entry.master_metadata_album_album_name) === album &&
      normalize(entry.master_metadata_album_artist_name) === artist &&
      entry.spotify_track_uri
    ) {
      found = entry.spotify_track_uri.replace('spotify:track:', '');
      break;
    }
  }

  // If no exact match, try case-insensitive
  if (!found) {
    const albumLower = album.toLowerCase();
    const artistLower = artist.toLowerCase();
    for (const entry of allEntries) {
      if (
        entry.master_metadata_album_album_name &&
        entry.master_metadata_album_artist_name &&
        normalize(entry.master_metadata_album_album_name).toLowerCase() === albumLower &&
        normalize(entry.master_metadata_album_artist_name).toLowerCase() === artistLower &&
        entry.spotify_track_uri
      ) {
        found = entry.spotify_track_uri.replace('spotify:track:', '');
        break;
      }
    }
  }

  // Partial match on album name
  if (!found) {
    const albumLower = album.toLowerCase();
    const artistLower = artist.toLowerCase();
    for (const entry of allEntries) {
      if (
        entry.master_metadata_album_album_name &&
        entry.master_metadata_album_artist_name &&
        normalize(entry.master_metadata_album_artist_name).toLowerCase() === artistLower &&
        entry.spotify_track_uri &&
        (normalize(entry.master_metadata_album_album_name).toLowerCase().includes(albumLower) ||
         albumLower.includes(normalize(entry.master_metadata_album_album_name).toLowerCase()))
      ) {
        found = entry.spotify_track_uri.replace('spotify:track:', '');
        console.error(`  Album "${album}" by "${artist}" -> partial match on album "${entry.master_metadata_album_album_name}"`);
        break;
      }
    }
  }

  albumTrackIds[key] = found;
  if (found) {
    console.error(`  Album "${album}" by "${artist}" -> ${found}`);
  } else {
    console.error(`  Album "${album}" by "${artist}" -> NOT FOUND`);
  }
}

// Output the final JSON
const result = {
  artistImages,
  trackIds,
  albumTrackIds,
};

console.log(JSON.stringify(result, null, 2));
