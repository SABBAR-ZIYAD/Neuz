import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
});
const page = await context.newPage();
const results = [];
try {
  await page.goto("http://127.0.0.1:3000/");
  await expect(page).toHaveURL(/\/fr$/);
  for (const locale of ["fr", "en", "ar"]) {
    await page.goto(`http://127.0.0.1:3000/${locale}`);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.locator("link[rel=canonical]")).toHaveAttribute(
      "href",
      `http://localhost:3000/${locale}`,
    );
    await expect(page.locator("link[rel=alternate][hreflang]")).toHaveCount(4);
    await expect(page.locator("h1")).toHaveCount(1);
    results.push({ metadata: locale, valid: true });
  }
  await page.goto("http://127.0.0.1:3000/fr");
  await page.getByRole("link", { name: "Les créations", exact: true }).click();
  await page.getByRole("button", { name: /Miroirs/ }).click();
  await expect(page.locator(".art-card")).toHaveCount(3);
  await expect(page.getByRole("button", { name: /Miroirs/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.locator(".art-card").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("heading", { name: "Contours libres", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".art-card").first()).toBeFocused();
  await page.locator(".art-card").first().click();
  await page.getByRole("button", { name: "S’inspirer de cette pièce" }).click();
  await expect(
    page.getByText("Pièce d’inspiration : Contours libres"),
  ).toBeVisible();
  await page.getByLabel("Nom complet").fill("Test Local");
  await page.getByLabel("Adresse email").fill("client@example.com");
  await page.getByLabel("Téléphone / WhatsApp").fill("+212600000000");
  await page.getByLabel("Vous êtes").selectOption("architect");
  await page.getByRole("button", { name: "Continuer", exact: true }).click();
  await expect(page.getByLabel("Type de création")).toHaveValue("mirror");
  await expect(page.getByLabel("Hauteur", { exact: true })).toBeVisible();
  await page.getByLabel("Type de projet").selectOption("hospitality");
  await page.getByLabel("Type de création").selectOption("rug");
  await expect(page.getByLabel("Longueur", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Continuer", exact: true }).click();
  await page.locator("#quote-files").setInputFiles({
    name: "reference.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.7\nlocal example"),
  });
  await expect(page.getByText("reference.pdf", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Supprimer reference.pdf", exact: true })
    .click();
  await expect(page.getByText("reference.pdf", { exact: true })).toHaveCount(0);
  await page
    .getByLabel("Votre projet en quelques mots")
    .fill("Un projet test local, sans envoi réel.");
  await page
    .getByRole("button", { name: "Fermer le formulaire", exact: true })
    .click();
  await page.locator(".header-quote").click();
  await expect(page.getByLabel("Votre projet en quelques mots")).toHaveValue(
    "Un projet test local, sans envoi réel.",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator(".header-quote")).toBeFocused();
  results.push({
    galleryFilters: true,
    galleryFocus: true,
    inspirationPrefill: true,
    adaptiveDimensions: true,
    attachments: true,
    draftRetention: true,
  });
  await page.locator("#savoir-faire").scrollIntoViewIfNeeded();
  await page.getByRole("link", { name: "English", exact: true }).click();
  await expect(page).toHaveURL(/\/en#savoir-faire$/);
  await page.goto("http://127.0.0.1:3000/");
  await expect(page).toHaveURL(/\/en$/);
  results.push({ languageSection: true, languagePreference: true });
  for (const viewport of [
    { width: 375, height: 812 },
    { width: 768, height: 1024 },
    { width: 812, height: 375 },
    { width: 320, height: 740 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("http://127.0.0.1:3000/ar");
    const dimensions = await page.evaluate(() => ({
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width);
    await page.getByRole("button", { name: "فتح القائمة" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(axe.violations).toEqual([]);
    await page
      .getByRole("link", { name: "الإبداعات", exact: false })
      .last()
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const header = await page.locator(".header").evaluate((el) => ({
      position: getComputedStyle(el).position,
      background: getComputedStyle(el).backgroundColor,
    }));
    expect(header.position).toBe("fixed");
    expect(header.background).toBe("rgba(0, 0, 0, 0)");
    results.push({
      viewport,
      rtlOverflow: false,
      mobileMenu: true,
      transparentFixedHeader: true,
    });
  }
  console.log(JSON.stringify(results, null, 2));
  await writeFile("tmp/qa/interactions.json", JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
