/**
 * Apple "client secret" generator — for Sign in with Apple.
 *
 * Apple is the odd one out among OAuth providers: instead of handing
 * you a client secret string, it hands you a private key (.p8) and
 * expects you to MINT a secret yourself — a JWT, signed with that key,
 * that says "I am team X, app Y, and this is valid until <date>".
 * That JWT is what goes in Supabase's "Secret Key" box.
 *
 * Apple caps the lifetime at 6 months, so this has to be re-run every
 * 6 months (or Apple sign-in silently stops working). That's the whole
 * reason this script lives in the repo instead of being a one-off.
 *
 * Usage — from the repo root:
 *
 *   node scripts/apple-secret.mjs \
 *     --team ABCDE12345 \
 *     --key-id XYZ9876543 \
 *     --client-id com.peakmusicreviews.web \
 *     --p8 "C:/path/to/AuthKey_XYZ9876543.p8"
 *
 * where:
 *   --team       Team ID    — developer.apple.com, top right, 10 chars
 *   --key-id     Key ID     — shown when you created the key (also the
 *                             AuthKey_XXXXXXXXXX.p8 filename)
 *   --client-id  Services ID — NOT the app's bundle ID
 *   --p8         path to the .p8 file you downloaded once
 *
 * It prints the JWT. Paste it into Supabase → Authentication →
 * Providers → Apple → Secret Key.
 *
 * Nothing leaves this machine — the signing happens locally with
 * node's built-in crypto, which is the point: never paste a .p8 into
 * some stranger's "Apple JWT generator" website.
 */

import { readFileSync } from "node:fs";
import { createPrivateKey, sign } from "node:crypto";

/* ---------- args ---------- */

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : process.argv[i + 1];
}

const teamId = arg("team");
const keyId = arg("key-id");
const clientId = arg("client-id");
const p8Path = arg("p8");

if (!teamId || !keyId || !clientId || !p8Path) {
  console.error(
    "Missing args. Need --team, --key-id, --client-id and --p8.\n" +
      "See the comment at the top of scripts/apple-secret.mjs."
  );
  process.exit(1);
}

/* ---------- the JWT ---------- */

// base64url = base64 with +/ swapped for -_ and the = padding dropped.
// It's what JWTs use so the token is safe inside a URL.
const b64url = (input) =>
  Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const now = Math.floor(Date.now() / 1000);
const SIX_MONTHS = 60 * 60 * 24 * 180; // Apple's hard maximum

// Header: ES256 (ECDSA P-256 + SHA-256) is the only algorithm Apple
// accepts here; `kid` tells Apple WHICH of your keys signed this.
const header = { alg: "ES256", kid: keyId };

const payload = {
  iss: teamId, // issuer  = your Team ID
  iat: now, // issued at
  exp: now + SIX_MONTHS, // expires — the 6-month clock
  aud: "https://appleid.apple.com", // audience is always Apple
  sub: clientId, // subject = the Services ID
};

const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;

let privateKey;
try {
  privateKey = createPrivateKey(readFileSync(p8Path, "utf8"));
} catch (err) {
  console.error(`Could not read the .p8 at ${p8Path}\n${err.message}`);
  process.exit(1);
}

// dsaEncoding "ieee-p1363" gives the raw r||s signature JWTs want;
// node's default (DER) would produce a token Apple rejects.
const signature = sign("sha256", Buffer.from(signingInput), {
  key: privateKey,
  dsaEncoding: "ieee-p1363",
});

const token = `${signingInput}.${b64url(signature)}`;

const expires = new Date((now + SIX_MONTHS) * 1000).toISOString().slice(0, 10);

console.log(`\n${token}\n`);
console.log(`Expires ${expires} — set a calendar reminder a week before,`);
console.log(`then re-run this with the same .p8 and paste the new value.\n`);
