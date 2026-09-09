import { AdminAccounts } from "../src/lib/admin-account";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import {
  LocalCatalogStorage,
  CatalogError,
  storageMode,
} from "../src/lib/catalog-storage";
import { CatalogRepository } from "../src/lib/catalog-repository";
import { publicCatalog, localized } from "../src/lib/catalog-model";
import {
  hashPassword,
  verifyPassword,
  createSession,
  validSession,
  sessionSeconds,
  adminCookie,
} from "../src/lib/admin-auth";
import { checkOrigin, requireAdmin, readJson } from "../src/lib/admin-http";
import { uploadCatalogImage } from "../src/lib/catalog-images";
let directory: string;
let repository: CatalogRepository;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "neuz-admin-test-"));
  repository = new CatalogRepository(new LocalCatalogStorage(directory));
});
afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});
describe("catalog persistence and CRUD", () => {
  test("imports existing content once and persists edits across storage instances", async () => {
    const first = await repository.read();
    expect(first.document.products).toHaveLength(6);
    expect(first.document.categories).toHaveLength(3);
    const product = first.document.products[0];
    const changed = {
      ...product,
      translations: {
        ...product.translations,
        fr: { ...product.translations.fr, name: "Nouveau nom du produit" },
      },
    };
    await repository.update({
      kind: "product",
      action: "save",
      id: product.id,
      version: first.version,
      value: changed,
    });
    const reloaded = await new CatalogRepository(
      new LocalCatalogStorage(directory),
    ).read();
    expect(reloaded.document.products[0].translations.fr.name).toBe(
      "Nouveau nom du produit",
    );
    let current = reloaded;
    for (const p of [...current.document.products])
      current = await repository.update({
        kind: "product",
        action: "delete",
        id: p.id,
        version: current.version,
      });
    expect(
      (await new CatalogRepository(new LocalCatalogStorage(directory)).read())
        .document.products,
    ).toHaveLength(0);
  });
  test("creates categories and products, connects quote types and hides unpublished content", async () => {
    let current = await repository.read();
    const reference = current.document.categories[0];
    current = await repository.update({
      kind: "category",
      action: "save",
      version: current.version,
      value: {
        ...reference,
        slug: "poufs",
        creation: "pouf",
        translations: {
          ...reference.translations,
          fr: { ...reference.translations.fr, name: "Poufs" },
        },
      },
    });
    const category = current.document.categories.at(-1)!;
    expect(
      publicCatalog(current.document).categories.some(
        (c) => c.id === category.id,
      ),
    ).toBe(false);
    current = await repository.update({
      kind: "product",
      action: "save",
      version: current.version,
      value: { ...current.document.products[0], category: category.id },
    });
    const product = current.document.products.at(-1)!;
    expect(product.creation).toBe("pouf");
    expect(
      publicCatalog(current.document).categories.some(
        (c) => c.id === category.id,
      ),
    ).toBe(true);
    current = await repository.update({
      kind: "category",
      action: "save",
      id: category.id,
      version: current.version,
      value: { ...category, published: false, creation: "sculpture" },
    });
    expect(
      publicCatalog(current.document).products.some((p) => p.id === product.id),
    ).toBe(false);
    expect(current.document.products.at(-1)!.creation).toBe("sculpture");
    current = await repository.update({
      kind: "product",
      action: "delete",
      id: product.id,
      version: current.version,
    });
    current = await repository.update({
      kind: "category",
      action: "delete",
      id: category.id,
      version: current.version,
    });
    expect(current.document.categories).toHaveLength(3);
  });
  test("blocks category deletion with products, URL changes and duplicate slugs", async () => {
    const current = await repository.read();
    const category = current.document.categories[0];
    await expect(
      repository.update({
        kind: "category",
        action: "delete",
        id: category.id,
        version: current.version,
      }),
    ).rejects.toBeInstanceOf(CatalogError);
    await expect(
      repository.update({
        kind: "category",
        action: "save",
        id: category.id,
        version: current.version,
        value: { ...category, slug: "changed" },
      }),
    ).rejects.toBeInstanceOf(CatalogError);
    await expect(
      repository.update({
        kind: "category",
        action: "save",
        version: current.version,
        value: category,
      }),
    ).rejects.toBeInstanceOf(CatalogError);
    expect((await repository.read()).version).toBe(current.version);
  });
  test("concurrent edits cannot overwrite each other", async () => {
    const current = await repository.read();
    const other = new CatalogRepository(new LocalCatalogStorage(directory));
    const item = current.document.products[0];
    const results = await Promise.allSettled([
      repository.update({
        kind: "product",
        action: "save",
        id: item.id,
        version: current.version,
        value: { ...item, order: 10 },
      }),
      other.update({
        kind: "product",
        action: "save",
        id: item.id,
        version: current.version,
        value: { ...item, order: 20 },
      }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
  });
  test("rejects invalid product categories and arbitrary image URLs", async () => {
    const current = await repository.read();
    const item = current.document.products[0];
    for (const value of [
      { ...item, category: "missing" },
      { ...item, image: "https://evil.example/image" },
      { ...item, image: "/media/../../secret" },
    ])
      await expect(
        repository.update({
          kind: "product",
          action: "save",
          id: item.id,
          version: current.version,
          value,
        }),
      ).rejects.toBeInstanceOf(CatalogError);
  });
  test("missing translations fall back field by field", async () => {
    const item = (await repository.read()).document.products[0];
    item.translations.en = {
      name: "English name",
      description: "",
      type: "",
      alt: "",
    };
    expect(localized(item, "en").name).toBe("English name");
    expect(localized(item, "en").description).toBe(
      item.translations.fr.description,
    );
  });
});
describe("admin security", () => {
  test("accepts the HTTP host when Next normalizes localhost", () => {
    const request = (origin: string) =>
      new Request("http://localhost:3001/api/admin/login", {
        method: "POST",
        headers: { host: "127.0.0.1:3001", origin },
      });
    expect(() => checkOrigin(request("http://127.0.0.1:3001"))).not.toThrow();
    expect(() => checkOrigin(request("https://evil.example"))).toThrow(
      CatalogError,
    );
  });
  test("passwords are hashed; sessions reject tampering, expiry and credential rotation", () => {
    const previousHash = process.env.ADMIN_PASSWORD_HASH;
    const previousSecret = process.env.ADMIN_SESSION_SECRET;
    try {
      const hash = hashPassword("a-long-test-password");
      expect(hash).not.toContain("a-long-test-password");
      expect(verifyPassword("a-long-test-password", hash)).toBe(true);
      expect(verifyPassword("wrong", hash)).toBe(false);
      process.env.ADMIN_PASSWORD_HASH = hash;
      process.env.ADMIN_SESSION_SECRET = "test-secret-".repeat(5);
      const token = createSession(1000);
      expect(validSession(token, 1001)).toBe(true);
      expect(validSession(token + "x", 1001)).toBe(false);
      expect(validSession(token, 1000 + sessionSeconds * 1000)).toBe(false);
      process.env.ADMIN_PASSWORD_HASH = hashPassword("changed-password");
      expect(validSession(token, 1001)).toBe(false);
    } finally {
      if (previousHash === undefined) delete process.env.ADMIN_PASSWORD_HASH;
      else process.env.ADMIN_PASSWORD_HASH = previousHash;
      if (previousSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
      else process.env.ADMIN_SESSION_SECRET = previousSecret;
    }
  });
  test("admin routes reject unauthenticated access and cross-origin writes", () => {
    expect(() =>
      requireAdmin(new NextRequest("http://localhost:3000/api/admin/catalog")),
    ).toThrow(CatalogError);
    const previousHash = process.env.ADMIN_PASSWORD_HASH;
    const previousSecret = process.env.ADMIN_SESSION_SECRET;
    try {
      process.env.ADMIN_PASSWORD_HASH = hashPassword("test-password");
      process.env.ADMIN_SESSION_SECRET = "test-secret-".repeat(5);
      const cookie = adminCookie + "=" + createSession();
      expect(() =>
        requireAdmin(
          new NextRequest("http://localhost:3000/api/admin/catalog", {
            method: "POST",
            headers: { cookie, origin: "https://evil.example" },
          }),
        ),
      ).toThrow(CatalogError);
      expect(() =>
        requireAdmin(
          new NextRequest("http://localhost:3000/api/admin/catalog", {
            method: "POST",
            headers: { cookie, origin: "http://localhost:3000" },
          }),
        ),
      ).not.toThrow();
    } finally {
      if (previousHash === undefined) delete process.env.ADMIN_PASSWORD_HASH;
      else process.env.ADMIN_PASSWORD_HASH = previousHash;
      if (previousSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
      else process.env.ADMIN_SESSION_SECRET = previousSecret;
    }
  });
  test("rejects oversized JSON and invalid image payloads", async () => {
    await expect(
      readJson(
        new Request("http://localhost/api", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: '{"value":"' + "a".repeat(1000) + '"}',
        }),
        100,
      ),
    ).rejects.toMatchObject({ status: 413 });
    await expect(
      uploadCatalogImage(Buffer.from("not an image"), "image/png"),
    ).rejects.toBeInstanceOf(CatalogError);
    await expect(
      uploadCatalogImage(Buffer.from("<svg></svg>"), "image/svg+xml"),
    ).rejects.toMatchObject({ status: 415 });
  });
  test("serverless deployments cannot fall back to local disk", () => {
    const old = {
      VERCEL: process.env.VERCEL,
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      CATALOG_STORAGE: process.env.CATALOG_STORAGE,
    };
    try {
      process.env.VERCEL = "1";
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      process.env.CATALOG_STORAGE = "local";
      expect(() => storageMode()).toThrow(CatalogError);
    } finally {
      for (const [key, value] of Object.entries(old)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });
});

describe("stored admin account", () => {
  let previousSecret: string | undefined;
  beforeEach(() => {
    previousSecret = process.env.ADMIN_SESSION_SECRET;
    process.env.ADMIN_SESSION_SECRET = "stored-account-test-secret-".repeat(3);
  });
  afterEach(() => {
    if (previousSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
    else process.env.ADMIN_SESSION_SECRET = previousSecret;
  });
  test("seed is idempotent, changes persist and old sessions stop working", async () => {
    const accounts = new AdminAccounts(new LocalCatalogStorage(directory));
    const initial = await accounts.seed({
      username: "admin",
      passwordHash: hashPassword("initial-password-test"),
    });
    const token = createSession(Date.now(), initial.passwordHash);
    const updated = await accounts.change(
      {
        username: "neuz-owner",
        currentPassword: "initial-password-test",
        newPassword: "replacement-password-test",
        confirmPassword: "replacement-password-test",
      },
      initial.passwordHash,
    );
    const reloaded = await new AdminAccounts(
      new LocalCatalogStorage(directory),
    ).seed();
    expect(reloaded).toEqual(updated);
    expect(verifyPassword("initial-password-test", reloaded.passwordHash)).toBe(
      false,
    );
    expect(
      verifyPassword("replacement-password-test", reloaded.passwordHash),
    ).toBe(true);
    expect(validSession(token, Date.now(), reloaded.passwordHash)).toBe(false);
    expect(
      validSession(
        createSession(Date.now(), reloaded.passwordHash),
        Date.now(),
        reloaded.passwordHash,
      ),
    ).toBe(true);
    expect(
      publicCatalog((await repository.read()).document),
    ).not.toHaveProperty("adminAccount");
  });
  test("wrong current password, mismatched confirmation and stale sessions cannot change credentials", async () => {
    const accounts = new AdminAccounts(new LocalCatalogStorage(directory));
    const initial = await accounts.seed({
      username: "admin",
      passwordHash: hashPassword("initial-password-test"),
    });
    const input = {
      username: "new-admin",
      currentPassword: "initial-password-test",
      newPassword: "replacement-password-test",
      confirmPassword: "replacement-password-test",
    };
    await expect(
      accounts.change(
        { ...input, currentPassword: "incorrect" },
        initial.passwordHash,
      ),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      accounts.change(
        { ...input, confirmPassword: "different-password" },
        initial.passwordHash,
      ),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      accounts.change(
        { ...input, newPassword: "short", confirmPassword: "short" },
        initial.passwordHash,
      ),
    ).rejects.toMatchObject({ status: 400 });
    await expect(accounts.change(input, "stale-hash")).rejects.toMatchObject({
      status: 401,
    });
    expect(await accounts.seed()).toEqual(initial);
  });
  test("explicit recovery replaces credentials without touching products", async () => {
    const accounts = new AdminAccounts(new LocalCatalogStorage(directory));
    await accounts.seed({
      username: "admin",
      passwordHash: hashPassword("initial-password-test"),
    });
    const before = (await repository.read()).document.products;
    const replacement = {
      username: "recovered",
      passwordHash: hashPassword("recovery-password-test"),
    };
    await accounts.seed(replacement);
    expect(await accounts.seed()).toEqual(replacement);
    expect((await repository.read()).document.products).toEqual(before);
  });
});
