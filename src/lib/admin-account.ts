import { z } from "zod";
import type { NextRequest } from "next/server";
import {
  adminConfigured,
  adminCookie,
  hashPassword,
  validSession,
  verifyPassword,
} from "./admin-auth";
import {
  catalogStorage,
  CatalogError,
  type CatalogStorage,
} from "./catalog-storage";
import type { AdminAccount } from "./catalog-model";
import { checkOrigin } from "./admin-http";
export const accountInput = z
  .object({
    username: z
      .string()
      .trim()
      .min(3)
      .max(100)
      .regex(/^[a-zA-Z0-9._@-]+$/),
    currentPassword: z.string().min(1).max(256),
    newPassword: z.string().min(8).max(256),
    confirmPassword: z.string().min(8).max(256),
  })
  .refine(
    (value) => value.newPassword === value.confirmPassword,
    "Les mots de passe ne correspondent pas.",
  );
export class AdminAccounts {
  constructor(private storage: CatalogStorage = catalogStorage()) {}
  async seed(replacement?: AdminAccount): Promise<AdminAccount> {
    for (let attempt = 0; attempt < 8; attempt++) {
      const current = await this.storage.read();
      if (current.document.adminAccount && !replacement)
        return current.document.adminAccount;
      const account = replacement || {
        username: process.env.ADMIN_USERNAME || "admin",
        passwordHash: process.env.ADMIN_PASSWORD_HASH || "",
      };
      if (!adminConfigured(account.passwordHash))
        throw new CatalogError(
          "Configurez le compte avec bun run admin:setup.",
          503,
        );
      if (
        await this.storage.compareAndSwap(current.version, {
          ...current.document,
          adminAccount: account,
        })
      )
        return account;
    }
    throw new CatalogError("Compte occupé. Réessayez.", 409);
  }
  async change(input: unknown, expectedHash: string) {
    const parsed = accountInput.safeParse(input);
    if (!parsed.success)
      throw new CatalogError(
        "Vérifiez l’identifiant et les mots de passe (8 caractères minimum, confirmation identique).",
      );
    const current = await this.storage.read();
    const account = current.document.adminAccount;
    if (!account || account.passwordHash !== expectedHash)
      throw new CatalogError("Reconnectez-vous.", 401);
    if (!verifyPassword(parsed.data.currentPassword, account.passwordHash))
      throw new CatalogError("Le mot de passe actuel est incorrect.", 400);
    if (parsed.data.newPassword === parsed.data.currentPassword)
      throw new CatalogError("Choisissez un nouveau mot de passe différent.");
    const updated = {
      username: parsed.data.username,
      passwordHash: hashPassword(parsed.data.newPassword),
    };
    if (
      !(await this.storage.compareAndSwap(current.version, {
        ...current.document,
        adminAccount: updated,
      }))
    )
      throw new CatalogError("Une modification a eu lieu. Réessayez.", 409);
    return updated;
  }
}
export async function sessionAccount(token: string | undefined) {
  if (
    !token ||
    token.length > 2048 ||
    (process.env.ADMIN_SESSION_SECRET?.length || 0) < 32
  )
    return null;
  const account = await new AdminAccounts().seed();
  return validSession(token, Date.now(), account.passwordHash) ? account : null;
}
export async function requireAccount(request: NextRequest) {
  if (request.method !== "GET") checkOrigin(request);
  const account = await sessionAccount(request.cookies.get(adminCookie)?.value);
  if (!account)
    throw new CatalogError("Votre session a expiré. Reconnectez-vous.", 401);
  return account;
}
