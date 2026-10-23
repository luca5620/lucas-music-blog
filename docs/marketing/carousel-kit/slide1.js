// Slide 1: Sol's TV photo + a designed CH 01 screen fitted into the glass.
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-core");
const sharp = require(path.join("C:/Users/lucap/claudework/lucas-music-blog/node_modules/sharp"));
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const SRC = "C:/Users/lucap/OneDrive/Desktop/download.png";

// Screen glass in the 1120x1400 photo (measured).
const S = { x: 268, y: 166, w: 670, h: 492, rx: 92, ry: 78 };
const SCALE = 2; // render the screen at 2x, then shrink — crisper text

const html = `<!doctype html><meta charset=utf-8><style>
@font-face{font-family:Chakra;src:url(../fonts/ChakraPetch-Bold.ttf)}
@font-face{font-family:VT;src:url(../fonts/VT323-Regular.ttf)}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${S.w}px;height:${S.h}px;overflow:hidden}
body{position:relative;background:radial-gradient(ellipse at 50% 42%,#123a7a 0%,#0a2350 45%,#041029 80%,#020814 100%)}
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

  // Rounded CRT-glass mask with a soft edge so it melts into the bezel.
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${S.w}" height="${S.h}">
    <defs><filter id="b"><feGaussianBlur stdDeviation="3"/></filter></defs>
    <rect x="3" y="3" width="${S.w - 6}" height="${S.h - 6}" rx="${S.rx}" ry="${S.ry}" fill="#fff" filter="url(#b)"/></svg>`);
  const screen = await sharp(shot)
    .resize(S.w, S.h)
    .composite([{ input: await sharp(mask).png().toBuffer(), blend: "dest-in" }])
    .png()
    .toBuffer();

  // Faint glass highlight on top, like light catching the tube.
  const glare = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${S.w}" height="${S.h}">
    <defs><radialGradient id="g" cx="30%" cy="18%" r="60%"><stop offset="0" stop-color="#fff" stop-opacity=".10"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
    <rect width="${S.w}" height="${S.h}" rx="${S.rx}" ry="${S.ry}" fill="url(#g)"/></svg>`);

  await sharp(SRC)
    .composite([
      { input: screen, left: S.x, top: S.y },
      { input: await sharp(glare).png().toBuffer(), left: S.x, top: S.y },
    ])
    .resize(1080, 1350)
    .png()
    .toFile(path.join(__dirname, "slide1-A-crt.png"));
  console.log("ok");
})();
