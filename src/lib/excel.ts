import * as XLSX from "xlsx";
import { COLUMNS, type Employee, type NumberKey, type TextKey } from "./payslip-fields";

export type { Employee } from "./payslip-fields";

const normalizeKey = (s: string) =>
  String(s)
    .toLowerCase()
    .replace(/ໍາ/g, "ຳ")
    .replace(/ີ/g, "ິ")
    .replace(/ຫນ/g, "ໜ")
    .replace(/ຫມ/g, "ໝ")
    .replace(/[\s_\-.:()]/g, "");

const toNumber = (v: unknown): number => {
  if (typeof v === "number") return v;
  if (v == null || v === "") return 0;
  const n = Number(String(v).replace(/[^\d.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const toText = (v: unknown): string => {
  if (typeof v === "number") return Number.isInteger(v) ? v.toFixed(0) : String(v);
  return String(v ?? "").trim();
};

export function normalizePeriod(raw: string): string {
  const s = String(raw ?? "").trim();
  let m = s.match(/^(\d{1,2})[\/\-.](\d{4})$/);
  if (m) return `${m[1].padStart(2, "0")}/${m[2]}`;
  m = s.match(/^(\d{4})[\/\-.](\d{1,2})$/);
  if (m) return `${m[2].padStart(2, "0")}/${m[1]}`;
  m = s.match(/^([A-Za-z]{3,})[\s\-\/.,]*(\d{2}|\d{4})$/);
  if (m) {
    const month = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1;
    const year = m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2]);
    if (month) return `${String(month).padStart(2, "0")}/${year}`;
  }
  return s;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function monthCell(raw: unknown, text: string): string {
  if (typeof raw === "number" && raw > 20000 && raw < 80000) {
    const d = XLSX.SSF.parse_date_code(raw);
    if (d) return `${String(d.m).padStart(2, "0")}/${d.y}`;
  }
  return normalizePeriod(text);
}

export function normalizePhone(raw: string, defaultCountry = "856"): string {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith(defaultCountry)) return d;
  if (d.startsWith("0")) return defaultCountry + d.slice(1);
  if (/^(20|30)\d{7,8}$/.test(d)) return defaultCountry + d;
  return d;
}

export function parseEmployeesFromExcel(buffer: ArrayBuffer | Buffer): Employee[] {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetName = wb.SheetNames.find((n) => n.trim().toLowerCase() === "template") ?? wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  if (!sheet) throw new Error("ບໍ່ພົບ Sheet ໃນໄຟລ໌ Excel");

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: true });
  if (rows.length === 0) throw new Error(`Sheet "${sheetName}" ບໍ່ມີຂໍ້ມູນ`);

  const headers = Object.keys(rows[0]);
  const columnOf = new Map<string, string>();
  const missing: string[] = [];
  for (const c of COLUMNS) {
    const found = headers.find((h) => normalizeKey(h) === normalizeKey(c.header));
    if (found) columnOf.set(c.key, found);
    else if (c.key !== "month") missing.push(c.header.replace(/\n/g, " "));
  }
  if (missing.length) {
    throw new Error(`ໄຟລ໌ບໍ່ກົງກັບ Template — ບໍ່ພົບຖັນ: ${missing.join(", ")}`);
  }

  const parsed = rows.map((r, i) => {
    const cell = (k: string) => r[columnOf.get(k) ?? ""];
    const text = Object.fromEntries(
      COLUMNS.filter((c) => c.type === "text").map((c) => [c.key, toText(cell(c.key))]),
    ) as Record<TextKey, string>;
    const nums = Object.fromEntries(
      COLUMNS.filter((c) => c.type === "number").map((c) => [c.key, toNumber(cell(c.key))]),
    ) as Record<NumberKey, number>;

    const emp: Employee = {
      row: i + 2,
      ...text,
      ...nums,
      phone: normalizePhone(text.phone),
      month: columnOf.has("month") ? monthCell(cell("month"), text.month) : "",
    };
    const blank = (k: string) => cell(k) === "" || cell(k) == null;
    if (!emp.name) emp.error = "ບໍ່ມີຊື່";
    else if (blank("netPay")) emp.error = "ບໍ່ມີຍອດ ລວມຮັບສຸດທິ";
    else if (emp.month && !/^\d{2}\/\d{4}$/.test(emp.month)) emp.error = `ເດືອນ "${emp.month}" ບໍ່ຖືກຕ້ອງ (ໃຊ້ MM/YYYY)`;
    else if (emp.phone.length < 10) emp.error = "ເບີໂທບໍ່ຖືກຕ້ອງ";
    return emp;
  });

  return parsed
    .filter((e) => e.name || e.phone || e.employeeId)
    .map((e, _, all) => {
      if (!e.error && e.employeeId && all.filter((o) => o.employeeId === e.employeeId && o.month === e.month).length > 1) {
        e.error = "ລະຫັດພະນັກງານຊ້ຳໃນໄຟລ໌";
      }
      return e;
    });
}

function buildSheet(records: Partial<Employee>[], extra: { header: string; values: string[]; width: number }[] = []) {
  const header = [...COLUMNS.map((c) => c.header), ...extra.map((x) => x.header)];
  const body = records.map((e, i) => [
    ...COLUMNS.map((c) => {
      const v = e[c.key];
      return c.type === "number" ? (v as number) || "" : (v ?? "");
    }),
    ...extra.map((x) => x.values[i] ?? ""),
  ]);
  const ws = XLSX.utils.aoa_to_sheet([header, ...body]);
  ws["!cols"] = [...COLUMNS.map((c) => ({ wch: c.width ?? 16 })), ...extra.map((x) => ({ wch: x.width }))];
  ws["!rows"] = [{ hpt: 36 }];
  for (let r = 1; r <= body.length; r++) {
    COLUMNS.forEach((c, ci) => {
      const cell = ws[XLSX.utils.encode_cell({ r, c: ci })];
      if (cell && c.type === "number" && typeof cell.v === "number") cell.z = "#,##0";
      if (cell && c.type === "text") cell.t = "s";
    });
  }
  return ws;
}

const localPhone = (p: string) => (p.startsWith("856") ? `0${p.slice(3)}` : p);

export function buildTemplateWorkbook(): Buffer {
  const sample: Partial<Employee> = {
    employeeId: "NTP/0001",
    name: "ນ. ມະນີວອນ",
    position: "ບັນຊີ",
    department: "Accounting",
    bankAccount: "030120001589782",
    bankAccountName: "Manivone MS",
    phone: "02099995555",
    socialSecurityNo: "123456A",
    baseSalary: 3000000,
    lateMinutes: 25,
    workDaysPerMonth: 22,
    actualWorkDays: 22,
    lateDeduction: 7102,
    positionPay: 300000,
    mealHolidayPay: 100000,
    economicRelief: 1000000,
    provincialPay: 250000,
    totalEarnings: 4650000,
    tax: 150000,
    socialSecurity: 165000,
    totalDeductions: 322102,
    netPay: 4327898,
    month: "10/2026",
  };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildSheet([sample]), "Template");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export interface ReportRow {
  emp: Employee;
  status: string;
  note: string;
}

export function buildReportWorkbook(rows: ReportRow[]): Buffer {
  const ws = buildSheet(
    rows.map((r) => ({ ...r.emp, phone: localPhone(r.emp.phone) })),
    [
      { header: "ສະຖານະ", values: rows.map((r) => r.status), width: 14 },
      { header: "ໝາຍເຫດ", values: rows.map((r) => r.note), width: 40 },
    ],
  );
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Template");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
