import { HttpError, requireUser } from "@/lib/auth";
import { payslipJob, type JobState } from "@/lib/payslip-job";
import { whatsapp, type WAState } from "@/lib/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Server-Sent Events: ສົ່ງສະຖານະ WhatsApp (QR / Connected) ແລະ progress ການສົ່ງແບບ real-time */
export async function GET(req: Request) {
  try {
    await requireUser(req);
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 401;
    return new Response("unauthorized", { status });
  }
  // ເລີ່ມ WhatsApp client ຄັ້ງທຳອິດທີ່ມີຄົນເປີດ Dashboard
  whatsapp.init().catch(() => {});

  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          cleanup();
        }
      };
      const onWa = (s: WAState) => send("wa", s);
      const onJob = (s: JobState) => send("job", s);

      whatsapp.on("state", onWa);
      payslipJob.on("state", onJob);
      const ping = setInterval(() => send("ping", Date.now()), 25_000);

      send("wa", whatsapp.state);
      send("job", payslipJob.state);

      cleanup = () => {
        clearInterval(ping);
        whatsapp.off("state", onWa);
        payslipJob.off("state", onJob);
      };
      req.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {
          /* closed */
        }
      });
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
