import { NextResponse } from "next/server";
import { HttpError, requireUser, route } from "@/lib/auth";
import { listPayslips } from "@/lib/payslips";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  await requireUser(req);
  const period = new URL(req.url).searchParams.get("period");
  if (!period) throw new HttpError(400, "ກະລຸນາເລືອກງວດ");
  return NextResponse.json({ payslips: await listPayslips(period) });
});
