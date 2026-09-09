import { limitAdmin } from "@/lib/admin-rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { AdminAccounts } from "@/lib/admin-account";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  adminCookie,
  createSession,
  sessionSeconds,
  verifyPassword,
} from "@/lib/admin-auth";
import { adminError, checkOrigin, readJson } from "@/lib/admin-http";
import { CatalogError } from "@/lib/catalog-storage";
export async function POST(request: NextRequest) {
  try {
    checkOrigin(request);
    if ((process.env.ADMIN_SESSION_SECRET?.length || 0) < 32)
      throw new CatalogError(
        "Configurez le compte administrateur avec bun run admin:setup.",
        503,
      );
    await limitAdmin(request, "login");
    const parsed = z
      .object({
        username: z.string().max(100),
        password: z.string().min(1).max(256),
        turnstile: z.string().max(2048).optional(),
      })
      .safeParse(await readJson(request, 4096));
    if (!parsed.success)
      throw new CatalogError("Identifiants incorrects.", 401);
    await verifyTurnstile(request, parsed.data.turnstile, "admin_login");
    const account = await new AdminAccounts().seed();
    const passwordCorrect = verifyPassword(
      parsed.data.password,
      account.passwordHash,
    );
    if (parsed.data.username !== account.username || !passwordCorrect)
      throw new CatalogError("Identifiants incorrects.", 401);
    const response = NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
    response.cookies.set(
      adminCookie,
      createSession(Date.now(), account.passwordHash),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: sessionSeconds,
      },
    );
    return response;
  } catch (error) {
    return adminError(error);
  }
}
