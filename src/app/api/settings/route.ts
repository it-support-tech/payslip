import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { HttpError, requireUser, route } from "@/lib/auth";
import { DEFAULT_MESSAGE_TEMPLATE, MAX_MESSAGE_LENGTH } from "@/lib/message";
import { getMessageTemplate, saveMessageTemplate } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  await requireUser(req);
  return NextResponse.json({ messageTemplate: await getMessageTemplate(), defaultTemplate: DEFAULT_MESSAGE_TEMPLATE });
});

export const PUT = route(async (req) => {
  const user = await requireUser(req);
  const { messageTemplate } = await req.json().catch(() => ({}));
  const text = String(messageTemplate ?? "").trim();
  if (!text) throw new HttpError(400, "ຂໍ້ຄວາມຫ້າມຫວ່າງ");
  if (text.length > MAX_MESSAGE_LENGTH) throw new HttpError(400, `ຂໍ້ຄວາມຍາວເກີນ ${MAX_MESSAGE_LENGTH} ຕົວອັກສອນ`);
  await saveMessageTemplate(text, user.id);
  await audit(user.id, "settings_updated", { key: "message_template" });
  return NextResponse.json({ messageTemplate: text });
});
