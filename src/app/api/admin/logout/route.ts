import { NextRequest, NextResponse } from "next/server";
import { adminCookie } from "@/lib/admin-auth";
import { adminError, checkOrigin } from "@/lib/admin-http";
export async function POST(request: NextRequest) {
  try {
    checkOrigin(request);
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
