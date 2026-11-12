import { encryptJson } from "./crypto";
import { query } from "./db";

export type AuditAction =
  | "login"
  | "login_failed"
  | "logout"
  | "password_changed"
  | "user_created"
  | "user_updated"
  | "password_reset"
  | "payslips_imported"
  | "payslips_sent"
  | "payslip_status_changed"
  | "period_deleted"
  | "settings_updated"
  | "report_downloaded"
  | "whatsapp_logout";

/** ບັນທຶກວ່າໃຜເຮັດຫຍັງ (ລາຍລະອຽດ encrypt ໄວ້). ຫ້າມໃຫ້ error ຂອງ audit ໄປທຳລາຍ request ຫຼັກ */
export async function audit(userId: string | null, action: AuditAction, detail?: Record<string, unknown>) {
  try {
    await query("INSERT INTO audit_logs (user_id, action, detail_enc) VALUES ($1, $2, $3)", [
      userId,
      action,
      detail ? encryptJson(detail) : null,
    ]);
  } catch (err) {
    console.error("[audit] failed", err);
  }
}
