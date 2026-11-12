import { audit } from "@/lib/audit";
import { HttpError, requireUser, route } from "@/lib/auth";
import { buildReportWorkbook, type ReportRow } from "@/lib/excel";
import { listPayslips } from "@/lib/payslips";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS_LABEL = { pending: "ຍັງບໍ່ໄດ້ສົ່ງ", sending: "ກຳລັງສົ່ງ", sent: "ສົ່ງແລ້ວ", failed: "ລົ້ມເຫຼວ" } as const;

/** GET ?period=10/2026&only=remaining — Excel ທີ່ອັບໂຫລດກັບມານຳເຂົ້າໄດ້ເລີຍ */
export const GET = route(async (req) => {
  const user = await requireUser(req);
  const url = new URL(req.url);
  const period = url.searchParams.get("period");
  const remainingOnly = url.searchParams.get("only") === "remaining";
  if (!period) throw new HttpError(400, "ກະລຸນາເລືອກງວດ");

  const rows: ReportRow[] = (await listPayslips(period))
    .filter((p) => !remainingOnly || p.status !== "sent")
    .map((p) => ({
      emp: { ...p.data, row: p.rowNo },
      status: STATUS_LABEL[p.status],
      note:
        p.status === "sent"
          ? `${new Date(p.sentAt!).toLocaleString("en-GB")}${p.sentBy ? ` · ${p.sentBy}` : ""}`
          : (p.error ?? ""),
    }));
  if (rows.length === 0) throw new HttpError(400, "ທຸກຄົນໄດ້ຮັບແລ້ວ — ບໍ່ມີລາຍຊື່ທີ່ເຫຼືອ");

  await audit(user.id, "report_downloaded", { period, remainingOnly, count: rows.length });
  const name = `${remainingOnly ? "payslip-remaining" : "payslip-report"}-${period.replace("/", "-")}.xlsx`;
  return new Response(new Uint8Array(buildReportWorkbook(rows)), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
});
