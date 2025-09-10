// src/automation/navToUploadPage.js
import { chromium } from "playwright";
import path from "path";
import { dismissCookies } from "./helpers/dismissCookies.js";
import { waitForDashboard } from "./helpers/waitForDashboard.js";

export async function navToUploadPage({ username, password }, runDir) {
  const LOGIN_URL = "https://iampe.adm.gov.it/sam/UI/Login?realm=/adm&locale=en";
  const SSO_JUMP = "https://sso.adm.gov.it/pud2odv?Location=https://odv.adm.gov.it/ODV_OHP/";
  const UPLOAD_PAGE = "https://odv.adm.gov.it/ODV_GAD/pages/acquisizioneCertificazione.xhtml";

  const shots = {
    login: path.join(runDir, "00_login_page.png"),
    afterSubmit: path.join(runDir, "01_after_submit.png"),
    afterCookies: path.join(runDir, "02_after_cookies.png"),
    afterSSO: path.join(runDir, "03_after_sso.png"),
    onUpload: path.join(runDir, "04_upload_page.png")
  };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();

  // 1) Login
  await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.screenshot({ path: shots.login, fullPage: true });
  await page.fill("#userName1", username);
  await page.fill("#userPassword1", password);
  await page.click("button.adm-btn-primary", { timeout: 10000 });
  await page.waitForURL((u) => !String(u).includes("/Login"), { timeout: 20000 }).catch(() => {});
  await page.screenshot({ path: shots.afterSubmit, fullPage: true });

  // 2) Cookies (if any)
  const cookiesRes = await dismissCookies(page, shots.afterCookies);

  // 3) Optional wait on portal
  await waitForDashboard(page, 8000).catch(() => {});

  // 4) SSO jump
  await page.goto(SSO_JUMP, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.screenshot({ path: shots.afterSSO, fullPage: true });

  // 5) Upload page
  await page.goto(UPLOAD_PAGE, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.screenshot({ path: shots.onUpload, fullPage: true });

  return {
    browser,
    context,
    page,
    shots,
    cookieDismissed: cookiesRes.dismissed,
    cookieDismissReason: cookiesRes.reason,
    url: page.url(),
    title: await page.title()
  };
}
