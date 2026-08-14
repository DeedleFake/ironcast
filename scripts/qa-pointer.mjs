import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
await page.waitForTimeout(500);
await page.getByRole("button", { name: /Quick play/i }).click();
await page.waitForTimeout(800);
const fight = page.getByRole("button", { name: /Click to fight/i });
if (await fight.isVisible().catch(() => false)) {
  await fight.click();
  await page.waitForTimeout(300);
}

// Pause
await page.keyboard.press("Escape");
await page.waitForTimeout(250);
let ui = await page.evaluate(() => ({
  locked: !!document.pointerLockElement,
  resume: [...document.querySelectorAll("button")].some((b) =>
    /^Resume$/.test(b.textContent?.trim() || ""),
  ),
}));
console.log("paused:", ui);
if (ui.locked || !ui.resume) throw new Error("pause failed");

// Overlay button clickable
await page.getByRole("button", { name: /^Restart$/i }).click();
await page.waitForTimeout(400);
// Should be back to click-to-fight (needClick true after restart)
const needClick = await page.getByRole("button", { name: /Click to fight/i }).isVisible().catch(() => false);
console.log("after restart needClick:", needClick);

// Force win/dead via probe if we add setMode - simulate by pause then exit
if (needClick) {
  await page.getByRole("button", { name: /Click to fight/i }).click();
  await page.waitForTimeout(200);
}
await page.keyboard.press("Escape");
await page.waitForTimeout(150);
await page.getByRole("button", { name: /^Exit$/i }).click();
await page.waitForTimeout(400);
const menu = await page.getByRole("button", { name: /Quick play/i }).isVisible();
console.log("back to menu:", menu);
console.log("errors:", errors.filter((e) => !e.includes("pointer lock") && !e.includes("PointerLock") && !e.includes("NotAllowedError")));
await browser.close();
if (!menu) process.exit(1);
console.log("OK");
