import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await page.getByRole("button", { name: /Quick play/i }).click();
await page.waitForTimeout(800);
const fight = page.getByRole("button", { name: /Click to fight/i });
if (await fight.isVisible().catch(() => false)) {
  await fight.click({ force: true });
  await page.waitForTimeout(600);
}

const snap = () =>
  page.evaluate(() => {
    const t = window.__controlsTest;
    return t
      ? { pos: t.getPos(), mode: t.getMode(), ents: t.getEntities() }
      : null;
  });

const before = await snap();
console.log("before", before?.mode, before?.pos);

// Let the world tick while playing
await page.evaluate(() => window.__controlsTest?.setKeys(["KeyW"]));
await page.waitForTimeout(400);
const moving = await snap();
await page.evaluate(() => window.__controlsTest?.setKeys([]));
console.log("after walk", moving?.pos);

// Pause
await page.keyboard.press("Escape");
await page.waitForTimeout(200);
const pausedHud = await page.getByRole("heading", { name: /Paused/i }).isVisible();
const afterEsc = await snap();
console.log("paused overlay", pausedHud, "mode", afterEsc?.mode, afterEsc?.pos);

// Try to walk while paused
const pausedPos = afterEsc?.pos;
const pausedEnts = afterEsc?.ents;
await page.keyboard.down("KeyW");
await page.evaluate(() => window.__controlsTest?.setKeys(["KeyW"]));
await page.waitForTimeout(500);
const still = await snap();
await page.keyboard.up("KeyW");
await page.evaluate(() => window.__controlsTest?.setKeys([]));

const posChanged =
  Math.hypot((still.pos.x - pausedPos.x), (still.pos.y - pausedPos.y)) > 0.01;
const enemyMoved = still.ents.some((e, i) => {
  const p = pausedEnts[i];
  if (!p || e.type !== "enemy") return false;
  return Math.hypot(e.x - p.x, e.y - p.y) > 0.01;
});
console.log("moved while paused?", posChanged, "enemies moved?", enemyMoved, still.mode);

// Resume still works
await page.getByRole("button", { name: /^Resume$/i }).click();
await page.waitForTimeout(400);
const afterResume = await snap();
console.log("after resume", afterResume?.mode, afterResume?.pos);

await page.screenshot({ path: "/workspace/screenshots/paused.png" });

const fatal = errors.filter((e) => !/NotAllowedError|pointer lock/i.test(e));
console.log("errors", fatal);
await browser.close();

if (!pausedHud || afterEsc?.mode !== "paused") process.exit(2);
if (posChanged || enemyMoved) process.exit(3);
if (afterResume?.mode !== "playing") process.exit(4);
console.log("OK");
