// 100-members carousel — slides 2 + 3 in two looks (A = CRT channel,
// B = cassette card). Real data pulled from Supabase 2026-10-22.
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-core");
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";

const D = {
  reviews: 266, rated: 234, avg: "8.8", busiest: { n: 33, day: "Oct 9" },
  top: [["ayzen_26", 46], ["optimal_jason", 27], ["worldtraveler16", 19], ["austin_zalke_97", 14]],
  fav: { title: "The Dark Side of the Moon", artist: "Pink Floyd", score: "9.8", n: 5 },
};

const FONTS = `
@font-face{font-family:Chakra;src:url(../fonts/ChakraPetch-Bold.ttf)}
@font-face{font-family:VT;src:url(../fonts/VT323-Regular.ttf)}
@font-face{font-family:Inter;src:url(../fonts/Inter.ttf)}
@font-face{font-family:Marker;src:url(../fonts/PermanentMarker-Regular.ttf)}
@font-face{font-family:Type;src:url(../fonts/SpecialElite-Regular.ttf)}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1080px;height:1350px;overflow:hidden}
`;

// ---------- A: CRT channel ----------
const crtShell = (ch, label, inner) => `<!doctype html><meta charset=utf-8><style>${FONTS}
body{background:radial-gradient(ellipse at 50% 40%,#101826 0%,#050608 70%);font-family:Inter}
.tv{position:absolute;inset:40px;border-radius:56px;background:linear-gradient(#1b1b20,#0c0c0f);
  box-shadow:0 30px 80px #000,inset 0 2px 0 #2a2a31;padding:34px}
.screen{position:relative;width:100%;height:100%;border-radius:38px;overflow:hidden;
  background:radial-gradient(ellipse at 50% 35%,#0d2a5c 0%,#071733 55%,#030a18 100%);
  box-shadow:inset 0 0 120px rgba(0,0,0,.85),inset 0 0 30px rgba(30,144,255,.25)}
.screen:after{content:"";position:absolute;inset:0;pointer-events:none;
  background:repeating-linear-gradient(0deg,rgba(0,0,0,.22) 0 2px,transparent 2px 4px)}
.osd{position:absolute;top:34px;left:44px;right:44px;display:flex;justify-content:space-between;
  font-family:VT;font-size:44px;color:#7fd3ff;text-shadow:0 0 12px rgba(30,144,255,.8)}
.content{position:absolute;inset:110px 56px 56px}
h1{font-family:Chakra;font-size:78px;line-height:.95;color:#eef4ff;letter-spacing:-1px;
  text-shadow:2px 0 rgba(255,45,85,.55),-2px 0 rgba(0,200,255,.55),0 0 30px rgba(30,144,255,.35)}
.k{font-family:VT;color:#7fd3ff;font-size:34px;letter-spacing:2px;text-shadow:0 0 10px rgba(30,144,255,.7)}
.foot{position:absolute;bottom:0;left:0;right:0;display:flex;justify-content:space-between;align-items:center;
  font-family:VT;font-size:34px;color:#9fb6d8}
.foot img{width:54px;height:54px;border-radius:12px}
</style><div class=tv><div class=screen>
<div class=osd><span>CH ${ch}</span><span>${label}</span></div>
<div class=content>${inner}</div></div></div>`;

