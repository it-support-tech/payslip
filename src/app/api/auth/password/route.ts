import { NextResponse } from "next/server";
import { changePassword, HttpError, requireUser, route, setSessionCookie } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = route(async (req) => {
  const user = await requireUser(req, { allowMustChange: true });
  const { currentPassword, newPassword } = await req.json().catch(() => ({}));
  if (!currentPassword || !newPassword) throw new HttpError(400, "ກະລຸນາໃສ່ຂໍ້ມູນໃຫ້ຄົບ");
  const token = await changePassword(user, String(currentPassword), String(newPassword));
  const res = NextResponse.json({ ok: true });
  setSessionCookie(res, token);
  return res;
});
