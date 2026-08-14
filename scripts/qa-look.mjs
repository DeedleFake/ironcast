import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
await page.waitForTimeout(500);
await page.getByRole("button", { name: /Quick play/i }).click();
await page.waitForTimeout(700);
const fight = page.getByRole("button", { name: /Click to fight/i });
if (await fight.count()) await fight.click();
await page.waitForTimeout(400);

const result = await page.evaluate(async () => {
  const t = window.__controlsTest;
  if (!t) return { error: "no probe" };
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

  // Mouse right (+lookDX) must turn view RIGHT → angle increases in this basis
  const y0 = t.getYaw();
  t.look(80);
  await new Promise((r) => setTimeout(r, 80));
  const yRight = t.getYaw();
  const dRight = wrap(yRight - y0);

  // Mouse left
  const y1 = t.getYaw();
  t.look(-80);
  await new Promise((r) => setTimeout(r, 80));
  const yLeft = t.getYaw();
  const dLeft = wrap(yLeft - y1);

  // Q/Left should turn left = decrease angle
  const y2 = t.getYaw();
  t.setKeys(["KeyQ"]);
  await new Promise((r) => setTimeout(r, 300));
  t.setKeys([]);
  const yQ = t.getYaw();
  const dQ = wrap(yQ - y2);

  // E/Right should turn right = increase angle
  const y3 = t.getYaw();
  t.setKeys(["KeyE"]);
  await new Promise((r) => setTimeout(r, 300));
  t.setKeys([]);
  const yE = t.getYaw();
  const dE = wrap(yE - y3);

  // Strafe still correct
  const dir = t.getDir();
  const p0 = t.getPos();
  t.setKeys(["KeyD"]);
  await new Promise((r) => setTimeout(r, 250));
  const pD = t.getPos();
  t.setKeys(["KeyA"]);
  await new Promise((r) => setTimeout(r, 250));
  const pA = t.getPos();
  t.setKeys([]);
  const right = { x: -dir.y, y: dir.x };
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const dD = { x: pD.x - p0.x, y: pD.y - p0.y };
  const dA = { x: pA.x - pD.x, y: pA.y - pD.y };

  return {
    dRight,
    dLeft,
    dQ,
    dE,
    mouseRightOk: dRight > 0.02,
    mouseLeftOk: dLeft < -0.02,
    qLeftOk: dQ < -0.05,
    eRightOk: dE > 0.05,
    strafeD: dot(dD, right) > 0.02,
    strafeA: dot(dA, right) < -0.02,
  };
});

console.log(JSON.stringify(result, null, 2));
console.log("errors:", errors);
await browser.close();

const ok =
  result.mouseRightOk &&
  result.mouseLeftOk &&
  result.qLeftOk &&
  result.eRightOk &&
  result.strafeD &&
  result.strafeA &&
  !errors.length;
process.exit(ok ? 0 : 1);
