import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { dataDirectory, storageMode } from "@/lib/catalog-storage";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;
  if (!/^[a-f0-9-]{36}-(480|800|1440)\.webp$/.test(filename))
    return new Response(null, { status: 404 });
  try {
    if (storageMode() !== "local") return new Response(null, { status: 404 });
    const data = await readFile(join(dataDirectory(), "uploads", filename));
    return new Response(data, {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
