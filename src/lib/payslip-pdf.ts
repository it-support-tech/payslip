import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import { COMPANY, NTP_COLORS } from "@/config";
import { DEDUCTIONS, EARNINGS, type Employee } from "./payslip-fields";

const FONT_DIR = path.join(process.cwd(), "assets", "fonts");
const FONTS = {
  lao: path.join(FONT_DIR, "NotoSansLao-Regular.ttf"),
  laoBold: path.join(FONT_DIR, "NotoSansLao-Bold.ttf"),
  latin: path.join(FONT_DIR, "NotoSans-Regular.ttf"),
  latinBold: path.join(FONT_DIR, "NotoSans-Bold.ttf"),
};
const LOGO_PATH = path.join(process.cwd(), COMPANY.logo);

const C = {
  ...NTP_COLORS,
  ink: "#0f172a",
  body: "#334155",
  muted: "#64748b",
  line: "#dbe4ee",
  white: "#ffffff",
};

const money = (n: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n || 0);
const amount = (n: number | undefined) => (Math.round(n || 0) === 0 ? "-" : money(n!));
const qty = (n: number | undefined, unit: string) => (n ? `${n.toLocaleString("en-US")} ${unit}` : "-");
const localPhone = (p: string) => (p?.startsWith("856") ? `0${p.slice(3)}` : p || "-");
const today = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

type Doc = PDFKit.PDFDocument;
type TextOpts = { size?: number; bold?: boolean; color?: string; align?: "left" | "right" | "center"; width?: number };

function splitRuns(text: string): { lao: boolean; text: string }[] {
  const runs: { lao: boolean; text: string }[] = [];
  for (const ch of text) {
    const isLao = /[຀-໿]/.test(ch);
    const isSpace = /\s/.test(ch);
    const last = runs[runs.length - 1];
    if (last && (isSpace || last.lao === isLao)) last.text += ch;
    else runs.push({ lao: isLao, text: ch });
  }
  return runs;
}

function fontFor(lao: boolean, bold?: boolean) {
  if (lao) return bold ? "laoBold" : "lao";
  return bold ? "latinBold" : "latin";
}

function measure(doc: Doc, text: string, opts: TextOpts = {}) {
  doc.fontSize(opts.size ?? 10);
  return splitRuns(text).reduce((w, r) => w + doc.font(fontFor(r.lao, opts.bold)).widthOfString(r.text), 0);
}

function text(doc: Doc, value: string, x: number, y: number, opts: TextOpts = {}) {
  const size = opts.size ?? 10;
  const total = measure(doc, value, opts);
  let cx = x;
  if (opts.width && opts.align === "right") cx = x + opts.width - total;
  if (opts.width && opts.align === "center") cx = x + (opts.width - total) / 2;

  doc.fillColor(opts.color ?? C.ink).fontSize(size);
  for (const r of splitRuns(value)) {
    doc.font(fontFor(r.lao, opts.bold));
    doc.text(r.text, cx, y + (r.lao ? 0 : size * 0.05), { lineBreak: false });
    cx += doc.widthOfString(r.text);
  }
}

const flame = (doc: Doc, x: number, y: number, w: number) =>
  doc.linearGradient(x, y, x + w, y).stop(0, C.flameRed).stop(0.45, C.flameOrange).stop(1, C.flameYellow);

