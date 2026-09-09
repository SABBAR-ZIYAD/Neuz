import { randomUUID } from "node:crypto";
import {
  categoryInput,
  productInput,
  type CatalogSnapshot,
} from "./catalog-model";
import {
  catalogStorage,
  CatalogError,
  type CatalogStorage,
} from "./catalog-storage";
import { products as originalProducts } from "./catalog";
export type CatalogMutation = {
  kind: "product" | "category";
  action: "save" | "delete";
  id?: string;
  version: number;
  value?: unknown;
};
export function allowedImage(image: string) {
  if (originalProducts.some((p) => p.image === image)) return true;
  if (/^\/media\/[a-f0-9-]{36}$/.test(image))
    return !process.env.VERCEL && !process.env.SUPABASE_URL;
  const root = process.env.SUPABASE_URL?.replace(/\/$/, "");
  return Boolean(
    root &&
    image.startsWith(root + "/storage/v1/object/public/neuz-products/") &&
    /^[a-f0-9-]{36}$/.test(
      image.slice((root + "/storage/v1/object/public/neuz-products/").length),
    ),
  );
}
export class CatalogRepository {
  constructor(private storage: CatalogStorage = catalogStorage()) {}
  read() {
    return this.storage.read();
  }
  async update(mutation: CatalogMutation): Promise<CatalogSnapshot> {
    const current = await this.read();
    if (current.version !== mutation.version)
      throw new CatalogError(
        "Le catalogue a chang\u00E9. Rechargez la liste avant de r\u00E9essayer.",
        409,
      );
    const document = structuredClone(current.document);
    if (mutation.kind === "product") {
      const index = document.products.findIndex((p) => p.id === mutation.id);
      if (mutation.id && index < 0)
        throw new CatalogError("Produit introuvable.", 404);
      if (mutation.action === "delete") {
        if (index < 0) throw new CatalogError("Produit introuvable.", 404);
        document.products.splice(index, 1);
      } else {
        const parsed = productInput.safeParse(mutation.value);
        if (!parsed.success)
          throw new CatalogError(
            "V\u00E9rifiez le nom, la description, la cat\u00E9gorie et l\u2019image du produit.",
          );
        const category = document.categories.find(
          (c) => c.id === parsed.data.category,
        );
        if (!category)
          throw new CatalogError("Choisissez une cat\u00E9gorie existante.");
        if (!allowedImage(parsed.data.image))
          throw new CatalogError(
            "Veuillez importer une image depuis ce panneau.",
          );
        const value = {
          ...parsed.data,
          id: mutation.id || randomUUID(),
          creation: category.creation,
        };
        if (index < 0) {
          if (document.products.length >= 500)
            throw new CatalogError("La limite de 500 produits est atteinte.");
          document.products.push(value);
        } else document.products[index] = value;
      }
    } else {
      const index = document.categories.findIndex((c) => c.id === mutation.id);
      if (mutation.id && index < 0)
        throw new CatalogError("Cat\u00E9gorie introuvable.", 404);
      if (mutation.action === "delete") {
        if (index < 0)
          throw new CatalogError("Cat\u00E9gorie introuvable.", 404);
        if (document.products.some((p) => p.category === mutation.id))
          throw new CatalogError(
            "D\u00E9placez ou supprimez les produits de cette cat\u00E9gorie avant de la supprimer.",
            409,
          );
        document.categories.splice(index, 1);
      } else {
        const parsed = categoryInput.safeParse(mutation.value);
        if (!parsed.success)
          throw new CatalogError(
            "V\u00E9rifiez le nom, la description et l\u2019adresse de la cat\u00E9gorie.",
          );
        if (index >= 0 && document.categories[index].slug !== parsed.data.slug)
          throw new CatalogError(
            "L\u2019adresse d\u2019une cat\u00E9gorie existante ne peut pas \u00EAtre modifi\u00E9e.",
          );
        if (
          document.categories.some(
            (c) => c.slug === parsed.data.slug && c.id !== mutation.id,
          )
        )
          throw new CatalogError(
            "Cette adresse de cat\u00E9gorie existe d\u00E9j\u00E0.",
            409,
          );
        const value = { ...parsed.data, id: mutation.id || randomUUID() };
        if (index < 0) {
          if (document.categories.length >= 100)
            throw new CatalogError(
              "La limite de 100 cat\u00E9gories est atteinte.",
            );
          document.categories.push(value);
        } else document.categories[index] = value;
        document.products = document.products.map((p) =>
          p.category === value.id ? { ...p, creation: value.creation } : p,
        );
      }
    }
    if (!(await this.storage.compareAndSwap(current.version, document)))
      throw new CatalogError(
        "Une autre modification vient d\u2019\u00EAtre enregistr\u00E9e. Rechargez la liste.",
        409,
      );
    return { version: current.version + 1, document };
  }
}