const slide2A = crtShell("02", "COMMUNITY", `
<h1>WHAT 100+ OF YOU<br>BUILT SO FAR</h1>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:26px 30px;margin-top:44px">
${[[D.reviews, "reviews written"], [D.rated, "albums &amp; songs rated"], [D.avg, "average score out of 10"], [D.busiest.n, `reviews on ${D.busiest.day}, our busiest day`]]
  .map(([n, l]) => `<div style="border:2px solid rgba(127,211,255,.35);border-radius:18px;padding:20px 24px;background:rgba(3,10,24,.45)">
  <div style="font-family:Chakra;font-size:92px;line-height:1;color:#fff;text-shadow:0 0 24px rgba(30,144,255,.6)">${n}</div>
  <div style="font-size:28px;color:#bcd3f2;margin-top:6px">${l}</div></div>`).join("")}
</div>
<div style="display:grid;grid-template-columns:1.15fr 1fr;gap:30px;margin-top:40px">
  <div><div class=k>TOP REVIEWERS</div>
  ${D.top.map(([u, n], i) => `<div style="display:flex;align-items:baseline;gap:14px;margin-top:14px;font-size:34px;color:#eef4ff">
    <span style="font-family:VT;color:#7fd3ff;font-size:38px">0${i + 1}</span><span style="font-weight:600">@${u}</span>
    <span style="flex:1;border-bottom:2px dotted rgba(127,211,255,.35);transform:translateY(-8px)"></span>
    <span style="font-family:Chakra">${n}</span></div>`).join("")}</div>
  <div><div class=k>COMMUNITY FAVOURITE</div>
    <div style="display:flex;gap:18px;margin-top:16px;align-items:center">
      <img src="dsotm.jpg" style="width:150px;height:150px;border-radius:10px;box-shadow:0 0 30px rgba(30,144,255,.35)">
      <div><div style="font-family:Chakra;font-size:76px;line-height:1;color:#c9a2ff;text-shadow:0 0 22px rgba(170,110,255,.7)">${D.fav.score}</div>
      <div style="font-size:24px;color:#bcd3f2">from ${D.fav.n} reviews</div></div></div>
    <div style="font-size:28px;font-weight:600;color:#fff;margin-top:12px">${D.fav.title}</div>
    <div style="font-size:24px;color:#7fd3ff">${D.fav.artist}</div></div>
</div>
<div class=foot><span>THANK YOU FOR TUNING IN</span><span style="display:flex;gap:12px;align-items:center">peakmusicreviews.com<img src="penguin.webp"></span></div>`);

const phone = (w, rot = 0) => `<div style="width:${w}px;aspect-ratio:1170/2532;border-radius:${w * 0.13}px;padding:${w * 0.035}px;
  background:linear-gradient(145deg,#3a3a42,#0d0d10);box-shadow:0 40px 90px rgba(0,0,0,.7),inset 0 0 0 2px #50505a;transform:rotate(${rot}deg)">
  <div style="position:relative;width:100%;height:100%;border-radius:${w * 0.1}px;overflow:hidden;background:#000">
  <!-- iOS status bar + Dynamic Island: the app sits below the safe area -->
  <div style="height:${w * 0.13}px;display:flex;justify-content:space-between;align-items:center;padding:0 ${w * 0.08}px;
    font-family:Inter;font-weight:600;font-size:${w * 0.045}px;color:#fff;background:#0b0d12">
    <span>9:41</span>
    <span style="display:flex;gap:${w * 0.015}px;align-items:center">
      <svg width="${w * 0.055}" height="${w * 0.035}" viewBox="0 0 18 12" fill="#fff"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5" width="3" height="7" rx="1"/><rect x="10" y="2.5" width="3" height="9.5" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>
      <span style="display:inline-block;width:${w * 0.075}px;height:${w * 0.036}px;border:1.5px solid rgba(255,255,255,.6);border-radius:4px;padding:1.5px"><span style="display:block;width:80%;height:100%;background:#fff;border-radius:2px"></span></span>
    </span></div>
  <div style="position:absolute;top:${w * 0.03}px;left:50%;transform:translateX(-50%);width:${w * 0.3}px;height:${w * 0.085}px;background:#000;border-radius:999px"></div>
  <img src="app-release.png" style="width:100%;display:block"></div></div>`;

