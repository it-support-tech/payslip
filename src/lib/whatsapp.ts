import { EventEmitter } from "node:events";
import fs from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";
import { Client, LocalAuth, MessageMedia } from "whatsapp-web.js";
import { HttpError } from "./auth";

const CLIENT_ID = "hr-payslip";
const SESSION_DIR = path.join(process.cwd(), ".wwebjs_auth", `session-${CLIENT_ID}`);
const READY_TIMEOUT_MS = 120_000;

export type WAStatus = "idle" | "initializing" | "qr" | "authenticated" | "ready" | "disconnected" | "error";

export interface WAState {
  status: WAStatus;
  qr: string | null; 
  pairingCode: string | null;
  loading: number | null; 
  me: { name?: string; phone?: string } | null;
  error?: string;
}
 
class WhatsAppService extends EventEmitter {
  private client: Client | null = null;
  private initPromise: Promise<void> | null = null;
  state: WAState = { status: "idle", qr: null, pairingCode: null, loading: null, me: null };
  private readyTimer: NodeJS.Timeout | null = null;
  private loggingOut = false;

  constructor() {
    super();
    this.setMaxListeners(100);  
  }

  private setState(patch: Partial<WAState>) {
    this.state = { ...this.state, ...patch };
    this.emit("state", this.state);
  }

  init(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.setState({ status: "initializing", qr: null, pairingCode: null, loading: null, error: undefined });
    const client = new Client({
      authStrategy: new LocalAuth({ clientId: CLIENT_ID }),  
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
      puppeteer: {
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      },
    });
    this.client = client;

    client.on("qr", async (qr) => {
      const dataUrl = await QRCode.toDataURL(qr, { margin: 1, width: 300 });
      this.setState({ status: "qr", qr: dataUrl });
    });
    client.on("code", (code) => this.setState({ pairingCode: code }));
    client.on("loading_screen", (percent) => this.setState({ loading: Number(percent) }));
    client.on("authenticated", () => {
      this.setState({ status: "authenticated", qr: null, pairingCode: null });
      this.clearReadyTimer();
      this.readyTimer = setTimeout(() => {
        if (this.state.status === "authenticated") {
          this.setState({ status: "error", error: "ໂຫລດ WhatsApp ນານເກີນໄປ — ກົດ \"ລ້າງ session\" ແລ້ວສະແກນ QR ໃໝ່" });
        }
      }, READY_TIMEOUT_MS);
    });
    client.on("auth_failure", (msg) => this.setState({ status: "error", qr: null, error: `Auth failure: ${msg}` }));
    client.on("ready", () => {
      this.clearReadyTimer();
      const info = client.info;
      this.setState({
        status: "ready",
        qr: null,
        pairingCode: null,
        loading: null,
        error: undefined,
        me: { name: info?.pushname, phone: info?.wid?.user },
      });
    });
    client.on("disconnected", async (reason) => {
      if (this.loggingOut) return; // logout() ຈັດການເອງ
      this.setState({ status: "disconnected", qr: null, me: null, error: String(reason) });
      await this.destroy();
      setTimeout(() => this.init().catch(() => {}), 3000);
    });

    this.initPromise = clearProfileLocks()
      .then(() => client.initialize())
      .catch((err: Error) => {
        this.setState({ status: "error", error: err.message });
        this.initPromise = null;
        this.client = null;
        throw err;
      });
    return this.initPromise!;
  }

  private clearReadyTimer() {
    if (this.readyTimer) clearTimeout(this.readyTimer);
    this.readyTimer = null;
  }

  private async destroy() {
    this.clearReadyTimer();
    const c = this.client;
    this.client = null;
    this.initPromise = null;
    try {
      await c?.destroy();
    } catch {
    }
  }

  /** Logout ຈາກ WhatsApp + ລຶບ session ອອກໝົດ → ຂຶ້ນ QR ໃໝ່ທັນທີ */
  async logout() {
    this.loggingOut = true;
    try {
      await this.client?.logout();
    } catch {
    }
    try {
      await this.reset();
    } finally {
      this.loggingOut = false;
    }
  }

  async reset() {
    await this.destroy();
    await fs.rm(SESSION_DIR, { recursive: true, force: true });
    this.setState({ status: "idle", qr: null, pairingCode: null, loading: null, me: null, error: undefined });
    this.init().catch(() => {});
  }

  async requestPairingCode(phone: string): Promise<string> {
    if (!this.client || this.state.status !== "qr") throw new HttpError(409, "ກະລຸນາລໍຖ້າໃຫ້ QR Code ຂຶ້ນກ່ອນ");
    const code = await this.client.requestPairingCode(phone, true);
    this.setState({ pairingCode: code });
    return code;
  }

  isReady() {
    return this.state.status === "ready" && !!this.client;
  }

  async resolveChatId(phone: string): Promise<string | null> {
    if (!this.client) throw new HttpError(409, "WhatsApp ຍັງບໍ່ໄດ້ເຊື່ອມຕໍ່");
    const id = await this.client.getNumberId(phone);
    return id?._serialized ?? null;
  }

  async sendPdf(chatId: string, pdf: Buffer, filename: string, caption: string) {
    if (!this.client || !this.isReady()) throw new Error("WhatsApp ຍັງບໍ່ພ້ອມ");
    const media = new MessageMedia("application/pdf", pdf.toString("base64"), filename);
    await this.client.sendMessage(chatId, media, { caption, sendSeen: false });
  }
}

async function clearProfileLocks() {
  await Promise.all(
    ["SingletonLock", "SingletonSocket", "SingletonCookie"].map((f) =>
      fs.rm(path.join(SESSION_DIR, f), { force: true }),
    ),
  );
}

const g = globalThis as unknown as { __waService?: WhatsAppService };
export const whatsapp: WhatsAppService = g.__waService ?? (g.__waService = new WhatsAppService());
