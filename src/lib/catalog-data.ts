import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { CatalogRepository } from "./catalog-repository";
import { publicCatalog } from "./catalog-model";
export const getPublicCatalog = cache(async () => {
  await connection();
  return publicCatalog((await new CatalogRepository().read()).document);
});