export function generatePayslipPDF(emp: Employee): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 0,
      info: { Title: `ໃບແຈ້ງເງິນເດືອນ ${emp.name} ${emp.month}`, Author: COMPANY.name },
    });
    for (const [key, file] of Object.entries(FONTS)) doc.registerFont(key, file);

    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width;
    const H = doc.page.height;
    const M = 36;
    const inner = W - M * 2;

    doc.rect(0, 0, W, 96).fill(doc.linearGradient(0, 0, W, 96).stop(0, C.blue950).stop(1, C.blue600));
    doc.rect(0, 96, W, 4).fill(flame(doc, 0, 96, W));
    if (fs.existsSync(LOGO_PATH)) doc.image(LOGO_PATH, M, 16, { fit: [64, 64] });
    text(doc, COMPANY.name, M + 78, 28, { size: 14, bold: true, color: C.white });
    text(doc, COMPANY.address, M + 78, 52, { size: 9, color: C.blue100 });

    let y = 118;
    text(doc, "ໃບແຈ້ງເງິນເດືອນພະນັກງານ", M, y, { size: 18, bold: true, color: C.blue900 });
    if (emp.month) {
      const label = `ປະຈຳເດືອນ ${emp.month}`;
      const w = measure(doc, label, { size: 10.5, bold: true }) + 28;
      doc.roundedRect(W - M - w, y + 1, w, 26, 13).fill(flame(doc, W - M - w, y, w));
      text(doc, label, W - M - w, y + 6, { size: 10.5, bold: true, color: C.white, align: "center", width: w });
    }

    y += 42;
    const left: [string, string][] = [
      ["ລະຫັດພະນັກງານ", emp.employeeId || "-"],
      ["ຊື່ ແລະ ນາມສະກຸນ", emp.name || "-"],
      ["ຕຳແໜ່ງ", emp.position || "-"],
      ["ພະແນກ", emp.department || "-"],
      ["ເບີໂທລະສັບ", localPhone(emp.phone)],
      ["ຊື່ບັນຊີ", emp.bankAccountName || "-"],
      ["ເລກບັນຊີ", emp.bankAccount || "-"],
      ["ເລກບັດປະກັນສັງຄົມ", emp.socialSecurityNo || "-"],
    ];
    const right: [string, string][] = [
      ["ອັດຕາເງິນເດືອນພື້ນຖານ", amount(emp.baseSalary)],
      ["ເງິນອຸດໜູນຄ່າຄອງຊີບ", amount(emp.livingAllowance)],
      ["ຈຳນວນວັນເຮັດວຽກຕໍ່ເດືອນ", qty(emp.workDaysPerMonth, "ວັນ")],
      ["ຈຳນວນວັນເຮັດວຽກຕົວຈິງ", qty(emp.actualWorkDays, "ວັນ")],
      ["ມາຊ້າ", qty(emp.lateMinutes, "ນາທີ")],
      ["ຂາດງານ", qty(emp.absentDays, "ວັນ")],
      ["ຈຳນວນຖ້ຽວ", qty(emp.trips, "ຖ້ຽວ")],
      ["ຈຳນວນກິໂລແມັດ", qty(emp.distanceKm, "ກມ")],
    ];
    const infoRowH = 18;
    const infoH = 34 + left.length * infoRowH + 8;
    doc.roundedRect(M, y, inner, infoH, 10).fillAndStroke(C.blue50, C.blue100);
    doc.rect(M, y + 12, 4, 18).fill(C.blue600);
    text(doc, "ຂໍ້ມູນພະນັກງານ", M + 16, y + 11, { size: 11, bold: true, color: C.blue900 });
    const gap = 16;
    const colW = (inner - 32 - gap) / 2;
    [left, right].forEach((items, col) => {
      const cx = M + 16 + col * (colW + gap);
      items.forEach(([label, value], i) => {
        const ry = y + 36 + i * infoRowH;
        if (i > 0) doc.moveTo(cx, ry - 3).lineTo(cx + colW, ry - 3).lineWidth(0.4).stroke(C.blue100);
        text(doc, label, cx, ry, { size: 8.5, color: C.muted });
        text(doc, value, cx, ry - 0.5, { size: 9.5, bold: true, color: C.ink, align: "right", width: colW });
      });
    });

    y += infoH + 16;
    const tableW = (inner - gap) / 2;
    const rows = Math.max(EARNINGS.length, DEDUCTIONS.length);
    const rowH = 21;

    const drawTable = (
      x: number,
      title: string,
      items: [string, number][],
      totalLabel: string,
      total: number,
      head: PDFKit.Mixins.ColorValue,
      accent: string,
    ) => {
      const h = 32 + rows * rowH + 34;
      doc.roundedRect(x, y, tableW, h, 10).lineWidth(1).stroke(C.line);
      doc.save().roundedRect(x, y, tableW, 30, 10).clip().rect(x, y, tableW, 30).fill(head).restore();
      text(doc, title, x + 12, y + 7, { size: 11, bold: true, color: C.white });
      text(doc, `ຈຳນວນ (${COMPANY.currency})`, x, y + 9, { size: 8.5, color: C.white, align: "right", width: tableW - 12 });
      items.forEach(([label, value], i) => {
        const ry = y + 32 + i * rowH;
        if (i > 0) doc.moveTo(x + 12, ry).lineTo(x + tableW - 12, ry).lineWidth(0.5).stroke(C.line);
        const zero = Math.round(value || 0) === 0;
        text(doc, label, x + 12, ry + 5, { size: 9, color: zero ? C.muted : C.body });
        text(doc, amount(value), x, ry + 5, { size: 9, color: zero ? C.muted : C.ink, align: "right", width: tableW - 12 });
      });
      const ty = y + 32 + rows * rowH;
      doc.save().roundedRect(x, ty, tableW, 34, 10).clip().rect(x, ty, tableW, 34).fill(C.blue50).restore();
      doc.moveTo(x, ty).lineTo(x + tableW, ty).lineWidth(0.8).stroke(C.line);
      text(doc, totalLabel, x + 12, ty + 9, { size: 10, bold: true, color: C.ink });
      text(doc, money(total), x, ty + 9, { size: 10.5, bold: true, color: accent, align: "right", width: tableW - 12 });
      return h;
    };

    const pick = (list: [string, keyof Employee][]) =>
      list.map(([label, key]) => [label, Number(emp[key]) || 0] as [string, number]);
    const blueHead = doc.linearGradient(M, y, M + tableW, y).stop(0, C.blue700).stop(1, C.blue500);
    const h = drawTable(M, "ລາຍການຮັບ", pick(EARNINGS), "ລວມລາຍຮັບ", emp.totalEarnings, blueHead, C.blue600);
    drawTable(
      M + tableW + gap,
      "ລາຍການຫັກ",
      pick(DEDUCTIONS),
      "ລວມລາຍການຫັກ",
      emp.totalDeductions,
      flame(doc, M + tableW + gap, y, tableW),
      C.flameRed,
    );

    y += h + 18;
    doc.roundedRect(M, y, inner, 70, 12).fill(doc.linearGradient(M, y, W - M, y).stop(0, C.blue950).stop(1, C.blue600));
    doc.save().roundedRect(M, y, inner, 70, 12).clip().rect(M, y + 66, inner, 4).fill(flame(doc, M, y, inner)).restore();
    text(doc, "ເງິນເດືອນສຸດທິທີ່ໄດ້ຮັບ", M + 20, y + 16, { size: 12, bold: true, color: C.white });
    text(doc, "ລວມລາຍຮັບ - ລວມລາຍການຫັກ", M + 20, y + 38, { size: 8.5, color: C.blue100 });
    const net = money(emp.netPay);
    const curW = measure(doc, COMPANY.currency, { size: 12, bold: true });
    text(doc, COMPANY.currency, M, y + 28, { size: 12, bold: true, color: C.flameYellow, align: "right", width: inner - 20 });
    text(doc, net, M, y + 15, { size: 24, bold: true, color: C.white, align: "right", width: inner - 28 - curW });

    text(doc, `ວັນທີອອກເອກະສານ: ${today()}`, M, y + 82, { size: 8.5, color: C.muted, align: "right", width: inner });

    const fy = H - 46;
    doc.rect(0, fy, W, 46).fill(C.blue50);
    doc.rect(0, fy, W, 3).fill(flame(doc, 0, fy, W));
    text(doc, "ເອກະສານສະບັບນີ້ອອກໂດຍລະບົບອັດຕະໂນມັດ · ກະລຸນາຮັກສາຂໍ້ມູນນີ້ເປັນຄວາມລັບ", M, fy + 11, {
      size: 8.5,
      color: C.body,
      align: "center",
      width: inner,
    });
    text(doc, `ຫາກມີຂໍ້ສົງໄສ ກະລຸນາຕິດຕໍ່ພະແນກບຸກຄະລາກອນ · ${COMPANY.name}`, M, fy + 26, {
      size: 8,
      color: C.muted,
      align: "center",
      width: inner,
    });

    doc.end();
  });
}
