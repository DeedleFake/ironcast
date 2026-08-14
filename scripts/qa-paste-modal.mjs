import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
await page.getByRole("button", { name: /Level editor/i }).click();
await page.waitForTimeout(400);

await page.getByRole("button", { name: "Import" }).click();
await page.getByRole("menuitem", { name: "From clipboard" }).click();
await page.waitForTimeout(80);

const dialog = page.getByRole("dialog");
if (!(await dialog.isVisible())) throw new Error("modal missing");
if (!(await page.getByRole("heading", { name: /Paste a map/i }).isVisible())) {
  throw new Error("title missing");
}

const importBtn = dialog.getByRole("button", { name: "Import" });
if (await importBtn.isEnabled()) throw new Error("import should be disabled empty");

await dialog.locator("textarea").fill("not a map");
await importBtn.click();
if (!(await dialog.getByText(/isn’t a valid map|valid map/i).isVisible())) {
  throw new Error("expected parse error");
}

// grab a real map via export copy
await dialog.getByRole("button", { name: "Cancel" }).click();
if (await dialog.isVisible()) throw new Error("cancel should close");

await page.getByRole("button", { name: "Export" }).click();
await page.getByRole("menuitem", { name: "Copy to clipboard" }).click();
const json = await page.evaluate(async () => {
  // fallback: we may not have clipboard; just type a minimal invalid then use file parse via window
  try { return await navigator.clipboard.readText(); } catch { return ""; }
});

// Build a valid level by exporting through the page's serialize isn't exposed.
// Click export download is flaky. Instead type a known-good payload from the app by
// evaluating parse through filling after fetching from local editor state isn't easy.
// Use the first official mission: go menu, copy isn't available without clipboard.
// Write a valid-enough JSON matching LEVEL_VERSION.
const valid = JSON.stringify({
  version: 1,
  name: "Pasted Test",
  width: 8,
  height: 8,
  walls: Array.from({ length: 8 }, () => Array(8).fill(0)),
  spawn: { x: 1.5, y: 1.5, angle: 0 },
  entities: [],
  floorColor: "#2a2420",
  ceilingColor: "#12141a",
  fogColor: "#0a0a0c",
});

await page.getByRole("button", { name: "Import" }).click();
await page.getByRole("menuitem", { name: "From clipboard" }).click();
await dialog.locator("textarea").fill(valid);
await importBtn.click();
await page.waitForTimeout(200);
if (await dialog.isVisible()) throw new Error("modal should close after import");
const name = await page.locator('input[aria-label="Level name"]').inputValue();
console.log({ name, jsonHead: json.slice(0, 40) });
if (name.toLowerCase() !== "pasted test") throw new Error("did not apply pasted map: " + name);

console.log("errors", errors);
if (errors.length) throw new Error(errors.join("\n"));
console.log("OK");
await browser.close();
