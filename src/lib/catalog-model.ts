import { z } from "zod";
import { creations } from "./quote";
export const catalogLocales = ["fr", "en", "ar"] as const;
export type CatalogLocale = (typeof catalogLocales)[number];
const text = z.string().trim().max(4000);
const productText = z.object({
  name: z.string().trim().max(120),
  type: z.string().trim().max(160),
  description: text,
  alt: z.string().trim().max(240),
});
const categoryText = z.object({
  name: z.string().trim().max(80),
  title: z.string().trim().max(160),
  description: text,
  intro: text,
  detail: text,
  question: z.string().trim().max(240),
  answer: text,
});
const productTranslations = z.object({
  fr: productText.extend({
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().min(10).max(4000),
  }),
  en: productText,
  ar: productText,
});
const categoryTranslations = z.object({
  fr: categoryText.extend({
    name: z.string().trim().min(2).max(80),
    description: z.string().trim().min(10).max(4000),
  }),
  en: categoryText,
  ar: categoryText,
});
export const productInput = z.object({
  category: z.string().min(1).max(100),
  image: z.string().min(1).max(500),
  published: z.boolean(),
  order: z.number().int().min(0).max(10000),
  translations: productTranslations,
});
export const categoryInput = z.object({
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  creation: z.enum(creations),
  published: z.boolean(),
  order: z.number().int().min(0).max(10000),
  translations: categoryTranslations,
});
export type ProductText = z.infer<typeof productText>;
export type CategoryText = z.infer<typeof categoryText>;
export type CatalogProduct = z.infer<typeof productInput> & {
  id: string;
  creation: (typeof creations)[number];
};
export type CatalogCategory = z.infer<typeof categoryInput> & { id: string };
export type AdminAccount = { username: string; passwordHash: string };
export type CatalogDocument = {
  adminAccount?: AdminAccount;
  products: CatalogProduct[];
  categories: CatalogCategory[];
  loginAttempts: number[];
};
export type CatalogSnapshot = { version: number; document: CatalogDocument };
export type PublicCatalog = {
  products: CatalogProduct[];
  categories: CatalogCategory[];
};
export function localized<T extends Record<string, string>>(
  item: { translations: Record<CatalogLocale, T> },
  locale: string,
): T {
  const language = locale === "en" || locale === "ar" ? locale : "fr";
  const fallback = item.translations.fr;
  return Object.fromEntries(
    Object.keys(fallback).map((key) => [
      key,
      item.translations[language][key] || fallback[key],
    ]),
  ) as T;
}
export function publicCatalog(document: CatalogDocument): PublicCatalog {
  const categories = document.categories
    .filter(
      (category) =>
        category.published &&
        document.products.some(
          (p) => p.published && p.category === category.id,
        ),
    )
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  return {
    categories,
    products: document.products
      .filter((p) => p.published && categories.some((c) => c.id === p.category))
      .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id)),
  };
}
export function imageSource(name: string, width = 800) {
  return (
    (name.startsWith("/") || name.startsWith("https://")
      ? name
      : "/images/" + name) +
    "-" +
    width +
    ".webp"
  );
}
