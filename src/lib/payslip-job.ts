import { EventEmitter } from "node:events";
import { SEND_DELAY } from "@/config";
import { audit } from "./audit";
import { renderMessage } from "./message";
import { generatePayslipPDF } from "./payslip-pdf";
import { claimForSending, markFailed, markSent, recoverStuckSending, sendableIds } from "./payslips";
import { getMessageTemplate } from "./settings";
import { whatsapp } from "./whatsapp";

export type ResultStatus = "pending" | "sending" | "sent" | "failed" | "skipped";

export interface JobResult {
  id: string; // payslip id
  name: string;
  status: ResultStatus;
  error?: string;
}

export interface JobState {
  id: string | null;
  period: string | null;
  running: boolean;
  startedBy: string | null;
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  current: string | null;
  startedAt: number | null;
  finishedAt: number | null;
  results: JobResult[];
}

const emptyJob = (): JobState => ({
  id: null,
  period: null,
  running: false,
  startedBy: null,
  total: 0,
  sent: 0,
  failed: 0,
  skipped: 0,
  current: null,
  startedAt: null,
  finishedAt: null,
  results: [],
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const randomDelay = () => {
  const { minMs: min, maxMs: max } = SEND_DELAY;
  return Math.floor(min + Math.random() * Math.max(0, max - min));
};

class PayslipJobRunner extends EventEmitter {
  state: JobState = emptyJob();
  private cancelRequested = false;

  constructor() {
    super();
    this.setMaxListeners(100);
  }

  private emitState() {
    this.emit("state", this.state);
  }

  private update(index: number, patch: Partial<JobResult>) {
    const r = this.state.results[index];
    const prev = r.status;
    Object.assign(r, patch);
    if (patch.status && patch.status !== prev) {
      if (patch.status === "sent") this.state.sent++;
      if (patch.status === "failed") this.state.failed++;
      if (patch.status === "skipped") this.state.skipped++;
    }
    this.emitState();
  }

  cancel() {
    if (this.state.running) this.cancelRequested = true;
  }

  /**
   * ເລີ່ມສົ່ງໃບທີ່ຍັງບໍ່ໄດ້ສົ່ງ (pending / failed) ຂອງງວດນີ້ ໃນ background.
   * ໃບທີ່ສົ່ງແລ້ວຈະບໍ່ຖືກເລືອກ — ຢາກສົ່ງຊ້ຳ ຕ້ອງເອົາຕິກ "ສົ່ງແລ້ວ" ອອກກ່ອນ.
   */
  async start(period: string, user: { id: string; displayName: string }, ids?: string[]) {
    if (this.state.running) throw new Error("ກຳລັງສົ່ງຢູ່ ກະລຸນາລໍຖ້າໃຫ້ສຳເລັດກ່ອນ");
    if (!whatsapp.isReady()) throw new Error("WhatsApp ຍັງບໍ່ໄດ້ເຊື່ອມຕໍ່");

    await recoverStuckSending(); // ບໍ່ມີ job run ຢູ່ → 'sending' ທີ່ເຫຼືອແມ່ນຄ້າງ
    const targets = await sendableIds(period, ids);
    if (targets.length === 0) throw new Error("ບໍ່ມີໃບທີ່ຕ້ອງສົ່ງ — ທຸກຄົນໄດ້ຮັບແລ້ວ");

    this.cancelRequested = false;
    this.state = {
      ...emptyJob(),
      id: `job_${Date.now()}`,
      period,
      running: true,
      startedBy: user.displayName,
      total: targets.length,
      startedAt: Date.now(),
      results: targets.map((id) => ({ id, name: "", status: "pending" })),
    };
    this.emitState();
    void this.run(targets, user.id);
    return { jobId: this.state.id, total: targets.length };
  }

  private async run(ids: string[], userId: string) {
    // snapshot ຂໍ້ຄວາມຕອນເລີ່ມ — HR ແກ້ລະຫວ່າງສົ່ງ ຈະບໍ່ກະທົບຮອບນີ້
    const template = await getMessageTemplate();

    for (let i = 0; i < ids.length; i++) {
      if (this.cancelRequested) {
        for (let j = i; j < ids.length; j++) this.update(j, { status: "skipped", error: "ຍົກເລີກໂດຍຜູ້ໃຊ້" });
        break;
      }

      // ຈອງໃບນີ້ໃນຖານຂໍ້ມູນກ່ອນ: ຖ້າຄົນອື່ນສົ່ງ ຫຼື ຕິກ "ສົ່ງແລ້ວ" ໄປແລ້ວ ຈະຂ້າມ
      const emp = await claimForSending(ids[i]).catch(() => null);
      if (!emp) {
        this.update(i, { status: "skipped", error: "ສົ່ງແລ້ວ ຫຼື ຖືກປ່ຽນສະຖານະ" });
        continue;
      }
      this.state.current = emp.name;
      this.update(i, { name: emp.name, status: "sending" });

      try {
        const chatId = await whatsapp.resolveChatId(emp.phone);
        if (!chatId) throw new Error("ເບີນີ້ບໍ່ມີ WhatsApp");

        const pdf = await generatePayslipPDF({ ...emp, row: 0 });
        const safeName = emp.name.replace(/[\\/:*?"<>|]/g, "").trim() || emp.employeeId;
        const filename = `Payslip_${emp.month ? emp.month.replace(/\//g, "-") + "_" : ""}${safeName}.pdf`;
        await whatsapp.sendPdf(chatId, pdf, filename, renderMessage(template, emp));
        await markSent(ids[i], userId);
        this.update(i, { status: "sent" });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await markFailed(ids[i], message).catch(() => {});
        this.update(i, { status: "failed", error: message });
      }

      // Delay 4-5 ວິນາທີ ປ້ອງກັນ Spam Block (ບໍ່ຕ້ອງລໍຫຼັງຄົນສຸດທ້າຍ)
      if (i < ids.length - 1 && !this.cancelRequested) await sleep(randomDelay());
    }

    this.state.running = false;
    this.state.current = null;
    this.state.finishedAt = Date.now();
    this.emitState();
    await audit(userId, "payslips_sent", {
      period: this.state.period,
      sent: this.state.sent,
      failed: this.state.failed,
      skipped: this.state.skipped,
    });
  }
}

const g = globalThis as unknown as { __payslipJob?: PayslipJobRunner };
export const payslipJob: PayslipJobRunner = g.__payslipJob ?? (g.__payslipJob = new PayslipJobRunner());
