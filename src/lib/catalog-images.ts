import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import {
  CatalogError,
  dataDirectory,
  storageMode,
  supabase,
} from "./catalog-storage";
export const imageByteLimit = 3 * 1024 * 1024;
export async function uploadCatalogImage(bytes: Buffer, mime: string) {
  if (bytes.length === 0 || bytes.length > imageByteLimit)
    throw new CatalogError("Choisissez une image de moins de 3 Mo.", 413);
  if (!["image/jpeg", "image/png", "image/webp"].includes(mime))
    throw new CatalogError("Formats accept\u00E9s : JPG, PNG ou WebP.", 415);
  let metadata;
  try {
    metadata = await sharp(bytes, { limitInputPixels: 25000000 }).metadata();
  } catch {
    throw new CatalogError("Cette image est invalide ou trop grande.");
  }
  if (
    !["jpeg", "png", "webp"].includes(metadata.format || "") ||
    !metadata.width ||
    !metadata.height ||
    (metadata.pages || 1) > 1
  )
    throw new CatalogError(
      "Choisissez une image JPG, PNG ou WebP non anim\u00E9e.",
    );
  const id = randomUUID();
  const mode = storageMode();
  const uploaded: string[] = [];
  try {
    for (const width of [480, 800, 1440]) {
      const output = await sharp(bytes, { limitInputPixels: 25000000 })
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
      const filename = id + "-" + width + ".webp";
      if (mode === "supabase") {
        const { error } = await supabase()
          .storage.from("neuz-products")
          .upload(filename, output, {
            contentType: "image/webp",
            cacheControl: "31536000",
            upsert: false,
          });
        if (error)
          throw new CatalogError(
            "Import impossible. V\u00E9rifiez le bucket Supabase neuz-products.",
            503,
          );
      } else {
        const directory = join(dataDirectory(), "uploads");
        await mkdir(directory, { recursive: true });
        await writeFile(join(directory, filename), output);
      }
      uploaded.push(filename);
    }
  } catch (error) {
    if (mode === "supabase" && uploaded.length)
      await supabase().storage.from("neuz-products").remove(uploaded);
    throw error;
  }
  return mode === "supabase"
    ? supabase().storage.from("neuz-products").getPublicUrl(id).data.publicUrl
    : "/media/" + id;
}
