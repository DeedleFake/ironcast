import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await page.getByRole("button", { name: /Quick play/i }).click();
await page.waitForTimeout(900);

const fight = page.getByRole("button", { name: /Click to fight/i });
if (await fight.isVisible().catch(() => false)) {
  await fight.click({ force: true });
  await page.waitForTimeout(700);
}

// Wait for overlay to hide if lock fallback kicked in
for (let i = 0; i < 10; i++) {
  const vis = await fight.isVisible().catch(() => false);
  if (!vis) break;
  await page.waitForTimeout(150);
}

await page.screenshot({ path: "/workspace/screenshots/gun-align.png" });

const stillOverlay = await page.getByRole("button", { name: /Click to fight/i }).isVisible().catch(() => false);
console.log("overlay still:", stillOverlay);
console.log("errors:", errors.filter((e) => !/NotAllowedError|pointer lock/i.test(e)));
await browser.close();
