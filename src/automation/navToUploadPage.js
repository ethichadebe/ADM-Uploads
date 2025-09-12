// src/automation/navToUploadPage.js
import { chromium } from "playwright";
import path from "path";
import { dismissCookies } from "./helpers/dismissCookies.js";
import { waitForDashboard } from "./helpers/waitForDashboard.js";
import { createRunLogger } from "../utils/logger.js";
import { waitForSettled } from "./helpers/waitForSettled.js";

export async function navToUploadPage({ username, password }, runDir, loggerParam) {
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

  const logger = loggerParam || createRunLogger(runDir);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const tracePath = path.join(runDir, "trace.zip");
  const page = await context.newPage();
  logger.attachPage(page);

  async function gotoWithRetry(url, label, attempts = 3, timeout = 60000) {
    let lastErr = null;
    for (let i = 1; i <= attempts; i++) {
      try {
        logger.info(`goto:${label}:try`, { url, attempt: i });
        await page.goto(url, { waitUntil: "domcontentloaded", timeout });
        await page.waitForLoadState("networkidle").catch(() => {});
        return true;
      } catch (e) {
        lastErr = e;
        logger.warn(`goto:${label}:failed`, { attempt: i, reason: e?.message || String(e) });
        await page.waitForTimeout(1000);
      }
    }
    throw lastErr || new Error(`goto-failed:${label}`);
  }

  // 1) Login
  logger.info("nav:login:goto", { url: LOGIN_URL });
  await gotoWithRetry(LOGIN_URL, "login", 3, 60000);
  await waitForSettled(page, 60000);
  await page.screenshot({ path: shots.login, fullPage: true });
  await logger.snapshotDom(page, "00_login_page");
  await page.fill("#userName1", username);
  await page.fill("#userPassword1", password);
  await page.click("button.adm-btn-primary", { timeout: 10000 });
  await page.waitForURL((u) => !String(u).includes("/Login"), { timeout: 20000 }).catch(() => {});
  await page.screenshot({ path: shots.afterSubmit, fullPage: true });
  await logger.snapshotDom(page, "01_after_submit");

  // 2) Cookies (if any)
  const cookiesRes = await dismissCookies(page, shots.afterCookies);
  logger.info("cookies:dismiss", cookiesRes);
  await logger.snapshotDom(page, "02_after_cookies");

  // 3) Optional wait on portal
  await waitForDashboard(page, 8000).catch(() => {});

  // 4) SSO jump
  logger.info("nav:sso:goto", { url: SSO_JUMP });
  await gotoWithRetry(SSO_JUMP, "sso", 3, 60000);
  await waitForSettled(page, 60000);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.screenshot({ path: shots.afterSSO, fullPage: true });
  await logger.snapshotDom(page, "03_after_sso");

  // 5) Upload page
  logger.info("nav:upload:goto", { url: UPLOAD_PAGE });
  await gotoWithRetry(UPLOAD_PAGE, "upload", 2, 60000);
  await waitForSettled(page, 60000);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.screenshot({ path: shots.onUpload, fullPage: true });
  await logger.snapshotDom(page, "04_upload_page");

  return {
    browser,
    context,
    page,
    shots,
    cookieDismissed: cookiesRes.dismissed,
    cookieDismissReason: cookiesRes.reason,
    url: page.url(),
    title: await page.title(),
    tracePath,
    logs: {
      text: logger.paths.textLogPath,
      events: logger.paths.ndjsonPath
    },
    logger
  };
}