const badge = (dark = true) => `<div style="display:inline-flex;align-items:center;gap:16px;padding:16px 30px;border-radius:18px;
  background:${dark ? "#000" : "#111"};border:2px solid #a6a6a6;color:#fff">
  <svg width="42" height="50" viewBox="0 0 384 512" fill="#fff"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/></svg>
  <div style="font-family:Inter;line-height:1.05"><div style="font-size:20px;letter-spacing:1px">Download on the</div><div style="font-size:40px;font-weight:600">App Store</div></div></div>`;

const slide3A = crtShell("03", "JOIN IN", `
<h1 style="font-size:70px">RATE EVERY ALBUM<br>0–10. EVEN THE LEAKS.</h1>
<div style="font-size:30px;color:#bcd3f2;margin-top:18px;line-height:1.35">The music community 100+ of you already call home. Come rate with us.</div>
<div style="position:absolute;left:0;right:0;top:290px;display:flex;gap:40px;align-items:center">
  <div style="flex:none">${phone(330)}</div>
  <div style="display:flex;flex-direction:column;gap:22px">
    ${[["0–10", "Scores with one decimal"], ["LEAK", "Unreleased &amp; leaked songs"], ["VS", "Aux Wars: song vs song"], ["LIVE", "Rooms when albums drop at midnight"]]
      .map(([t, l]) => `<div style="display:flex;gap:16px;align-items:center"><span style="font-family:VT;font-size:30px;color:#030a18;background:#7fd3ff;border-radius:8px;padding:2px 10px;min-width:86px;text-align:center">${t}</span><span style="font-size:28px;color:#eef4ff;line-height:1.2">${l}</span></div>`).join("")}
    <div style="margin-top:14px">${badge()}</div>
    <div class=k style="font-size:28px">FREE · PEAKMUSICREVIEWS.COM</div>
  </div></div>`);

// ---------- B: cassette card ----------
const paper = `background:#efe6d2;background-image:
  repeating-linear-gradient(0deg,rgba(120,90,40,.035) 0 1px,transparent 1px 3px),
  radial-gradient(ellipse at 30% 20%,rgba(255,255,255,.5),transparent 60%),
  radial-gradient(ellipse at 80% 90%,rgba(140,100,40,.18),transparent 60%);`;
const desk = `background:#1a120c;background-image:radial-gradient(ellipse at 50% 30%,#3a2618 0%,#120c08 75%);`;
const tape = (css) => `<div style="position:absolute;width:150px;height:46px;background:rgba(235,225,190,.82);
  box-shadow:0 2px 6px rgba(0,0,0,.25);${css}"></div>`;

