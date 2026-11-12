import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { clearSessionCookie, destroySession, getSessionUser, route } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = route(async () => {
  const user = await getSessionUser();
  await destroySession();
  if (user) await audit(user.id, "logout");
  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res);
  return res;
});
