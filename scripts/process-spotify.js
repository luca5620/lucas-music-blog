const fs = require('fs');
const path = require('path');
const dir = path.join('C:', 'ClaudeWork', 'Spotify Extended Streaming History');
const files = fs.readdirSync(dir).filter(f => f.startsWith('Streaming_History_Audio') && f.endsWith('.json'));

let totalStreams = 0;
let totalMs = 0;
const artistMap = {};
const trackMap = {};
const albumMap = {};
const uniqueTracks = new Set();
const uniqueArtists = new Set();

for (const file of files) {
  const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  for (const entry of data) {
    const ms = entry.ms_played || 0;
    const artist = entry.master_metadata_album_artist_name;
    const track = entry.master_metadata_track_name;
    const album = entry.master_metadata_album_album_name;

    if (artist === null || track === null) continue;

    const isStream = ms >= 30000;

    totalMs += ms;
    if (isStream) totalStreams++;

    uniqueTracks.add(track + '|||' + artist);
    uniqueArtists.add(artist);

    if (!artistMap[artist]) artistMap[artist] = { ms: 0, streams: 0 };
    artistMap[artist].ms += ms;
    if (isStream) artistMap[artist].streams++;

    const tKey = track + '|||' + artist;
    if (!trackMap[tKey]) trackMap[tKey] = { ms: 0, streams: 0, album: album };
    trackMap[tKey].ms += ms;
    if (isStream) trackMap[tKey].streams++;

    if (album) {
      const aKey = album + '|||' + artist;
      if (!albumMap[aKey]) albumMap[aKey] = { ms: 0, streams: 0 };
      albumMap[aKey].ms += ms;
      if (isStream) albumMap[aKey].streams++;
    }
  }
}

const totalHours = Math.round(totalMs / 3600000);

const topArtists = Object.entries(artistMap)
  .map(([name, d]) => ({ name, hours: Math.round(d.ms / 3600000), streams: d.streams }))
  .sort((a, b) => b.hours - a.hours)
  .slice(0, 10);

const topTracks = Object.entries(trackMap)
  .map(([key, d]) => {
    const [name, artist] = key.split('|||');
    return { name, artist, streams: d.streams, hours: Math.round(d.ms / 3600000) };
  })
  .sort((a, b) => b.streams - a.streams)
  .slice(0, 10);

const topAlbums = Object.entries(albumMap)
  .map(([key, d]) => {
    const [name, artist] = key.split('|||');
    return { name, artist, hours: Math.round(d.ms / 3600000), streams: d.streams };
  })
  .sort((a, b) => b.hours - a.hours)
  .slice(0, 5);

console.log('=== SUMMARY ===');
console.log('Total streams (>30s):', totalStreams.toLocaleString());
console.log('Total hours:', totalHours.toLocaleString());
console.log('Unique artists:', uniqueArtists.size.toLocaleString());
console.log('Unique tracks:', uniqueTracks.size.toLocaleString());
console.log('Files processed:', files.length);
console.log('');
console.log('=== TOP 10 ARTISTS ===');
topArtists.forEach((a, i) => console.log((i + 1) + '. ' + a.name + ' — ' + a.hours + 'h / ' + a.streams.toLocaleString() + ' streams'));
console.log('');
console.log('=== TOP 10 TRACKS ===');
topTracks.forEach((t, i) => console.log((i + 1) + '. ' + t.name + ' — ' + t.artist + ' — ' + t.hours + 'h / ' + t.streams.toLocaleString() + ' plays'));
console.log('');
console.log('=== TOP 5 ALBUMS ===');
topAlbums.forEach((a, i) => console.log((i + 1) + '. ' + a.name + ' — ' + a.artist + ' — ' + a.hours + 'h'));
