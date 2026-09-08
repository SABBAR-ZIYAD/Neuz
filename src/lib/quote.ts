import { z } from "zod";
export const profiles = [
  "designer",
  "architect",
  "hotel",
  "riad",
  "restaurant",
  "company",
  "private",
  "other",
] as const;
export const projects = [
  "residential",
  "hospitality",
  "restaurant",
  "retail",
  "office",
  "other",
] as const;
export const creations = [
  "rug",
  "mirror",
  "table",
  "sculpture",
  "painting",
  "wall",
  "pouf",
  "cushion",
  "other",
] as const;
export const budgets = [
  "under5000",
  "5000to15000",
  "15000to30000",
  "over30000",
  "discuss",
] as const;
export const methods = ["whatsapp", "email", "phone"] as const;
export const MAX_FILES = 5;
export const MAX_FILE_BYTES = 3 * 1024 * 1024;
export const fileTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];
const dimension = z
  .string()
  .trim()
  .max(12)
  .refine(
    (v) =>
      !v ||
      (Number.isFinite(Number(v)) && Number(v) > 0 && Number(v) <= 100000),
  );
export const quoteSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().max(254),
  phone: z
    .string()
    .trim()
    .min(7)
    .max(32)
    .regex(/^[+\d\s().-]+$/)
    .refine((v) => v.replace(/\D/g, "").length >= 7),
  profile: z.enum(profiles),
  project: z.enum(projects),
  creation: z.enum(creations),
  quantity: z.coerce.number().int().min(1).max(10000),
  width: dimension,
  height: dimension,
  unit: z.enum(["cm", "m", "mm"]),
  budget: z.enum(budgets),
  brief: z.string().trim().min(10).max(6000),
  method: z.enum(methods),
  consent: z.literal(true),
  locale: z.enum(["fr", "en", "ar"]),
  inspiration: z.string().trim().max(200).optional(),
  website: z.string().max(200).optional(),
  requestId: z.uuid(),
  turnstile: z.string().max(2048).optional(),
});
export type QuoteData = z.infer<typeof quoteSchema>;
export function validFileSignature(bytes: Uint8Array, mime: string) {
  if (mime === "image/jpeg")
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/png")
    return [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b);
  if (mime === "application/pdf")
    return new TextDecoder().decode(bytes.subarray(0, 5)) === "%PDF-";
  if (mime === "image/webp")
    return (
      new TextDecoder().decode(bytes.subarray(0, 4)) === "RIFF" &&
      new TextDecoder().decode(bytes.subarray(8, 12)) === "WEBP"
    );
  return false;
}
export function safeFilename(name: string) {
  return (
    name.replace(/[\x00-\x1f\x7f<>:"/\\|?*]/g, "_").slice(-160) || "reference"
  );
}
