import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const base = process.env.ADMIN_TEST_URL || "http://localhost:3001";
assert.ok(
  ["127.0.0.1", "localhost"].includes(new URL(base).hostname),
  "Admin CRUD tests must target an isolated local server.",
);
const access = await readFile("tmp/admin-access.txt", "utf8");
const password = access.match(/^Mot de passe: (.+)$/m)?.[1];
assert.ok(password, "Run admin:setup first.");
await mkdir("tmp/qa", { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  timeout: 45000,
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 960 },
  reducedMotion: "reduce",
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
let createdProduct, createdCategory, originalProduct;
const suffix = Date.now().toString(36);
const categoryName = "Poufs test " + suffix;
const productName = "Pouf test " + suffix;
const editedName = "Pouf modifi\u00E9 " + suffix;
async function state() {
  const response = await context.request.get(base + "/api/admin/catalog");
  assert.equal(response.status(), 200);
  return response.json();
}
async function mutation(kind, action, id, value) {
  const current = await state();
  const response = await context.request.post(base + "/api/admin/catalog", {
    headers: { origin: base },
    data: { kind, action, id, version: current.version, value },
  });
  assert.ok(
    response.ok(),
    "Cleanup or restore request failed: " + response.status(),
  );
  return response.json();
}
async function accessibility(label) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  assert.deepEqual(
    result.violations.map((v) => ({ id: v.id, impact: v.impact })),
    [],
    label,
  );
}
try {
  assert.equal(
    (await context.request.get(base + "/api/admin/catalog")).status(),
    401,
  );
  assert.equal(
    (
      await context.request.post(base + "/api/admin/upload", {
        headers: { origin: base, "content-type": "image/webp" },
        data: Buffer.from("bad"),
      })
    ).status(),
    401,
  );
  await page.goto(base + "/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );
  await page
    .getByLabel("Identifiant", { exact: true })
    .fill(process.env.ADMIN_USERNAME || "admin");
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  const loginResponse = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/admin/login") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  assert.equal((await loginResponse).status(), 200, "Admin login failed");
  await expect(
    page.getByRole("heading", { name: "Le catalogue", exact: true }),
  ).toBeVisible();
  const initial = await state();
  assert.equal(initial.storage, "local");
  originalProduct = initial.products[0];
  const cookie = context
    .cookies()
    .then((list) => list.find((c) => c.name === "neuz_admin"));
  const session = await cookie;
  assert.ok(session?.httpOnly);
  assert.equal(session.sameSite, "Strict");
  const forbidden = await context.request.post(base + "/api/admin/catalog", {
    headers: { origin: "https://evil.example" },
    data: {
      kind: "product",
      action: "delete",
      id: originalProduct.id,
      version: initial.version,
    },
  });
  assert.equal(forbidden.status(), 403);
  await accessibility("Admin product list");
  await page.screenshot({ path: "tmp/qa/admin-products.png", fullPage: true });
  await page.getByRole("button", { name: /^Cat\u00E9gories/ }).click();
  await page
    .getByRole("button", { name: "Ajouter une cat\u00E9gorie", exact: true })
    .click();
  await page
    .getByLabel("Nom de la cat\u00E9gorie", { exact: true })
    .fill(categoryName);
  await page
    .getByLabel("Description", { exact: true })
    .fill(
      "Des poufs de test pour v\u00E9rifier la gestion du catalogue et les cr\u00E9ations sur mesure.",
    );
  await page
    .getByRole("combobox", { name: /Type dans les demandes de devis/ })
    .selectOption("pouf");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "Modifications enregistr\u00E9es",
  );
  createdCategory = (await state()).categories.find(
    (c) => c.translations.fr.name === categoryName,
  );
  assert.ok(createdCategory);
  await page.getByRole("button", { name: /^Produits/ }).click();
  await page
    .getByRole("button", { name: "Ajouter un produit", exact: true })
    .click();
  await page.getByLabel("Nom du produit", { exact: true }).fill(productName);
  await page
    .getByLabel("Description", { exact: true })
    .fill(
      "Un produit ajout\u00E9 depuis le panneau administrateur pour v\u00E9rifier son affichage public.",
    );
  await page
    .getByLabel("Description de l\u2019image", { exact: true })
    .fill("Tapis de r\u00E9f\u00E9rence utilis\u00E9 pour ce test de produit");
  await page
    .getByRole("combobox", { name: /Cat\u00E9gorie/ })
    .selectOption(createdCategory.id);
  await page
    .locator('input[type="file"]')
    .setInputFiles({
      name: "reference.webp",
      mimeType: "image/webp",
      buffer: await readFile("public/images/rug-composition-480.webp"),
    });
  await expect(page.locator(".admin-image-editor img")).toHaveAttribute(
    "src",
    /\/media\//,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await accessibility("Admin mobile product form");
  await page.screenshot({
    path: "tmp/qa/admin-product-form-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "Modifications enregistr\u00E9es",
  );
  createdProduct = (await state()).products.find(
    (p) => p.translations.fr.name === productName,
  );
  assert.ok(createdProduct);
  assert.equal(createdProduct.creation, "pouf");
  const publicPage = await context.newPage();
  await publicPage.goto(base + "/fr");
  await publicPage
    .getByRole("button", { name: new RegExp(categoryName) })
    .click();
  await expect(publicPage.locator(".art-card")).toHaveCount(1);
  await expect(publicPage.locator(".art-card")).toContainText(productName);
  await publicPage.locator(".art-card").click();
  await expect(publicPage.locator(".piece-dialog")).toContainText(productName);
  let publicResponse = await context.request.get(
    base + "/fr/creations/" + createdCategory.slug,
  );
  assert.equal(publicResponse.status(), 200);
  assert.ok((await publicResponse.text()).includes(productName));
  assert.ok(
    (
      await context.request.get(base + "/sitemap.xml").then((r) => r.text())
    ).includes(createdCategory.slug),
  );
  assert.equal(
    (
      await context.request.get(base + createdProduct.image + "-800.webp")
    ).status(),
    200,
  );
  await page.getByRole("button", { name: /^Cat\u00E9gories/ }).click();
  await expect(
    page.getByRole("button", {
      name: "Supprimer " + categoryName,
      exact: true,
    }),
  ).toBeDisabled();
  await page.getByRole("button", { name: /^Produits/ }).click();
  await page
    .getByRole("button", { name: "Modifier " + productName, exact: true })
    .click();
  await page.getByLabel("Nom du produit", { exact: true }).fill(editedName);
  await page.getByLabel("Visible sur le site", { exact: true }).uncheck();
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "Modifications enregistr\u00E9es",
  );
  assert.equal(
    (
      await context.request.get(base + "/fr/creations/" + createdCategory.slug)
    ).status(),
    404,
  );
  assert.ok(
    !(
      await context.request.get(base + "/sitemap.xml").then((r) => r.text())
    ).includes(createdCategory.slug),
  );
  await page
    .getByRole("button", { name: "Modifier " + editedName, exact: true })
    .click();
  await page.getByLabel("Visible sur le site", { exact: true }).check();
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "Modifications enregistr\u00E9es",
  );
  await page
    .getByRole("button", {
      name: "Modifier " + originalProduct.translations.fr.name,
      exact: true,
    })
    .click();
  await page
    .getByLabel("Nom du produit", { exact: true })
    .fill("Cr\u00E9ation existante modifi\u00E9e " + suffix);
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "Modifications enregistr\u00E9es",
  );
  assert.equal(
    (await state()).products.find((p) => p.id === originalProduct.id)
      .translations.fr.name,
    "Cr\u00E9ation existante modifi\u00E9e " + suffix,
  );
  await mutation("product", "save", originalProduct.id, originalProduct);
  originalProduct = undefined;
  await page.reload();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Supprimer " + editedName, exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Suppression enregistr\u00E9e",
  );
  createdProduct = undefined;
  await page.getByRole("button", { name: /^Cat\u00E9gories/ }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Supprimer " + categoryName, exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Suppression enregistr\u00E9e",
  );
  createdCategory = undefined;
  const restored = await state();
  assert.equal(restored.products.length, initial.products.length);
  assert.equal(restored.categories.length, initial.categories.length);
  await page
    .getByRole("button", { name: "Se d\u00E9connecter", exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  assert.equal(
    (await context.request.get(base + "/api/admin/catalog")).status(),
    401,
  );
  await accessibility("Admin mobile login");
  await page.screenshot({
    path: "tmp/qa/admin-login-mobile.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "Passed: admin login/logout, authorization, CSRF, category/product CRUD, image upload, existing product editing, live gallery/sitemap, mobile layout and accessibility.",
  );
} finally {
  if (originalProduct)
    await mutation(
      "product",
      "save",
      originalProduct.id,
      originalProduct,
    ).catch(() => {});
  if (createdProduct)
    await mutation("product", "delete", createdProduct.id).catch(() => {});
  if (createdCategory)
    await mutation("category", "delete", createdCategory.id).catch(() => {});
  await writeFile("tmp/qa/admin-errors.json", JSON.stringify(errors, null, 2));
  await context.close();
  await browser.close();
}
