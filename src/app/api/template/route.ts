import { requireUser, route } from "@/lib/auth";
import { buildTemplateWorkbook } from "@/lib/excel";

export const runtime = "nodejs";

export const GET = route(async (req) => {
  await requireUser(req);
  return new Response(new Uint8Array(buildTemplateWorkbook()), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="payslip-template.xlsx"',
    },
  });
});
