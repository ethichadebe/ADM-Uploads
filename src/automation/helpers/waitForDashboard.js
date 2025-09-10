// src/automation/helpers/waitForDashboard.js
// After login redirect, give the portal a moment to render.
export async function waitForDashboard(page, timeoutMs = 8000) {
  await Promise.race([
    page.waitForSelector("#menu-left", { timeout: timeoutMs }).catch(() => {}),
    page.waitForTimeout(timeoutMs)
  ]);
}
