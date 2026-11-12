import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { HttpError, requireUser, route } from "@/lib/auth";
import { payslipJob } from "@/lib/payslip-job";
import { deletePeriod, listPeriods } from "@/lib/payslips";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  await requireUser(req);
  return NextResponse.json({ periods: await listPeriods() });
});

/** ລຶບທັງງວດ (ເຊັ່ນ ນຳເຂົ້າໄຟລ໌ຜິດ) — ສະເພາະ admin */
export const DELETE = route(async (req) => {
  const admin = await requireUser(req, { role: "admin" });
  const period = new URL(req.url).searchParams.get("period");
  if (!period) throw new HttpError(400, "ກະລຸນາເລືອກງວດ");
  if (payslipJob.state.running && payslipJob.state.period === period) {
    throw new HttpError(409, "ງວດນີ້ກຳລັງສົ່ງຢູ່");
  }
  const deleted = await deletePeriod(period);
  await audit(admin.id, "period_deleted", { period, deleted });
  return NextResponse.json({ deleted });
});
