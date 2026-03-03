/**
 * Fetch cover art for the Analytics page from Spotify API.
 * Downloads artist photos, track album art, and album covers.
 *
 * Usage: node scripts/fetch-analytics-covers.js
 */

const fs = require("fs");
const path = require("path");

// Load .env.local
const envPath = path.join(__dirname, "..", ".env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
const env = {};
for (const line of envContent.split("\n")) {
  const m = line.match(/^(\w+)=(.+)$/);
  if (m) env[m[1]] = m[2].trim();
}

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");
}

async function getToken() {
  const basic = Buffer.from(
    env.SPOTIFY_CLIENT_ID + ":" + env.SPOTIFY_CLIENT_SECRET
  ).toString("base64");
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: "Basic " + basic,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });
  return (await res.json()).access_token;
}

async function download(url, filepath) {
  const res = await fetch(url);
  fs.writeFileSync(filepath, Buffer.from(await res.arrayBuffer()));
}

async function searchArtist(token, name) {
  const q = encodeURIComponent(name);
  const res = await fetch(
    `https://api.spotify.com/v1/search?q=${q}&type=artist&limit=1`,
    { headers: { Authorization: "Bearer " + token } }
  );
  const data = await res.json();
  return data.artists?.items?.[0]?.images?.[0]?.url || null;
}

async function searchTrack(token, name, artist) {
  const q = encodeURIComponent(`track:${name} artist:${artist}`);
  const res = await fetch(
    `https://api.spotify.com/v1/search?q=${q}&type=track&limit=1`,
    { headers: { Authorization: "Bearer " + token } }
  );
  const data = await res.json();
  return data.tracks?.items?.[0]?.album?.images?.[0]?.url || null;
}

async function searchAlbum(token, name, artist) {
  const q = encodeURIComponent(`album:${name} artist:${artist}`);
  const res = await fetch(
    `https://api.spotify.com/v1/search?q=${q}&type=album&limit=1`,
    { headers: { Authorization: "Bearer " + token } }
  );
  const data = await res.json();
  return data.albums?.items?.[0]?.images?.[0]?.url || null;
}

async function main() {
  const token = await getToken();

  // --- Top Artists ---
  const artists = [
    "The Weeknd", "Kanye West", "Frank Ocean", "Travis Scott", "glaive",
    "Steve Lacy", "Drake", "D. Savage", "Playboi Carti", "Coldplay",
  ];
  const artistDir = path.join(__dirname, "..", "public", "analytics", "artists");
  fs.mkdirSync(artistDir, { recursive: true });

  console.log("=== TOP ARTISTS ===");
  for (const name of artists) {
    process.stdout.write(`  ${name}... `);
    const url = await searchArtist(token, name);
    if (!url) { console.log("NOT FOUND"); continue; }
    await download(url, path.join(artistDir, slug(name) + ".png"));
    console.log("OK");
  }

  // --- Top Tracks (album art for each track) ---
  const tracks = [
    ["House Of Balloons / Glass Table Girls", "The Weeknd"],
    ["needy", "Ariana Grande"],
    ["Mercury", "Steve Lacy"],
    ["Ain't Bout Nun", "RealYungPhil"],
    ["JOKER, PT. 2", "D. Savage"],
    ["Space Boy", "Manny Laurenko"],
    ["Butterfly", "Pi'erre Bourne"],
    ["Them > You (Gotta Go!)", "Autumn!"],
    ["Devil In A New Dress", "Kanye West"],
    ["HONEST", "Baby Keem"],
  ];
  const trackDir = path.join(__dirname, "..", "public", "analytics", "tracks");
  fs.mkdirSync(trackDir, { recursive: true });

  console.log("\n=== TOP TRACKS ===");
  for (const [name, artist] of tracks) {
    process.stdout.write(`  ${name}... `);
    const url = await searchTrack(token, name, artist);
    if (!url) { console.log("NOT FOUND"); continue; }
    await download(url, path.join(trackDir, slug(name) + ".png"));
    console.log("OK");
  }

  // --- Top Albums ---
  const albums = [
    ["House Of Balloons", "The Weeknd"],
    ["Blonde", "Frank Ocean"],
    ["UTOPIA", "Travis Scott"],
    ["My Beautiful Dark Twisted Fantasy", "Kanye West"],
    ["Thursday", "The Weeknd"],
  ];
  const albumDir = path.join(__dirname, "..", "public", "analytics", "albums");
  fs.mkdirSync(albumDir, { recursive: true });

  console.log("\n=== TOP ALBUMS ===");
  for (const [name, artist] of albums) {
    process.stdout.write(`  ${name}... `);
    const url = await searchAlbum(token, name, artist);
    if (!url) { console.log("NOT FOUND"); continue; }
    await download(url, path.join(albumDir, slug(name) + ".png"));
    console.log("OK");
  }

  console.log("\nDone!");
}

main().catch(console.error);
