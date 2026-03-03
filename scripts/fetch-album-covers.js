/**
 * Fetch Album Covers from Spotify API
 *
 * Uses the Spotify Search API to find album art for reviews
 * that are missing cover images. Downloads high-res images
 * and saves them as PNGs in public/reviews/.
 *
 * Usage: node scripts/fetch-album-covers.js
 * Requires: SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .env.local
 */

const fs = require("fs");
const path = require("path");

// Load .env.local
const envPath = path.join(__dirname, "..", ".env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
const env = {};
for (const line of envContent.split("\n")) {
  const match = line.match(/^(\w+)=(.+)$/);
  if (match) env[match[1]] = match[2].trim();
}

const CLIENT_ID = env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = env.SPOTIFY_CLIENT_SECRET;
const REVIEWS_DIR = path.join(__dirname, "..", "public", "reviews");
const REVIEWS_FILE = path.join(__dirname, "..", "lib", "reviews.ts");

/**
 * Parse review objects from lib/reviews.ts.
 * Extracts slug, title, artist, coverImage from each top-level review entry.
 * Skips standoutTracks nested objects.
 */
function parseReviews() {
  const fileContent = fs.readFileSync(REVIEWS_FILE, "utf-8");

  // Match each review object block: starts with { and slug:
  const reviewBlocks = [];
  const blockRegex = /\{\s*slug:\s*"([^"]+)"[\s\S]*?standoutTracks:/g;
  let match;

  while ((match = blockRegex.exec(fileContent)) !== null) {
    const block = match[0];
    const slug = match[1];

    // Extract title — first title: after slug:
    const titleMatch = block.match(/^\s*slug:[\s\S]*?title:\s*"([^"]+)"/m);
    // Extract artist — first artist: after title:
    const artistMatch = block.match(
      /^\s*slug:[\s\S]*?title:[\s\S]*?artist:\s*"([^"]+)"/m
    );
    // Extract coverImage
    const coverMatch = block.match(/coverImage:\s*"([^"]*)"/);

    if (titleMatch && artistMatch && coverMatch) {
      reviewBlocks.push({
        slug,
        title: titleMatch[1],
        artist: artistMatch[1],
        coverImage: coverMatch[1],
      });
    }
  }

  return reviewBlocks;
}

async function getAccessToken() {
  const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString(
    "base64"
  );
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });
  const data = await res.json();
  return data.access_token;
}

async function searchAlbum(token, title, artist) {
  const query = encodeURIComponent(`album:${title} artist:${artist}`);
  const res = await fetch(
    `https://api.spotify.com/v1/search?q=${query}&type=album&limit=1`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  const album = data.albums?.items?.[0];
  if (!album) return null;
  // Get the largest image (usually 640x640)
  const image = album.images?.[0];
  return image?.url || null;
}

async function downloadImage(url, filepath) {
  const res = await fetch(url);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(filepath, buffer);
}

async function main() {
  const allReviews = parseReviews();
  const reviews = allReviews.filter((r) => !r.coverImage);

  console.log(`Parsed ${allReviews.length} total reviews.`);

  if (reviews.length === 0) {
    console.log("All reviews already have cover images!");
    return;
  }

  console.log(`Found ${reviews.length} reviews missing covers:\n`);
  reviews.forEach((r) => console.log(`  - ${r.title} by ${r.artist} (${r.slug})`));
  console.log();

  // Ensure output dir exists
  if (!fs.existsSync(REVIEWS_DIR)) {
    fs.mkdirSync(REVIEWS_DIR, { recursive: true });
  }

  const token = await getAccessToken();
  const updates = [];

  for (const review of reviews) {
    process.stdout.write(`Fetching: ${review.title} by ${review.artist}... `);
    const imageUrl = await searchAlbum(token, review.title, review.artist);

    if (!imageUrl) {
      console.log("NOT FOUND");
      continue;
    }

    const filename = `${review.slug}.png`;
    const filepath = path.join(REVIEWS_DIR, filename);
    await downloadImage(imageUrl, filepath);
    console.log(`OK -> ${filename}`);
    updates.push({ slug: review.slug, coverImage: `/reviews/${filename}` });
  }

  if (updates.length === 0) {
    console.log("\nNo covers found on Spotify.");
    return;
  }

  // Update reviews.ts with the new cover paths
  let updatedFile = fs.readFileSync(REVIEWS_FILE, "utf-8");
  for (const update of updates) {
    // Find the review block by slug and update its coverImage
    const pattern = new RegExp(
      `(slug:\\s*"${update.slug}"[\\s\\S]*?coverImage:\\s*)""`
    );
    updatedFile = updatedFile.replace(pattern, `$1"${update.coverImage}"`);
  }

  fs.writeFileSync(REVIEWS_FILE, updatedFile);

  console.log(
    `\nDone! Updated ${updates.length} cover images in lib/reviews.ts`
  );
  console.log("Files saved to public/reviews/");
}

main().catch(console.error);
