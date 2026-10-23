// Slide 1: Sol's TV photo + a designed CH 01 screen fitted into the glass.
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-core");
const sharp = require(path.join("C:/Users/lucap/claudework/lucas-music-blog/node_modules/sharp"));
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const SRC = "C:/Users/lucap/OneDrive/Desktop/download.png";

// Screen glass in the 1120x1400 photo (measured).
const S = { x: 264, y: 168, w: 676, h: 492, rx: 0, ry: 0 };
const SCALE = 2; // render the screen at 2x, then shrink — crisper text

const html = `<!doctype html><meta charset=utf-8><style>
@font-face{font-family:Chakra;src:url(../fonts/ChakraPetch-Bold.ttf)}
@font-face{font-family:VT;src:url(../fonts/VT323-Regular.ttf)}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${S.w}px;height:${S.h}px;overflow:hidden}
body{position:relative;box-shadow:inset 0 0 60px rgba(0,0,0,.55);background:radial-gradient(ellipse at 50% 42%,#123a7a 0%,#0a2350 45%,#041029 80%,#020814 100%)}
body:after{content:"";position:absolute;inset:0;background:
  repeating-linear-gradient(0deg,rgba(0,0,0,.25) 0 1px,transparent 1px 3px),
  radial-gradient(ellipse at 50% 50%,transparent 55%,rgba(0,0,0,.55) 100%)}
.osd{position:absolute;top:34px;left:62px;right:62px;display:flex;justify-content:space-between;
  font-family:VT;font-size:34px;color:#8fdcff;text-shadow:0 0 10px rgba(30,144,255,.9)}
.dot{display:inline-block;width:14px;height:14px;border-radius:50%;background:#ff3b5c;box-shadow:0 0 10px #ff3b5c;margin-right:8px;transform:translateY(-2px)}
.c{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding-top:14px}
.big{font-family:Chakra;font-size:176px;line-height:.9;color:#f2f7ff;letter-spacing:-2px;
  text-shadow:3px 0 rgba(255,45,85,.6),-3px 0 rgba(0,200,255,.6),0 0 40px rgba(60,160,255,.75)}
.mid{font-family:Chakra;font-size:40px;color:#eaf3ff;letter-spacing:1px;margin-top:6px;
  text-shadow:1.5px 0 rgba(255,45,85,.5),-1.5px 0 rgba(0,200,255,.5),0 0 18px rgba(60,160,255,.6)}
.low{font-family:VT;font-size:34px;color:#8fdcff;margin-top:16px;letter-spacing:2px;text-shadow:0 0 10px rgba(30,144,255,.9)}
.bar{position:absolute;bottom:40px;left:50%;transform:translateX(-50%);font-family:VT;font-size:26px;color:#6fb8e6;letter-spacing:3px}
</style>
<div class=osd><span>CH 01</span><span><span class=dot></span>LIVE</span></div>
<div class=c>
  <div class=big>100+</div>
  <div class=mid>MEMBERS ON PEAK MUSIC</div>
  <div class=low>THANK YOU FOR TUNING IN ▸▸</div>
</div>
<div class=bar>SWIPE FOR WHAT WE BUILT</div>`;

(async () => {
  const f = path.join(__dirname, "screen1.html");
  fs.writeFileSync(f, html);
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new" });
  const page = await browser.newPage();
  await page.setViewport({ width: S.w, height: S.h, deviceScaleFactor: SCALE });
  await page.goto("file:///" + f.replace(/\\/g, "/"), { waitUntil: "networkidle0" });
  await page.evaluate(() => document.fonts.ready);
  const shot = await page.screenshot({ type: "png" });
  await browser.close();

  // Mask traced from the photo itself: the glass is the light-blue
  // area, the TV's lit plastic frame around it is darker/saturated
  // blue. Covering exactly the glass (grown 2px to swallow its
  // anti-aliased rim) keeps the frame untouched and the edge crisp —
  // a drawn rounded rectangle either left glass showing or smeared
  // over the frame.
  // The glass is bright (luma ~160–190) and the frame right next to it
  // is dark (~55), with a 1px step between them. So the mask is simply
  // "every glass pixel": solid inside, and on the 1px rim the photo's
  // own in-between brightness becomes partial alpha — the edge is as
  // crisp and as smoothly rounded as the photo itself, no fade, no
  // stair-steps, and the frame is never painted over.
  const { data: px, info: full } = await sharp(SRC).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const luma = (x, y) => {
    const i = ((S.y + y) * full.width + S.x + x) * 3;
    return 0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2];
  };
  const W = S.w, H = S.h, at = (x, y) => y * W + x;
  const glass = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) glass[at(x, y)] = luma(x, y) > 110 ? 1 : 0;
  // Flood-fill the non-glass area from the box border; whatever it
  // can't reach is inside the screen (fills any dark specks in the glass).
  const outside = new Uint8Array(W * H);
  const stack = [];
  for (let x = 0; x < W; x++) stack.push([x, 0], [x, H - 1]);
  for (let y = 0; y < H; y++) stack.push([0, y], [W - 1, y]);
  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || y < 0 || x >= W || y >= H || outside[at(x, y)] || glass[at(x, y)]) continue;
    outside[at(x, y)] = 1;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  const mask = Buffer.alloc(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!outside[at(x, y)]) { mask[at(x, y)] = 255; continue; }
    // Rim pixel (touches the glass): partial alpha from its brightness.
    let touches = false;
    for (let dy = -1; dy <= 1 && !touches; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < W && ny < H && !outside[at(nx, ny)]) { touches = true; break; }
    }
    if (touches) mask[at(x, y)] = Math.round(255 * Math.min(1, Math.max(0, (luma(x, y) - 55) / 100)));
  }

  const rgb = await sharp(shot).resize(S.w, S.h).removeAlpha().raw().toBuffer();
  const rgba = Buffer.alloc(S.w * S.h * 4);
  for (let i = 0; i < S.w * S.h; i++) {
    rgba[i * 4] = rgb[i * 3];
    rgba[i * 4 + 1] = rgb[i * 3 + 1];
    rgba[i * 4 + 2] = rgb[i * 3 + 2];
    rgba[i * 4 + 3] = mask[i];
  }
  const screen = await sharp(rgba, { raw: { width: S.w, height: S.h, channels: 4 } }).png().toBuffer();

  // Composite at full size FIRST, then shrink in a second pass — sharp
  // runs resize before composite inside one pipeline, which pasted the
  // screen onto the already-shrunk photo and shifted it right/down.
  const full1 = await sharp(SRC).composite([{ input: screen, left: S.x, top: S.y }]).png().toBuffer();
  await sharp(full1).resize(1080, 1350).png().toFile(path.join(__dirname, "slide1-A-crt.png"));
  console.log("ok");
})();
