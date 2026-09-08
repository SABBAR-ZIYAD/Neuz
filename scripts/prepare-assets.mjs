import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";
const root = process.cwd();
const assets = {
  "restaurant-arch": "Warmly Lit Restaurant with Arch Art.png",
  "maison-interior": "image-gen-1(3).png",
  "mirror-arch": "Warm Moroccan Boho Living Space.png",
  "mirror-wave": "A9375197-94F6-4383-9A55-45E457542521(2).jpeg",
  "mirror-babouche": "Moroccan Babouche Mirror Entryway(1).png",
  "rug-composition": "73E84EDC-5AEF-4AA8-98C4-7C0A49A5B851.jpeg",
  "rug-sculptural": "45E0008A-3089-44D9-9E2D-2CCED20597D4(2).jpeg",
  "textile-detail": "CC6D50AA-A002-4557-BBE6-4E96F05E9F44(2).jpeg",
  "atelier-tufting": "92ef0fde-6da9-4567-8ef4-17fe49eff44b(1).jpeg",
  "lounge-arch": "BED11E43-9E35-4958-8702-24EF48F86E92.jpeg",
  "bedroom-mirror": "Warm Rustic Bedroom and Ensuite.png",
};
await mkdir(path.join(root, "public/images"), { recursive: true });
for (const [name, file] of Object.entries(assets)) {
  for (const width of [480, 800, 1440]) {
    await sharp(path.join(root, "images", file))
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 83, effort: 5 })
      .toFile(path.join(root, "public/images", `${name}-${width}.webp`));
  }
  console.log(`Prepared ${name}`);
}
const logo = sharp(path.join(root, "logo.png"));
console.log("Logo:", await logo.metadata());
await logo
  .trim()
  .resize({ width: 700, withoutEnlargement: true })
  .png()
  .toFile(path.join(root, "public/images/neuz-logo.png"));
await sharp(path.join(root, "images", assets["restaurant-arch"]))
  .resize(1200, 630, { fit: "cover" })
  .jpeg({ quality: 86 })
  .toFile(path.join(root, "public/images/og-neuz.jpg"));
