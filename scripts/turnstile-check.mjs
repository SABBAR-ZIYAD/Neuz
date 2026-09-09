import { chromium, expect } from "@playwright/test";
// Requires an isolated build with NEXT_PUBLIC_TURNSTILE_SITE_KEY set.
// All challenge scripts and form POSTs are mocked; no email is sent.
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
const base = process.env.BOT_TEST_URL || "http://localhost:3001";
try {
  let scriptRequests = 0;
  await page.route("https://challenges.cloudflare.com/**", async (route) => {
    if (++scriptRequests === 1) return route.abort();
    await route.fulfill({contentType: "application/javascript", body: `
      window.__botResets = 0; window.turnstile = {
        render(el, options) { window.__botOptions = options; el.textContent = 'Challenge test'; return 'widget'; },
        remove() {}, reset() { window.__botResets++; }
      };`
    });
  });
  let loginToken;
  await page.route("**/api/admin/login", async (route) => {
    loginToken = route.request().postDataJSON().turnstile;
    await route.fulfill({ status: 401, json: { error: "Identifiants incorrects." } });
  });
  await page.goto(base + "/admin/login");
  await page.getByRole("button", { name: "Réessayer", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__botOptions?.action)).toBe("admin_login");
  await page.getByLabel("Identifiant", { exact: true }).fill("test-admin");
  await page.getByLabel("Mot de passe", { exact: true }).fill("test-password");
  const login = page.getByRole("button", { name: "Se connecter", exact: true });
  await expect(login).toBeDisabled();
  await page.evaluate(() => window.__botOptions.callback("valid-login-token"));
  await expect(login).toBeEnabled();
  await page.evaluate(() => window.__botOptions["expired-callback"]());
  await expect(login).toBeDisabled();
  await page.evaluate(() => window.__botOptions["error-callback"]());
  await page.getByRole("button", { name: "Réessayer", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__botResets)).toBeGreaterThan(0);
  await page.evaluate(() => window.__botOptions.callback("valid-login-token"));
  await login.click();
  await expect(page.locator(".admin-message[role=alert]")).toContainText("Identifiants incorrects.");
  expect(loginToken).toBe("valid-login-token");
  await expect(login).toBeDisabled();
  let quoteBody;
  await page.route("**/api/quote", async (route) => {
    quoteBody = route.request().postData();
    await route.fulfill({ status: 429, json: { code: "QUOTA_LIMIT" } });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base + "/fr");
  await page.locator(".header-quote").click();
  await page.getByLabel("Nom complet").fill("Test Local");
  await page.getByLabel("Adresse email").fill("client@example.com");
  await page.getByLabel("Téléphone / WhatsApp").fill("+212600000000");
  await page.getByLabel("Vous êtes").selectOption("architect");
  await page.getByRole("button", { name: "Continuer", exact: true }).click();
  await page.getByLabel("Type de projet").selectOption("hospitality");
  await page.getByLabel("Type de création").selectOption("rug");
  await page.getByRole("button", { name: "Continuer", exact: true }).click();
  const brief = page.getByLabel("Votre projet en quelques mots");
  await brief.fill("Un projet de test local, sans envoi réel.");
  await page.getByRole("checkbox").check();
  await expect.poll(() => page.evaluate(() => window.__botOptions?.action)).toBe("quote");
  const send = page.getByRole("button", { name: /Envoyer ma demande/ });
  await expect(send).toBeDisabled();
  await page.evaluate(() => window.__botOptions.callback("valid-quote-token"));
  await expect(send).toBeEnabled();
  await send.click();
  await expect(page.locator(".form-error")).toBeVisible();
  expect(quoteBody.includes("valid-quote-token")).toBe(true);
  await expect(send).toBeDisabled();
  await expect(brief).toHaveValue("Un projet de test local, sans envoi réel.");
  console.log("Passed: Turnstile script/widget retry, expiry, form actions, login/quote tokens, failed-submit reset and draft retention. No real email or challenges.");
} finally { await browser.close(); }
