import { NextResponse } from "next/server";
import { HttpError, requireUser, route } from "@/lib/auth";
import { payslipJob } from "@/lib/payslip-job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = route(async (req) => {
  const user = await requireUser(req);
  const { period, ids } = await req.json().catch(() => ({}));
  if (!period) throw new HttpError(400, "ກະລຸນາເລືອກງວດ");
  const list = Array.isArray(ids) && ids.length ? ids.map(String) : undefined;
  try {
    return NextResponse.json(await payslipJob.start(String(period), user, list), { status: 202 });
  } catch (err) {
    throw new HttpError(400, err instanceof Error ? err.message : "ເລີ່ມສົ່ງບໍ່ໄດ້");
  }
});

export const DELETE = route(async (req) => {
  await requireUser(req);
  payslipJob.cancel();
  return NextResponse.json({ ok: true });
});
