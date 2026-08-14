import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  permissions: ["clipboard-read", "clipboard-write"],
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
await page.getByRole("button", { name: /Level editor/i }).click();
await page.waitForTimeout(400);

await page.getByRole("button", { name: "Export" }).click();
await page.waitForTimeout(80);
const downloadItem = page.getByRole("menuitem", { name: "Download file" });
const copyItem = page.getByRole("menuitem", { name: "Copy to clipboard" });
if (!(await downloadItem.isVisible()) || !(await copyItem.isVisible())) {
  throw new Error("export menu missing items");
}
await copyItem.click();
await page.waitForTimeout(150);
const copied = await page.getByText("Copied map to clipboard").isVisible();
console.log({ copied });
if (!copied) throw new Error("copy status missing");

const clip = await page.evaluate(() => navigator.clipboard.readText());
if (!clip.includes("My Level") && !clip.includes("name")) {
  throw new Error("clipboard did not get a map: " + clip.slice(0, 80));
}

await page.getByRole("button", { name: "Import" }).click();
await page.waitForTimeout(80);
if (!(await page.getByRole("menuitem", { name: "From file" }).isVisible())) {
  throw new Error("import from file missing");
}
if (!(await page.getByRole("menuitem", { name: "From clipboard" }).isVisible())) {
  throw new Error("import from clipboard missing");
}
await page.getByRole("menuitem", { name: "From clipboard" }).click();
await page.waitForTimeout(150);
const opened = await page.getByText(/Opened/).isVisible();
console.log({ opened });

const clear = page.getByRole("button", { name: "Clear map" });
if (!(await clear.isVisible())) throw new Error("clear should be visible");
await clear.click();
if (!(await page.getByText("Erase everything?").isVisible())) {
  throw new Error("clear confirm missing");
}

console.log("errors", errors);
if (errors.length) throw new Error(errors.join("\n"));
console.log("OK");
await browser.close();
