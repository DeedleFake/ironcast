import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push("console:" + msg.text());
});

await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
await page.waitForTimeout(600);

// Editor path
await page.getByRole("button", { name: /Level editor/i }).click();
await page.waitForTimeout(800);
await page.screenshot({ path: "/workspace/screenshots/editor.png" });
const editorText = await page.locator("body").innerText();
console.log("editor has Test:", editorText.includes("Test"));
console.log("editor has texture palette:", /Tech Panel|Blood Brick|Hazard/.test(editorText));

// Export button present
console.log("export btn:", await page.getByRole("button", { name: /Export/i }).count());

// Back to menu via Menu
await page.locator('button:has-text("Menu")').click();
await page.waitForTimeout(500);

// Play
await page.getByRole("button", { name: /Quick play/i }).click();
await page.waitForTimeout(800);
await page.getByRole("button", { name: /Click to fight/i }).click();
await page.waitForTimeout(600);
await page.screenshot({ path: "/workspace/screenshots/playing.png" });

// body should show ARMOR / AMMO
const playText = await page.locator("body").innerText();
console.log("hud armor:", playText.includes("ARMOR"));
console.log("hud ammo:", playText.includes("AMMO"));

// controls
const ok = await page.evaluate(async () => {
  const t = window.__controlsTest;
  if (!t) return false;
  const dir = t.getDir();
  const p0 = t.getPos();
  t.setKeys(["KeyW"]);
  await new Promise((r) => setTimeout(r, 300));
  const pW = t.getPos();
  t.setKeys(["KeyD"]);
  await new Promise((r) => setTimeout(r, 300));
  const pD = t.getPos();
  t.setKeys(["KeyA"]);
  await new Promise((r) => setTimeout(r, 300));
  const pA = t.getPos();
  t.setKeys([]);
  const right = { x: -dir.y, y: dir.x };
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const dW = { x: pW.x - p0.x, y: pW.y - p0.y };
  const dD = { x: pD.x - pW.x, y: pD.y - pW.y };
  const dA = { x: pA.x - pD.x, y: pA.y - pD.y };
  return {
    w: dot(dW, dir) > 0.05,
    d: dot(dD, right) > 0.02,
    a: dot(dA, right) < -0.02,
  };
});
console.log("controls:", ok);

// mobile
await page.setViewportSize({ width: 390, height: 844 });
await page.locator('button:has-text("Menu"), button[aria-label], button').filter({ has: page.locator('svg') }).first();
// click first top-bar button (back arrow)
await page.evaluate(() => {
  const btns = [...document.querySelectorAll("button")];
  const menu = btns.find((b) => /Menu/i.test(b.textContent || ""));
  if (menu) menu.click();
});
await page.waitForTimeout(500);
await page.screenshot({ path: "/workspace/screenshots/menu-mobile.png" });
const overflow = await page.evaluate(() => ({
  sw: document.documentElement.scrollWidth,
  cw: document.documentElement.clientWidth,
}));
console.log("overflow:", overflow);
console.log("errors:", errors);
await browser.close();
if (errors.length) process.exit(1);
if (!ok || !ok.w || !ok.d || !ok.a) process.exit(2);
console.log("ALL OK");
