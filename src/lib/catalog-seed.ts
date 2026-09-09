import { products } from "./catalog";
import { services } from "./services";
import type {
  CatalogDocument,
  CategoryText,
  ProductText,
} from "./catalog-model";
import fr from "../../messages/fr.json";
import en from "../../messages/en.json";
import ar from "../../messages/ar.json";
export function seedCatalog(): CatalogDocument {
  const messages = { fr, en, ar };
  return {
    loginAttempts: [],
    categories: services.map((service, order) => ({
      id: service.category,
      slug: service.slug,
      creation: ({ rugs: "rug", mirrors: "mirror", wall: "wall" } as const)[
        service.category
      ],
      published: true,
      order,
      translations: Object.fromEntries(
        Object.entries(messages).map(([locale, m]) => [
          locale,
          {
            ...m.services[service.category],
            name: m.creations[service.category],
          },
        ]),
      ) as Record<"fr" | "en" | "ar", CategoryText>,
    })),
    products: products.map((product, order) => ({
      ...product,
      published: true,
      order,
      translations: Object.fromEntries(
        Object.entries(messages).map(([locale, m]) => [
          locale,
          m.products[product.id],
        ]),
      ) as Record<"fr" | "en" | "ar", ProductText>,
    })),
  };
}
