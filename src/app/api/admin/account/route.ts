import { NextRequest, NextResponse } from "next/server";
import { AdminAccounts, requireAccount } from "@/lib/admin-account";
import { adminCookie } from "@/lib/admin-auth";
import { adminError, readJson } from "@/lib/admin-http";
import { limitAdmin } from "@/lib/admin-rate-limit";
export async function POST(request: NextRequest) {
  try {
    const account = await requireAccount(request);
    const input = await readJson(request, 4096);
    await limitAdmin(request, "account");
    await new AdminAccounts().change(input, account.passwordHash);
    const response = NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
    response.cookies.set(adminCookie, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch (error) {
    return adminError(error);
  }
}
