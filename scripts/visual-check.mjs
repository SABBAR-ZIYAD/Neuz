import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await mkdir("tmp/qa", { recursive: true });
const results = [];
try {
  for (const locale of ["fr", "en", "ar"]) {
    await page.goto(`http://127.0.0.1:3000/${locale}`, {
      waitUntil: "networkidle",
    });
    for (const section of await page.locator("main > section").all()) {
      await section.scrollIntoViewIfNeeded();
      await section
        .locator("img")
        .evaluateAll((images) =>
          Promise.all(images.map((image) => image.decode().catch(() => {}))),
        );
    }
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({
      path: `tmp/qa/${locale}-desktop.png`,
      fullPage: true,
    });
    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    results.push({
      locale,
      viewport: "desktop",
      violations: axe.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        description: v.description,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
      layout: await page.evaluate(() => ({
        width: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        lang: document.documentElement.lang,
        dir: document.documentElement.dir,
        images: [...document.images]
          .filter((i) => i.complete && !i.naturalWidth)
          .map((i) => i.src),
      })),
    });
    await page.setViewportSize({ width: 375, height: 812 });
    await page.screenshot({
      path: `tmp/qa/${locale}-mobile.png`,
      fullPage: true,
    });
    const mobileAxe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    results.push({
      locale,
      viewport: "mobile",
      violations: mobileAxe.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
      layout: await page.evaluate(() => ({
        width: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
      })),
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  await page.goto("http://127.0.0.1:3000/fr");
  await page
    .getByRole("button", { name: "Demander un devis", exact: true })
    .first()
    .click();
  await page.screenshot({ path: "tmp/qa/form-desktop.png" });
  await page.getByLabel("Nom complet").fill("Client Test");
  await page.getByLabel("Adresse email").fill("test@example.com");
  await page.getByLabel("Téléphone / WhatsApp").fill("+212600000000");
  await page.getByLabel("Vous êtes").selectOption("private");
  await page.getByRole("button", { name: "Continuer", exact: true }).click();
  await page.getByLabel("Type de projet").selectOption("residential");
  await page.getByLabel("Type de création").selectOption("rug");
  await page.getByRole("button", { name: "Continuer", exact: true }).click();
  await page
    .getByLabel("Votre projet en quelques mots")
    .fill(
      "Un tapis sur mesure pour notre salon. Ceci est un test local, sans email réel.",
    );
  await page.getByRole("checkbox").check();
  await page.setViewportSize({ width: 375, height: 812 });
  await page.screenshot({ path: "tmp/qa/form-mobile.png", fullPage: true });
  const formAxe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  results.push({
    formViolations: formAxe.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    })),
  });
  // No request leaves this browser: the failure and success UIs are exercised with local intercepts.
  await page.route("**/api/quote", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ code: "UNAVAILABLE" }),
    }),
  );
  await page
    .getByRole("button", { name: "Envoyer ma demande", exact: true })
    .click();
  await page.getByRole("alert").waitFor();
  results.push({
    unavailableMessage: await page.getByRole("alert").innerText(),
    preservedBrief: await page
      .getByLabel("Votre projet en quelques mots")
      .inputValue(),
  });
  await page.unroute("**/api/quote");
  await page.route("**/api/quote", (route) =>
    route.fulfill({
      status: 429,
      contentType: "application/json",
      body: JSON.stringify({ code: "QUOTA_LIMIT", retryAfter: 86400 }),
    }),
  );
  await page
    .getByRole("button", { name: "Envoyer ma demande", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("limite d’envoi");
  await expect(
    page.getByRole("alert").getByRole("link", { name: "WhatsApp" }),
  ).toBeVisible();
  results.push({ quotaLimitFallback: true });
  await page.unroute("**/api/quote");
  await page.route("**/api/quote", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ reference: "NZ-LOCAL-TEST" }),
    }),
  );
  await page
    .getByRole("button", { name: "Envoyer ma demande", exact: true })
    .click();
  await page.getByText("Votre idée est entre de bonnes mains.").waitFor();
  results.push({ successUI: true, pageErrors: errors });
  await writeFile("tmp/qa/results.json", JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
