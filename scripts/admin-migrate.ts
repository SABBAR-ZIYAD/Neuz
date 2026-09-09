import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { categoryInput, productInput } from "../src/lib/catalog-model";
import { creations } from "../src/lib/quote";
import { dataDirectory, supabase } from "../src/lib/catalog-storage";
const source = JSON.parse(
  await readFile(join(dataDirectory(), "catalog.json"), "utf8"),
);
const schema = z.object({
  adminAccount: z
    .object({
      username: z.string().min(1).max(100),
      passwordHash: z.string().regex(/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/),
    })
    .optional(),
  categories: z.array(categoryInput.extend({ id: z.string() })),
  products: z.array(
    productInput.extend({ id: z.string(), creation: z.enum(creations) }),
  ),
});
const document = { ...schema.parse(source.document), loginAttempts: [] };
const client = supabase();
const existing = await client
  .from("neuz_catalog")
  .select("id")
  .eq("id", "main")
  .maybeSingle();
if (existing.error)
  throw Error(
    "Run supabase/admin.sql and verify the Supabase environment first.",
  );
if (existing.data)
  throw Error(
    "The remote catalog already exists. Migration stopped without overwriting it.",
  );
const prefixes = [
  ...new Set(
    document.products
      .map((p) => p.image)
      .filter((image) => image.startsWith("/media/")),
  ),
];
for (const prefix of prefixes) {
  const id = prefix.slice("/media/".length);
  if (!/^[a-f0-9-]{36}$/.test(id)) throw Error("Invalid local image path.");
  for (const width of [480, 800, 1440]) {
    const filename = id + "-" + width + ".webp";
    const bytes = await readFile(join(dataDirectory(), "uploads", filename));
    const result = await client.storage
      .from("neuz-products")
      .upload(filename, bytes, {
        contentType: "image/webp",
        cacheControl: "31536000",
        upsert: true,
      });
    if (result.error)
      throw Error("Image migration failed. The catalog was not imported.");
  }
  const url = client.storage.from("neuz-products").getPublicUrl(id)
    .data.publicUrl;
  document.products = document.products.map((p) =>
    p.image === prefix ? { ...p, image: url } : p,
  );
}
const result = await client
  .from("neuz_catalog")
  .insert({ id: "main", version: 1, document });
if (result.error)
  throw Error(
    "Catalog import failed or a remote catalog was created concurrently. No existing catalog was overwritten.",
  );
console.log(
  "Imported " +
    document.products.length +
    " products and " +
    document.categories.length +
    " categories. Local originals are retained.",
);
