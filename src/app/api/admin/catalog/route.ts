import { requireAccount } from "@/lib/admin-account";
import { NextRequest } from "next/server";
import { z } from "zod";
import { adminError, readJson } from "@/lib/admin-http";
import { CatalogRepository } from "@/lib/catalog-repository";
import { CatalogError, storageMode } from "@/lib/catalog-storage";
import type { CatalogSnapshot } from "@/lib/catalog-model";
function catalogResponse(snapshot: CatalogSnapshot) {
  return Response.json(
    {
      version: snapshot.version,
      products: snapshot.document.products,
      categories: snapshot.document.categories,
      storage: storageMode(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function GET(request: NextRequest) {
  try {
    await requireAccount(request);
    return catalogResponse(await new CatalogRepository().read());
  } catch (error) {
    return adminError(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    await requireAccount(request);
    const mutation = z
      .object({
        kind: z.enum(["product", "category"]),
        action: z.enum(["save", "delete"]),
        id: z.string().max(100).optional(),
        version: z.number().int().positive(),
        value: z.unknown().optional(),
      })
      .safeParse(await readJson(request));
    if (!mutation.success)
      throw new CatalogError("Donn\u00E9es de modification invalides.");
    return catalogResponse(await new CatalogRepository().update(mutation.data));
  } catch (error) {
    return adminError(error);
  }
}
