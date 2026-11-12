import { NextResponse } from "next/server";
import { HttpError, login, route, setSessionCookie } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = route(async (req) => {
  const { username, password } = await req.json().catch(() => ({}));
  if (!username || !password) throw new HttpError(400, "ກະລຸນາໃສ່ຊື່ຜູ້ໃຊ້ ແລະ ລະຫັດຜ່ານ");
  const { token, user } = await login(String(username), String(password));
  const res = NextResponse.json({ user });
  setSessionCookie(res, token);
  return res;
});
