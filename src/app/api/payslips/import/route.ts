import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { HttpError, requireUser, route } from "@/lib/auth";
import { normalizePeriod, parseEmployeesFromExcel } from "@/lib/excel";
import { importPayslips, previewImport } from "@/lib/payslips";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * POST multipart/form-data
 *  - file:   ໄຟລ໌ .xlsx
 *  - period: ງວດ (MM/YYYY) ສຳລັບແຖວທີ່ບໍ່ມີຖັນເດືອນ
 *  - commit: "1" = ບັນທຶກລົງຖານຂໍ້ມູນ; ບໍ່ສົ່ງ = ກວດເບິ່ງກ່ອນ (preview)
 */
export const POST = route(async (req) => {
  const user = await requireUser(req);
  const form = await req.formData();
  const file = form.get("file");
  const period = normalizePeriod(String(form.get("period") ?? ""));

  if (!(file instanceof File)) throw new HttpError(400, "ກະລຸນາເລືອກໄຟລ໌ Excel");
  if (!/\.xlsx?$/i.test(file.name)) throw new HttpError(400, "ຮອງຮັບສະເພາະໄຟລ໌ .xlsx / .xls");
  if (file.size > MAX_SIZE) throw new HttpError(400, "ໄຟລ໌ໃຫຍ່ເກີນ 10MB");

  let employees;
  try {
    employees = parseEmployeesFromExcel(Buffer.from(await file.arrayBuffer()));
  } catch (err) {
    throw new HttpError(400, err instanceof Error ? err.message : "ອ່ານໄຟລ໌ບໍ່ໄດ້");
  }
  const rows = await previewImport(employees, period);

  if (form.get("commit") !== "1") return NextResponse.json({ rows });

  const result = await importPayslips(rows, user.id);
  await audit(user.id, "payslips_imported", { ...result, file: file.name });
  const count = (a: string) => rows.filter((r) => r.action === a).length;
  return NextResponse.json({
    ...result,
    periods: result.periods.length ? result.periods : [...new Set(rows.map((r) => r.period).filter(Boolean))],
    unchanged: count("unchanged"),
    locked: count("locked"),
    problems: rows
      .filter((r) => r.action === "error")
      .map((r) => ({ row: r.row, name: r.data.name, reason: r.reason ?? "" })),
  });
});
