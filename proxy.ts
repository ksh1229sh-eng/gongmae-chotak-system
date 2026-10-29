// 담당자 화면(/staff)과 담당자 API(/api/staff)는 로그인 쿠키가 있어야만 열립니다. (DESIGN.md 8장)
// 로그인 화면과 로그인 API만 예외입니다.
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

const PUBLIC_PATHS = ["/staff/login", "/api/staff/login"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();

  if (verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const login = new URL("/staff/login", request.url);
  login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/staff/:path*", "/api/staff/:path*"],
};
