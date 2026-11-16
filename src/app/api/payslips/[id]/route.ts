import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { HttpError, requireUser, route } from "@/lib/auth";
import { payslipJob } from "@/lib/payslip-job";
import { setDelivered } from "@/lib/payslips";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(req);
  const { id } = await params;
  const { delivered } = await req.json().catch(() => ({}));
  if (typeof delivered !== "boolean") throw new HttpError(400, "ຂໍ້ມູນບໍ່ຖືກຕ້ອງ");
  if (payslipJob.state.running && payslipJob.state.results.some((r) => r.id === id)) {
    throw new HttpError(409, "ໃບນີ້ຢູ່ໃນຄິວທີ່ກຳລັງສົ່ງ — ລໍຖ້າໃຫ້ສົ່ງສຳເລັດກ່ອນ");
  }
  if (!(await setDelivered(id, delivered, user.id))) throw new HttpError(409, "ປ່ຽນສະຖານະບໍ່ໄດ້ (ອາດກຳລັງສົ່ງຢູ່)");
  await audit(user.id, "payslip_status_changed", { payslipId: id, delivered });
  return NextResponse.json({ ok: true });
});
