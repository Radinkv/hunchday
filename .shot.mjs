import puppeteer from "puppeteer-core";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const url = process.argv[2] || "http://localhost:5179";
const out = process.argv[3] || "/tmp/hunchday-shot.png";
const mode = process.argv[4] || "play"; // "play" clicks Play; "drawer" also opens a tab

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 });

if (mode !== "intro") {
  const clicked = await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Play");
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  });
  if (clicked) await new Promise((r) => setTimeout(r, 400));
}

const tabName = process.argv[5];
if (tabName) {
  await page.evaluate((name) => {
    const t = [...document.querySelectorAll('[role="tab"]')].find((b) => b.textContent.trim() === name);
    if (t) t.click();
  }, tabName);
  await new Promise((r) => setTimeout(r, 300));
}

const feeds = Number(process.argv[6] || 0);
for (let i = 0; i < feeds; i++) {
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Feed it");
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 350));
}

await page.screenshot({ path: out });
await browser.close();
console.log("shot saved:", out);
