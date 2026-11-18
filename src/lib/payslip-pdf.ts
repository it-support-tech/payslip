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
  text: "#000000",
  ...NTP_COLORS,
  ink: "#0f172a",
  body: "#334155",
  // muted: "#1c1d1e",
  muted: "#black",
  line: "#d4d4d8",
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

const FONT_OFFSET = -1;
const fontSize_ = (size: number) => size + FONT_OFFSET;
type TextOpts = { size?: number; bold?: boolean; align?: "left" | "right" | "center"; width?: number };

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
  doc.fontSize(fontSize_(opts.size ?? 10));
  return splitRuns(text).reduce((w, r) => w + doc.font(fontFor(r.lao, opts.bold)).widthOfString(r.text), 0);
}

function text(doc: Doc, value: string, x: number, y: number, opts: TextOpts = {}) {
  const size = fontSize_(opts.size ?? 10);
  const total = measure(doc, value, opts);
  let cx = x;
  if (opts.width && opts.align === "right") cx = x + opts.width - total;
  if (opts.width && opts.align === "center") cx = x + (opts.width - total) / 2;

  doc.fillColor(C.text).fontSize(size);
  for (const r of splitRuns(value)) {
    doc.font(fontFor(r.lao, opts.bold));
    doc.text(r.text, cx, y + (r.lao ? 0 : size * 0.05), { lineBreak: false });
    cx += doc.widthOfString(r.text);
  }
}

function latinBlock(doc: Doc, value: string, x: number, y: number, width: number, opts: TextOpts = {}) {
  doc.font(opts.bold ? "latinBold" : "latin").fontSize(fontSize_(opts.size ?? 8)).fillColor(C.text);
  doc.text(value, x, y, { width, lineGap: 0.5 });
  return doc.heightOfString(value, { width, lineGap: 0.5 });
}

