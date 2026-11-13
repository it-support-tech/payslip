import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "ntp_session";
const PUBLIC = ["/login", "/api/auth/login", "/logo.png", "/icon.png"];

// ກວດແຕ່ວ່າມີ cookie ບໍ່ (Edge runtime ເຂົ້າຖານຂໍ້ມູນບໍ່ໄດ້) — ການກວດ session ແທ້ເຮັດໃນແຕ່ລະ route
function loginUrl(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return url;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const res =
    isPublic || req.cookies.has(SESSION_COOKIE)
      ? NextResponse.next()
      : pathname.startsWith("/api/")
        ? NextResponse.json({ error: "ກະລຸນາ login ກ່ອນ" }, { status: 401 })
        : NextResponse.redirect(loginUrl(req));

  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "same-origin");
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
