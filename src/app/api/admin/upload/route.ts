import { requireAccount } from "@/lib/admin-account";
import { NextRequest } from "next/server";
import { adminError, readBody } from "@/lib/admin-http";
import { uploadCatalogImage, imageByteLimit } from "@/lib/catalog-images";
export async function POST(request: NextRequest) {
  try {
    await requireAccount(request);
    const bytes = await readBody(request, imageByteLimit);
    const image = await uploadCatalogImage(
      bytes,
      request.headers.get("content-type") || "",
    );
    return Response.json(
      { image },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return adminError(error);
  }
}