export function generatePayslipPDF(emp: Employee): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A5",
      layout: "landscape",
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
    const M = 22;
    const LW = 196;
    const divX = M + LW + 13;
    const RX = divX + 13;
    const RW = W - M - RX;

    let y = M;
    const logo = 46;
    const tx = M + logo + 9;
    const tw = LW - logo - 9;
    if (fs.existsSync(LOGO_PATH)) doc.image(LOGO_PATH, M, y, { fit: [logo, logo] });
    let ty = y + 1;
    ty += latinBlock(doc, COMPANY.name, tx, ty, tw, { size: 8, bold: true }) + 3;
    for (const v of [
      COMPANY.address,
      COMPANY.tel && `Tel: ${COMPANY.tel}`,
      COMPANY.email && `Email: ${COMPANY.email}`,
    ]) {
      if (v) ty += latinBlock(doc, v, tx, ty, tw, { size: 6 }) + 1;
    }
    y = Math.max(y + logo, ty) + 3;
    y += 5;
    doc.moveTo(M, y).lineTo(M + LW, y).lineWidth(1).stroke(C.ink);
    const headerBottom = y;

    y += 9;
    const info: [string, string][] = [
      ["ລະຫັດພະນັກງານ", emp.employeeId || "-"],
      ["ຊື່ ແລະ ນາມສະກຸນ", emp.name || "-"],
      ["ຕຳແໜ່ງ", emp.position || "-"],
      ["ພະແນກ", emp.department || "-"],
      ["ເບີໂທລະສັບ", localPhone(emp.phone)],
      ["ຊື່ບັນຊີ", emp.bankAccountName || "-"],
      ["ເລກບັນຊີ", emp.bankAccount || "-"],
      ["ເລກບັດປະກັນສັງຄົມ", emp.socialSecurityNo || "-"],
    ];
    const work: [string, string][] = [
      ["ວັນເຮັດວຽກ/ເດືອນ", qty(emp.workDaysPerMonth, "ວັນ")],
      ["ວັນເຮັດວຽກຕົວຈິງ", qty(emp.actualWorkDays, "ວັນ")],
      ["ມາຊ້າ", qty(emp.lateMinutes, "ນາທີ")],
      ["ຂາດງານ", qty(emp.absentDays, "ວັນ")],
      ["ຈຳນວນຖ້ຽວ", qty(emp.trips, "ຖ້ຽວ")],
      ["ໄລຍະທາງ", qty(emp.distanceKm, "ກມ")],
    ];
    const gap = 8;
    const tableW = (RW - gap) / 2;
    const rows = Math.max(EARNINGS.length, DEDUCTIONS.length);
    const tRowH = 17;
    const top = headerBottom + 9;
    const th = 26 + rows * tRowH + 28;
    const ny = top + th + 10;
    const nh = 42;

    const pad = 10;
    const workH = Math.ceil(work.length / 2) * 22;
    const boxH = ny + nh - y;
    const rowH = (boxH - 40 - workH) / info.length;
    doc.roundedRect(M, y, LW, boxH, 8).fillAndStroke(C.blue50, C.blue100);
    doc.rect(M, y + 9, 3, 13).fill(C.blue600);
    text(doc, "ຂໍ້ມູນພະນັກງານ", M + pad, y + 8, { size: 9, bold: true });
    info.forEach(([label, value], i) => {
      const ry = y + 28 + i * rowH;
      if (i > 0) doc.moveTo(M + pad, ry - 2.5).lineTo(M + LW - pad, ry - 2.5).lineWidth(0.4).stroke(C.blue100);
      text(doc, label, M + pad, ry - 0.5, { size: 7.8, bold: true });
      text(doc, value, M + pad, ry - 0.5, { size: 7.8, bold: true, align: "right", width: LW - pad * 2 });
    });
    const wy = y + 26 + info.length * rowH + 6;
    doc.moveTo(M + pad, wy).lineTo(M + LW - pad, wy).lineWidth(0.8).stroke(C.blue100);
    const cw = (LW - pad * 2) / 2;
    work.forEach(([label, value], i) => {
      const wx = M + pad + (i % 2) * cw;
      const yy = wy + 5 + Math.floor(i / 2) * 22;
      text(doc, label, wx, yy, { size: 7.3, bold: true });
      text(doc, value, wx, yy + 9.5, { size: 7.8, bold: true });
    });

    const fy = H - M - 20;
    doc.moveTo(divX, M).lineTo(divX, fy).lineWidth(0.6).stroke(C.line);

    const drawTable = (x: number, title: string, items: [string, number][], totalLabel: string, total: number) => {
      doc.save().roundedRect(x, top, tableW, th, 8).clip();
      doc.rect(x, top, tableW, 24).fill(C.blue50);
      doc.rect(x, top + th - 28, tableW, 28).fill(C.blue50);
      doc.restore();
      doc.moveTo(x, top + 24).lineTo(x + tableW, top + 24).lineWidth(0.6).stroke(C.line);
      text(doc, title, x + 9, top + 6, { size: 8.8, bold: true });
      text(doc, `(${COMPANY.currency})`, x, top + 7, { size: 7, align: "right", width: tableW - 9 });
      items.forEach(([label, value], i) => {
        const ry = top + 26 + i * tRowH;
        if (i > 0) doc.moveTo(x + 9, ry).lineTo(x + tableW - 9, ry).lineWidth(0.4).stroke(C.line);
        text(doc, label, x + 9, ry + 5, { size: 7.3 });
        text(doc, amount(value), x, ry + 5, { size: 7.5, align: "right", width: tableW - 9 });
      });
      const ty = top + 26 + rows * tRowH;
      doc.moveTo(x, ty).lineTo(x + tableW, ty).lineWidth(0.6).stroke(C.line);
      text(doc, totalLabel, x + 9, ty + 7.5, { size: 8.8, bold: true });
      text(doc, money(total), x, ty + 7.5, { size: 8.8, bold: true, align: "right", width: tableW - 9 });
      doc.roundedRect(x, top, tableW, th, 8).lineWidth(0.8).stroke(C.line);
    };
    const pick = (list: [string, keyof Employee][]) =>
      list.map(([label, key]) => [label, Number(emp[key]) || 0] as [string, number]);
    const gy = (M + top) / 2 - (emp.month ? 23 : 10);
    text(doc, "ໃບແຈ້ງເງິນເດືອນ", RX, gy, { size: 16, bold: true, align: "center", width: RW });
    if (emp.month) {
      const lw = 28;
      const cx = RX + RW / 2;
      doc.moveTo(cx - lw / 2, gy + 25).lineTo(cx + lw / 2, gy + 25).lineWidth(1.5).stroke(C.blue600);
      text(doc, `ປະຈຳເດືອນ ${emp.month}`, RX, gy + 30, { size: 9.5, bold: true, align: "center", width: RW });
    }

    drawTable(RX, "ລາຍການຮັບ", pick(EARNINGS), "ລວມລາຍຮັບ", emp.totalEarnings);
    drawTable(RX + tableW + gap, "ລາຍການຫັກ", pick(DEDUCTIONS), "ລວມລາຍການຫັກ", emp.totalDeductions);

    doc.roundedRect(RX, ny, RW, nh, 10).lineWidth(0.8).fillAndStroke(C.blue50, C.blue100);
    text(doc, "ເງິນເດືອນສຸດທິທີ່ໄດ້ຮັບ", RX + 14, ny + 8, { size: 9.5, bold: true });
    text(doc, "ລວມລາຍຮັບ - ລວມລາຍການຫັກ", RX + 14, ny + 24, { size: 6.5 });
    const curW = measure(doc, COMPANY.currency, { size: 10, bold: true });
    text(doc, COMPANY.currency, RX, ny + 15, { size: 10, bold: true, align: "right", width: RW - 14 });
    text(doc, money(emp.netPay), RX, ny + 11, { size: 14, bold: true, align: "right", width: RW - 19 - curW });

    doc.moveTo(M, fy).lineTo(W - M, fy).lineWidth(0.6).stroke(C.line);
    text(doc, "ເອກະສານສະບັບນີ້ອອກໂດຍລະບົບອັດຕະໂນມັດ · ກະລຸນາຮັກສາຂໍ້ມູນນີ້ເປັນຄວາມລັບ", M, fy + 5, {
      size: 6.5,
      align: "center",
      width: W - M * 2,
    });
    text(doc, `ຫາກມີຂໍ້ສົງໄສ ກະລຸນາຕິດຕໍ່ພະແນກບຸກຄະລາກອນ · ວັນທີອອກເອກະສານ: ${today()}`, M, fy + 14, {
      size: 6.5,
      align: "center",
      width: W - M * 2,
    });

    doc.end();
  });
}
