import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
await page.waitForTimeout(500);
await page.getByRole("button", { name: /Level editor/i }).click();
await page.waitForTimeout(600);

const undoBtn = page.getByTitle("Undo (Ctrl+Z)");
const redoBtn = page.getByTitle("Redo (Ctrl+Y)");
const undoOff = async () => undoBtn.isDisabled();
const redoOff = async () => redoBtn.isDisabled();

console.log("initial", { undo: await undoOff(), redo: await redoOff() });

const grid = page.locator(".relative.mx-auto.touch-none");
const box = await grid.boundingBox();
if (!box) throw new Error("no grid");
// click an interior cell (not border)
await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.4);
await page.waitForTimeout(150);

const afterPaint = { undo: await undoOff(), redo: await redoOff() };
console.log("after paint", afterPaint);

await undoBtn.click();
await page.waitForTimeout(120);
const afterUndo = { undo: await undoOff(), redo: await redoOff() };
console.log("after undo", afterUndo);

await redoBtn.click();
await page.waitForTimeout(120);
const afterRedo = { undo: await undoOff(), redo: await redoOff() };
console.log("after redo", afterRedo);

await page.keyboard.press("Control+z");
await page.waitForTimeout(120);
const afterCtrlZ = { undo: await undoOff(), redo: await redoOff() };
console.log("after ctrl+z", afterCtrlZ);

await page.screenshot({ path: "/workspace/screenshots/editor-undo.png" });
console.log("errors", errors);
await browser.close();

if (afterPaint.undo) throw new Error("undo should enable after paint");
if (!afterPaint.redo) throw new Error("redo should stay disabled after paint");
if (afterUndo.redo) throw new Error("redo should enable after undo");
if (afterRedo.undo) throw new Error("undo should enable after redo");
if (afterCtrlZ.redo) throw new Error("ctrl+z should undo");
console.log("OK");
