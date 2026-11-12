import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { requireUser, route } from "@/lib/auth";
import { whatsapp } from "@/lib/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = route(async (req) => {
  const user = await requireUser(req);
  await whatsapp.reset();
  await audit(user.id, "whatsapp_logout", { reset: true });
  return NextResponse.json({ ok: true });
});
