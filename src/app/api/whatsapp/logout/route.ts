import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { requireUser, route } from "@/lib/auth";
import { whatsapp } from "@/lib/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = route(async (req) => {
  const user = await requireUser(req);
  await whatsapp.logout();
  await audit(user.id, "whatsapp_logout");
  return NextResponse.json({ ok: true });
});
