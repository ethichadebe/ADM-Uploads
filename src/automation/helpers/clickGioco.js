// src/automation/helpers/clickGioco.js
import { waitForProjectList } from "./waitForProjectList.js";

// Clicks Gioco radio and waits until the project list is fully populated.
export async function clickGioco(page, screenshotPath) {
  const GIOCO = "#formAcqController\\:tipoProgetto\\:1";
  await page.waitForSelector(GIOCO, { timeout: 15000 });

  const already = await page.$eval(GIOCO, (el) => !!el.checked).catch(() => false);
  if (!already) {
    await page.click(GIOCO);
    // allow JSF to start its ajax
    await page.waitForTimeout(150);
  }

  // Wait until the list is truly ready
  await waitForProjectList(page, 20000);
  if (screenshotPath) await page.screenshot({ path: screenshotPath, fullPage: true });

  return { ok: true };
}
