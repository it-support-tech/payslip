import { COMPANY } from "@/config";
import type { Employee } from "./payslip-fields";
import { formatMoney } from "./utils";

// ໃຊ້ໄດ້ທັງ server (ຕອນສົ່ງ) ແລະ ໜ້າເວັບ (preview) — ຫ້າມ import node module

export type MessageFields = Pick<Employee, "name" | "month" | "employeeId" | "position" | "department" | "netPay">;

export const MESSAGE_PLACEHOLDERS: { key: string; label: string; get: (e: MessageFields) => string }[] = [
  { key: "ຊື່", label: "ຊື່ພະນັກງານ", get: (e) => e.name },
  { key: "ເດືອນ", label: "ເດືອນ", get: (e) => e.month },
  { key: "ລະຫັດ", label: "ລະຫັດພະນັກງານ", get: (e) => e.employeeId },
  { key: "ຕຳແໜ່ງ", label: "ຕຳແໜ່ງ", get: (e) => e.position },
  { key: "ພະແນກ", label: "ພະແນກ", get: (e) => e.department },
  { key: "ເງິນສຸດທິ", label: "ເງິນສຸດທິ", get: (e) => `${formatMoney(e.netPay)} ${COMPANY.currency}` },
  { key: "ບໍລິສັດ", label: "ຊື່ບໍລິສັດ", get: () => COMPANY.name },
];

export const DEFAULT_MESSAGE_TEMPLATE = [
  "ສະບາຍດີ {ຊື່}",
  "",
  "HR {ບໍລິສັດ} ຂໍສົ່ງໃບແຈ້ງເງິນເດືອນ ປະຈຳເດືອນ {ເດືອນ} ໃຫ້ທ່ານ.",
  "",
  "ລາຍລະອຽດຢູ່ໃນໄຟລ໌ PDF ທີ່ແນບໄປ. ຫາກມີຂໍ້ສົງໄສ ກະລຸນາຕິດຕໍ່ HR.",
  "ຂອບໃຈ 🙏",
  "— {ບໍລິສັດ}",
].join("\n");

export const MAX_MESSAGE_LENGTH = 2000;

/** ແທນ {ຊື່}, {ເດືອນ}, ... ດ້ວຍຂໍ້ມູນຂອງພະນັກງານ (placeholder ທີ່ບໍ່ຮູ້ຈັກຈະປະໄວ້ຄືເກົ່າ) */
export function renderMessage(template: string, emp: MessageFields): string {
  const byKey = new Map(MESSAGE_PLACEHOLDERS.map((p) => [p.key, p.get]));
  return template.replace(/\{([^{}]+)\}/g, (m, key: string) => byKey.get(key.trim())?.(emp) ?? m);
}