const slide2B = `<!doctype html><meta charset=utf-8><style>${FONTS}
body{${desk}font-family:Type;color:#2a2118}
.card{position:absolute;left:60px;top:70px;width:960px;height:1210px;${paper}border-radius:6px;
  box-shadow:0 30px 70px rgba(0,0,0,.6);transform:rotate(-1.2deg);padding:60px 64px}
.rule{border-top:3px solid #c0392b;margin:10px 0 0}
.side{font-family:Chakra;font-size:30px;letter-spacing:4px;color:#c0392b;margin-top:34px}
.row{display:flex;gap:18px;font-size:36px;margin-top:16px;align-items:baseline}
.row b{font-family:Chakra;color:#c0392b;font-size:30px;width:56px}
.hand{font-family:Marker;color:#1d3fbf}
</style>
<div class=card>
  ${tape("top:-20px;left:380px;transform:rotate(3deg)")}
  <div style="display:flex;justify-content:space-between;align-items:flex-start">
    <div><div class=hand style="font-size:84px;line-height:1">100+ of you.</div>
    <div class=hand style="font-size:60px;line-height:1.1;margin-top:6px">Thank you.</div></div>
    <div style="font-family:Chakra;font-size:22px;letter-spacing:3px;text-align:right;color:#6b5a44;margin-top:10px">PEAK MUSIC<br>MIXTAPE VOL. 1<br>C-100</div>
  </div>
  <div class=rule></div>
  <div class=side>SIDE A — WHAT WE MADE</div>
  <div class=row><b>A1</b><span><span class=hand style="font-size:44px">${D.reviews}</span> reviews written</span></div>
  <div class=row><b>A2</b><span><span class=hand style="font-size:44px">${D.rated}</span> albums &amp; songs rated</span></div>
  <div class=row><b>A3</b><span><span class=hand style="font-size:44px">${D.avg}</span> average score out of 10</span></div>
  <div class=row><b>A4</b><span><span class=hand style="font-size:44px">${D.busiest.n}</span> reviews on ${D.busiest.day} (busiest day)</span></div>
  <div class=side>SIDE B — TOP REVIEWERS <span style="font-size:22px;letter-spacing:2px;color:#6b5a44">(REVIEWS WRITTEN)</span></div>
  ${D.top.map(([u, n], i) => `<div class=row><b>B${i + 1}</b><span>@${u}</span><span style="color:#6b5a44">—</span><span class=hand style="font-size:40px">${n}</span></div>`).join("")}
  <div style="position:absolute;right:70px;bottom:90px;transform:rotate(4deg)">
    ${tape("top:-22px;left:60px;transform:rotate(-6deg);z-index:2")}
    <img src="dsotm.jpg" style="width:230px;height:230px;display:block;box-shadow:0 10px 24px rgba(0,0,0,.4)">
    <div style="position:absolute;right:-40px;bottom:-34px;width:130px;height:130px;border-radius:50%;background:#f3c623;
      display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 6px 14px rgba(0,0,0,.35);transform:rotate(-10deg)">
      <span class=hand style="font-size:50px;color:#1d1d1d;line-height:1">${D.fav.score}</span>
      <span style="font-family:Chakra;font-size:13px;letter-spacing:1px">FAVOURITE</span></div>
  </div>
  <div style="position:absolute;left:64px;bottom:70px;font-size:26px;color:#6b5a44">Community favourite:<br><span style="color:#2a2118;font-size:30px">${D.fav.title}</span><br>${D.fav.artist}, ${D.fav.n} reviews</div>
</div>`;

const slide3B = `<!doctype html><meta charset=utf-8><style>${FONTS}
body{${desk}font-family:Type;color:#2a2118}
.hand{font-family:Marker;color:#1d3fbf}
</style>
<div style="position:absolute;left:70px;top:70px;width:940px;height:330px;${paper}border-radius:6px;transform:rotate(1deg);
  box-shadow:0 24px 50px rgba(0,0,0,.55);padding:44px 56px">
  ${tape("top:-20px;left:60px;transform:rotate(-4deg)")}${tape("top:-20px;right:60px;transform:rotate(5deg)")}
  <div class=hand style="font-size:68px;line-height:1.05">Rate every album 0–10.<br>Even the leaks.</div>
  <div style="font-size:28px;margin-top:16px">Reviews · lists · Aux Wars · live rooms on release night</div>
</div>
<div style="position:absolute;left:0;right:0;top:440px;display:flex;justify-content:center">${phone(296, -3)}</div>
<div style="position:absolute;left:0;right:0;bottom:60px;display:flex;flex-direction:column;align-items:center;gap:12px">
  ${badge()}<div style="font-family:Chakra;font-size:26px;letter-spacing:3px;color:#e9dcc0">FREE · JOIN 100+ MEMBERS · PEAKMUSICREVIEWS.COM</div></div>`;

(async () => {
  const out = { "slide2-A-crt": slide2A, "slide3-A-crt": slide3A, "slide2-B-cassette": slide2B, "slide3-B-cassette": slide3B };
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--allow-file-access-from-files"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 1 });
  for (const [name, html] of Object.entries(out)) {
    const f = path.join(__dirname, name + ".html");
    fs.writeFileSync(f, html);
    await page.goto("file:///" + f.replace(/\\/g, "/"), { waitUntil: "networkidle0" });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(__dirname, name + ".png") });
    console.log("rendered", name);
  }
  await browser.close();
})();
