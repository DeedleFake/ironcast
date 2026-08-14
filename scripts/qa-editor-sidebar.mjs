import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
await page.getByRole("button", { name: /Level editor/i }).click();
await page.waitForTimeout(500);

for (const name of ["Tools", "Walls", "Things", "Look"]) {
  if (!(await page.getByText(name, { exact: true }).first().isVisible())) {
    throw new Error("missing section " + name);
  }
}
for (const name of ["Paint", "Erase", "Fill", "Box", "Box fill", "Line", "Pick"]) {
  if (!(await page.getByTitle(new RegExp(`^${name}`)).count())) {
    throw new Error("missing tool " + name);
  }
}
for (const name of ["Enemy", "Ammo", "Health", "Exit", "Spawn"]) {
  if (!(await page.getByRole("button", { name }).first().isVisible())) {
    throw new Error("missing thing " + name);
  }
}

// top bar should not have the old mixed tool row next to the name
const header = page.locator("header, .border-b").first();
// tools live in sidebar titles
await page.getByTitle("Box (O)").click();
await page.getByRole("button", { name: "Tech Panel" }).click();

const grid = page.locator(".relative.mx-auto.touch-none");
const box = await grid.boundingBox();
if (!box) throw new Error("no grid");
await page.mouse.move(box.x + 40, box.y + 40);
await page.mouse.down();
await page.mouse.move(box.x + 140, box.y + 120);
await page.mouse.up();
await page.waitForTimeout(150);

const undoOff = await page.getByTitle("Undo (Ctrl+Z)").isDisabled();
console.log({ undoOff });
if (undoOff) throw new Error("box draw should be undoable");

await page.getByRole("button", { name: "Enemy" }).click();
await page.getByTitle("Fill (F)").click();
await page.mouse.click(box.x + box.width * 0.8, box.y + box.height * 0.8);
await page.waitForTimeout(150);
const footer = await page.locator(".border-t").last().innerText();
console.log("footer", footer.replace(/\s+/g, " "));
if (!/Fill · Enemy/i.test(footer)) throw new Error("footer should show Fill · Enemy");

await page.screenshot({ path: "/workspace/screenshots/editor-sidebar.png" });
console.log("errors", errors);
if (errors.length) throw new Error(errors.join("\n"));
console.log("OK");
await browser.close();
