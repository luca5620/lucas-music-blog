// Real iOS-app view: the site with the Capacitor bridge present, so
// NativeMode/.native-app + the app chrome (top bar, tab bar) render.
const puppeteer = require("puppeteer-core");
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const pages = (process.argv[2] || "release=releases/the-dark-side-of-the-moon-pink-floyd").split(",").map((p) => p.split("="));
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new" });
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 PMRBuild/99");
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await page.evaluateOnNewDocument(() => {
    try { localStorage.setItem("pmr-low-detail", "0"); } catch (e) {}
    window.Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios", Plugins: {} };
  });
  for (const [name, url] of pages) {
    await page.goto("https://peakmusicreviews.com/" + url, { waitUntil: "networkidle2", timeout: 60000 });
    await new Promise((r) => setTimeout(r, 6500));
    await page.screenshot({ path: `app-${name}.png` });
    console.log("saved", name, await page.evaluate(() => document.documentElement.className));
  }
  await browser.close();
})();
