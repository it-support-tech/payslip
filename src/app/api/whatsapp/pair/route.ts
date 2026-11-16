import { NextResponse } from "next/server";
import { HttpError, requireUser, route } from "@/lib/auth";
import { normalizePhone } from "@/lib/excel";
import { whatsapp } from "@/lib/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = route(async (req) => {
  await requireUser(req);
  const { phone } = await req.json().catch(() => ({}));
  const number = normalizePhone(String(phone ?? ""));
  if (number.length < 10) throw new HttpError(400, "ເບີໂທບໍ່ຖືກຕ້ອງ");
  try {
    return NextResponse.json({ code: await whatsapp.requestPairingCode(number) });
  } catch (err) {
    if (err instanceof HttpError) throw err;
    console.error(err);
    throw new HttpError(400, "ຂໍລະຫັດບໍ່ສຳເລັດ — ກະລຸນາລອງໃໝ່");
  }
});
