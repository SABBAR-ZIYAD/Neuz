import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { NextResponse, type NextRequest } from "next/server";
const localize = createMiddleware(routing);
export default function proxy(request: NextRequest) {
  const preference = request.cookies.get("NEXT_LOCALE")?.value;
  if (
    request.nextUrl.pathname === "/" &&
    (preference === "en" || preference === "ar")
  ) {
    return NextResponse.redirect(new URL(`/${preference}`, request.url));
  }
  return localize(request);
}
export const config = {
  matcher: ["/((?!api|admin|media|_next|_vercel|.*\\..*).*)"],
};
