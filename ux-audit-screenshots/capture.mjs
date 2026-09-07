import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const out = join(dirname(fileURLToPath(import.meta.url)), "assets");
mkdirSync(out, { recursive: true });

const browser = await puppeteer.launch({
  executablePath:
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: ["--hide-scrollbars"],
});

async function ready(page) {
  await page.waitForSelector("main", { timeout: 15000 });
  await new Promise((resolve) => setTimeout(resolve, 600));
}

async function shot(page, name) {
  await page.screenshot({ path: join(out, name), fullPage: true });
  console.log("wrote", name);
}

const desktop = await browser.newPage();
await desktop.setViewport({ width: 1440, height: 900 });

await desktop.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
await desktop.evaluate(() =>
  sessionStorage.setItem("mortang.slotPickerOpen", "false"),
);
await desktop.reload({ waitUntil: "domcontentloaded" });
await ready(desktop);
await shot(desktop, "01-desktop-plans.png");

await desktop.goto(
  "http://localhost:3000/?plan=27253474-0d84-45e8-82df-b6908683bce8",
  { waitUntil: "domcontentloaded" },
);
await desktop.evaluate(() =>
  sessionStorage.setItem("mortang.slotPickerOpen", "false"),
);
await desktop.reload({ waitUntil: "domcontentloaded" });
await ready(desktop);
await shot(desktop, "02-desktop-plans-filled.png");

const mealOpen = await desktop.$(".meal-card-open");
if (mealOpen) {
  await mealOpen.click();
  await new Promise((resolve) => setTimeout(resolve, 500));
  await shot(desktop, "03-desktop-recipe-flyout.png");
  await desktop.keyboard.press("Escape");
  await new Promise((resolve) => setTimeout(resolve, 300));
}

const addSide = await desktop.$("button.meal-extra-open");
if (addSide) {
  await addSide.click();
  await new Promise((resolve) => setTimeout(resolve, 700));
  await shot(desktop, "04-desktop-add-side.png");
  await desktop.keyboard.press("Escape");
  await new Promise((resolve) => setTimeout(resolve, 300));
}

await desktop.goto("http://localhost:3000/meals", {
  waitUntil: "domcontentloaded",
});
await ready(desktop);
await shot(desktop, "05-desktop-meals.png");

await desktop.goto("http://localhost:3000/shopping-list", {
  waitUntil: "domcontentloaded",
});
await ready(desktop);
await shot(desktop, "06-desktop-shopping.png");

await desktop.goto(
  "http://localhost:3000/shopping-list?plan=27253474-0d84-45e8-82df-b6908683bce8",
  { waitUntil: "domcontentloaded" },
);
await ready(desktop);
await shot(desktop, "07-desktop-shopping-filled.png");

await desktop.goto("http://localhost:3000/household", {
  waitUntil: "domcontentloaded",
});
await ready(desktop);
await shot(desktop, "08-desktop-household.png");

await desktop.goto("http://localhost:3000/kitchen", {
  waitUntil: "domcontentloaded",
});
await ready(desktop);
await shot(desktop, "09-desktop-kitchen.png");

const mobile = await browser.newPage();
await mobile.setViewport({
  width: 390,
  height: 844,
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
});

await mobile.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
await mobile.evaluate(() =>
  sessionStorage.setItem("mortang.slotPickerOpen", "false"),
);
await mobile.reload({ waitUntil: "domcontentloaded" });
await ready(mobile);
await shot(mobile, "10-mobile-plans.png");

await mobile.goto("http://localhost:3000/meals", {
  waitUntil: "domcontentloaded",
});
await ready(mobile);
await shot(mobile, "11-mobile-meals.png");

await mobile.goto(
  "http://localhost:3000/shopping-list?plan=27253474-0d84-45e8-82df-b6908683bce8",
  { waitUntil: "domcontentloaded" },
);
await ready(mobile);
await shot(mobile, "12-mobile-shopping.png");

await browser.close();
