import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
await page.getByRole("button", { name: /Level editor/i }).click();
await page.waitForTimeout(400);

await page.getByTitle("Script tutorial").click();
await page.waitForTimeout(100);
if (!(await page.getByRole("heading", { name: /Level scripts/i }).isVisible())) {
  throw new Error("tutorial missing");
}
await page.getByRole("button", { name: "Insert sample" }).click();
await page.waitForTimeout(200);
if (!(await page.getByText("Script", { exact: true }).first().isVisible())) {
  throw new Error("script panel should open");
}
const ta = page.locator("textarea").last();
const src = await ta.inputValue();
if (!src.includes("(on start")) throw new Error("sample not inserted: " + src.slice(0, 80));

await page.getByRole("button", { name: "Format" }).click();
await page.waitForTimeout(80);
const formatted = await ta.inputValue();
if (!formatted.includes("(on") || !formatted.includes("door-armory")) {
  throw new Error("format ate script: " + formatted.slice(0, 200));
}

// place a named door
await page.getByRole("button", { name: "Door" }).click();
await page.locator("input[placeholder='door-armory']").fill("door-armory");
const grid = page.locator(".relative.mx-auto.touch-none");
const box = await grid.boundingBox();
await page.mouse.click(box.x + box.width * 0.35, box.y + box.height * 0.35);

await page.screenshot({ path: "/workspace/screenshots/editor-script.png" });
console.log("errors", errors);
if (errors.length) throw new Error(errors.join("\n"));
console.log("OK", formatted.split("\n").length, "lines");
await browser.close();
