import { isNetlifyDeployment } from "./deployment";
import {
  mkdir,
  readFile,
  writeFile,
  rename,
  rmdir,
  stat,
} from "node:fs/promises";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { seedCatalog } from "./catalog-seed";
import type { CatalogDocument, CatalogSnapshot } from "./catalog-model";
export interface CatalogStorage {
  read(): Promise<CatalogSnapshot>;
  compareAndSwap(version: number, document: CatalogDocument): Promise<boolean>;
}
export class CatalogError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function storageMode(): "local" | "supabase" {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
    return "supabase";
  if (process.env.SUPABASE_URL || process.env.SUPABASE_SERVICE_ROLE_KEY)
    throw new CatalogError(
      "Renseignez les deux variables Supabase : URL et clé serveur.",
      503,
    );
  if (
    process.env.VERCEL ||
    isNetlifyDeployment() ||
    (process.env.NODE_ENV === "production" &&
      process.env.CATALOG_STORAGE !== "local")
  )
    throw new CatalogError(
      "Configurez Supabase avant la mise en ligne (voir docs/admin.md).",
      503,
    );
  return "local";
}
export function dataDirectory() {
  return resolve(
    /* turbopackIgnore: true */ process.env.CATALOG_DATA_DIR || "data",
  );
}
export function supabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new CatalogError(
      "La connexion Supabase n\u2019est pas configur\u00E9e.",
      503,
    );
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
export class LocalCatalogStorage implements CatalogStorage {
  constructor(private directory = dataDirectory()) {}
  private async locked<T>(work: () => Promise<T>): Promise<T> {
    await mkdir(this.directory, { recursive: true });
    const lock = join(this.directory, "catalog.lock");
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        await mkdir(lock);
        break;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        const info = await stat(lock).catch(() => null);
        if (info && Date.now() - info.mtimeMs > 60000)
          await rmdir(lock).catch(() => {});
        if (attempt === 99)
          throw new CatalogError(
            "Le catalogue est occup\u00E9. R\u00E9essayez dans quelques instants.",
            503,
          );
        await new Promise((r) => setTimeout(r, 50));
      }
    }
    try {
      return await work();
    } finally {
      await rmdir(lock).catch(() => {});
    }
  }
  private async load(): Promise<CatalogSnapshot> {
    try {
      return JSON.parse(
        await readFile(join(this.directory, "catalog.json"), "utf8"),
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const value = { version: 1, document: seedCatalog() };
      await this.save(value);
      return value;
    }
  }
  private async save(value: CatalogSnapshot) {
    const temporary = join(this.directory, "catalog-" + randomUUID() + ".tmp");
    await writeFile(temporary, JSON.stringify(value), { mode: 0o600 });
    await rename(temporary, join(this.directory, "catalog.json"));
  }
  read() {
    return this.locked(() => this.load());
  }
  compareAndSwap(version: number, document: CatalogDocument) {
    return this.locked(async () => {
      const current = await this.load();
      if (current.version !== version) return false;
      await this.save({ version: version + 1, document });
      return true;
    });
  }
}
export class SupabaseCatalogStorage implements CatalogStorage {
  async read(): Promise<CatalogSnapshot> {
    const client = supabase();
    let result = await client
      .from("neuz_catalog")
      .select("version,document")
      .eq("id", "main")
      .maybeSingle();
    if (result.error)
      throw new CatalogError(
        "Catalogue indisponible. V\u00E9rifiez la connexion et le script Supabase.",
        503,
      );
    if (!result.data) {
      const seeded = await client
        .from("neuz_catalog")
        .upsert(
          { id: "main", version: 1, document: seedCatalog() },
          { onConflict: "id", ignoreDuplicates: true },
        );
      if (seeded.error)
        throw new CatalogError(
          "Impossible d\u2019initialiser le catalogue Supabase.",
          503,
        );
      result = await client
        .from("neuz_catalog")
        .select("version,document")
        .eq("id", "main")
        .single();
    }
    if (result.error || !result.data)
      throw new CatalogError("Catalogue indisponible.", 503);
    return result.data as CatalogSnapshot;
  }
  async compareAndSwap(version: number, document: CatalogDocument) {
    const { data, error } = await supabase()
      .from("neuz_catalog")
      .update({ version: version + 1, document })
      .eq("id", "main")
      .eq("version", version)
      .select("version")
      .maybeSingle();
    if (error)
      throw new CatalogError(
        "Impossible d\u2019enregistrer le catalogue.",
        503,
      );
    return Boolean(data);
  }
}
export function catalogStorage(): CatalogStorage {
  return storageMode() === "supabase"
    ? new SupabaseCatalogStorage()
    : new LocalCatalogStorage();
}
