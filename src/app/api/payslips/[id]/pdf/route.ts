import { HttpError, requireUser, route } from "@/lib/auth";
import { getPayslip } from "@/lib/payslips";
import { generatePayslipPDF } from "@/lib/payslip-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (req, { params }) => {
  await requireUser(req);
  const p = await getPayslip((await params).id);
  if (!p) throw new HttpError(404, "ບໍ່ພົບໃບແຈ້ງເງິນເດືອນ");
  const pdf = await generatePayslipPDF({ ...p.data, row: p.rowNo });
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="payslip.pdf"',
      "Cache-Control": "no-store",
    },
  });
});
