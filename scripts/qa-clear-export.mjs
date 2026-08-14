import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
await page.getByRole("button", { name: /Level editor/i }).click();
await page.waitForTimeout(500);

const grid = page.locator(".relative.mx-auto.touch-none");
const box = await grid.boundingBox();
if (!box) throw new Error("no grid");
await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.4);
await page.waitForTimeout(100);

// first click only arms
await page.getByRole("button", { name: "Clear map" }).click();
await page.waitForTimeout(80);
const armed = await page.getByText("Erase everything?").isVisible();
const stillHasPaintUndo = !(await page.getByTitle("Undo (Ctrl+Z)").isDisabled());
console.log({ armed, stillHasPaintUndo });
if (!armed) throw new Error("clear should ask first");
if (!stillHasPaintUndo) throw new Error("first click should not wipe");

await page.getByRole("button", { name: "Clear", exact: true }).click();
await page.waitForTimeout(120);
const status = await page.locator(".text-accent").first().innerText();
console.log("status", status);
if (!/Cleared/i.test(status)) throw new Error("expected cleared status");

const [download] = await Promise.all([
  page.waitForEvent("download", { timeout: 4000 }),
  page.getByRole("button", { name: /Export/i }).click(),
]);
console.log("download", download.suggestedFilename());
if (!download.suggestedFilename().endsWith(".json")) {
  throw new Error("export should download json");
}

// copy map gone
if (await page.getByRole("button", { name: /Copy map/i }).count()) {
  throw new Error("copy map should be gone");
}

console.log("errors", errors);
if (errors.length) throw new Error(errors.join("\n"));
console.log("OK");
await browser.close();
