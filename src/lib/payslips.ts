import { blindIndex, decryptJson, encryptJson } from "./crypto";
import { query, transaction } from "./db";
import { normalizePeriod, type Employee } from "./excel";

export type PayslipStatus = "pending" | "sending" | "sent" | "failed";

export type PayslipData = Omit<Employee, "row" | "error">;

export interface PayslipView {
  id: string;
  period: string;
  rowNo: number;
  status: PayslipStatus;
  error: string | null;
  attempts: number;
  sentAt: string | null;
  sentBy: string | null;
  data: PayslipData;
}

interface PayslipRow {
  id: string;
  period: string;
  row_no: number;
  status: PayslipStatus;
  error: string | null;
  attempts: number;
  sent_at: Date | null;
  sent_by_name: string | null;
  data_enc: string;
}

const toView = (r: PayslipRow): PayslipView => ({
  id: r.id,
  period: r.period,
  rowNo: r.row_no,
  status: r.status,
  error: r.error,
  attempts: r.attempts,
  sentAt: r.sent_at?.toISOString() ?? null,
  sentBy: r.sent_by_name,
  data: decryptJson<PayslipData>(r.data_enc),
});

const toData = (e: Employee): PayslipData => {
  const { row, error, ...data } = e;
  void row;
  void error;
  return data;
};

const identity = (period: string, e: Pick<Employee, "employeeId" | "phone">) =>
  blindIndex(`${period}|${e.employeeId.trim().toUpperCase() || `tel:${e.phone}`}`);

export type ImportAction = "new" | "update" | "unchanged" | "locked" | "error";

export interface ImportPreviewRow {
  row: number;
  period: string;
  action: ImportAction;
  reason?: string;
  data: PayslipData;
}

export async function previewImport(employees: Employee[], defaultPeriod: string): Promise<ImportPreviewRow[]> {
  const fallback = normalizePeriod(defaultPeriod);
  const withPeriod = employees.map((e) => ({ e, period: e.month || fallback }));
  const hashes = withPeriod.filter(({ e, period }) => !e.error && period).map(({ e, period }) => identity(period, e));
  const existing = new Map(
    (
      await query<{ identity_hash: string; status: PayslipStatus; data_enc: string }>(
        "SELECT identity_hash, status, data_enc FROM payslips WHERE identity_hash = ANY($1)",
        [hashes],
      )
    ).map((r) => [r.identity_hash, r]),
  );

  return withPeriod.map(({ e, period }) => {
    const data = { ...toData(e), month: period };
    if (e.error) return { row: e.row, period, action: "error", reason: e.error, data };
    if (!period) return { row: e.row, period, action: "error", reason: "ບໍ່ມີງວດເດືອນ", data };
    const old = existing.get(identity(period, e));
    if (!old) return { row: e.row, period, action: "new", data };
    if (old.status === "sent") return { row: e.row, period, action: "locked", reason: "ສົ່ງແລ້ວ — ບໍ່ປ່ຽນຂໍ້ມູນ", data };
    if (old.status === "sending") return { row: e.row, period, action: "locked", reason: "ກຳລັງສົ່ງຢູ່", data };
    const same = JSON.stringify(decryptJson(old.data_enc)) === JSON.stringify(data);
    return { row: e.row, period, action: same ? "unchanged" : "update", data };
  });
}

export async function importPayslips(rows: ImportPreviewRow[], userId: string) {
  const writable = rows.filter((r) => r.action === "new" || r.action === "update");
  let inserted = 0;
  let updated = 0;
  await transaction(async (c) => {
    for (const r of writable) {
      const res = await c.query<{ inserted: boolean }>(
        `INSERT INTO payslips (period, identity_hash, row_no, data_enc, imported_by)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (identity_hash) DO UPDATE
           SET data_enc = EXCLUDED.data_enc, row_no = EXCLUDED.row_no, imported_by = EXCLUDED.imported_by,
               status = 'pending', error = NULL, updated_at = now()
           WHERE payslips.status IN ('pending', 'failed')
         RETURNING (xmax = 0) AS inserted`,
        [r.period, identity(r.period, r.data), r.row, encryptJson(r.data), userId],
      );
      if (res.rows[0]?.inserted) inserted++;
      else if (res.rows[0]) updated++;
    }
  });
  return { inserted, updated, periods: [...new Set(writable.map((r) => r.period))] };
}

const SELECT_VIEW = `
  SELECT p.id, p.period, p.row_no, p.status, p.error, p.attempts, p.sent_at, p.data_enc,
         u.display_name AS sent_by_name
  FROM payslips p LEFT JOIN users u ON u.id = p.sent_by`;

export async function listPayslips(period: string): Promise<PayslipView[]> {
  return (await query<PayslipRow>(`${SELECT_VIEW} WHERE p.period = $1 ORDER BY p.row_no`, [period])).map(toView);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getPayslip(id: string): Promise<PayslipView | null> {
  if (!UUID.test(id)) return null;
  const [r] = await query<PayslipRow>(`${SELECT_VIEW} WHERE p.id = $1`, [id]);
  return r ? toView(r) : null;
}

export interface PeriodSummary {
  period: string;
  total: number;
  sent: number;
  failed: number;
  pending: number;
  lastActivity: string;
}

const periodSortKey = (p: string) => {
  const m = p.match(/^(\d{2})\/(\d{4})$/);
  return m ? `${m[2]}-${m[1]}` : p;
};

export async function listPeriods(): Promise<PeriodSummary[]> {
  const rows = await query<{ period: string; total: string; sent: string; failed: string; last: Date }>(
    `SELECT period, count(*) AS total,
            count(*) FILTER (WHERE status = 'sent') AS sent,
            count(*) FILTER (WHERE status = 'failed') AS failed,
            max(updated_at) AS last
     FROM payslips GROUP BY period`,
  );
  return rows
    .map((r) => ({
      period: r.period,
      total: Number(r.total),
      sent: Number(r.sent),
      failed: Number(r.failed),
      pending: Number(r.total) - Number(r.sent) - Number(r.failed),
      lastActivity: r.last.toISOString(),
    }))
    .sort((a, b) => periodSortKey(b.period).localeCompare(periodSortKey(a.period)));
}

export async function setDelivered(id: string, delivered: boolean, userId: string) {
  if (!UUID.test(id)) return false;
  const [r] = delivered
    ? await query<{ id: string }>(
        `UPDATE payslips SET status = 'sent', sent_at = now(), sent_by = $2, error = NULL, updated_at = now()
         WHERE id = $1 AND status <> 'sending' RETURNING id`,
        [id, userId],
      )
    : await query<{ id: string }>(
        `UPDATE payslips SET status = 'pending', sent_at = NULL, sent_by = NULL, error = NULL, updated_at = now()
         WHERE id = $1 AND status <> 'sending' RETURNING id`,
        [id],
      );
  return !!r;
}

export async function deletePeriod(period: string) {
  const rows = await query<{ id: string }>(
    "DELETE FROM payslips WHERE period = $1 AND status <> 'sending' RETURNING id",
    [period],
  );
  return rows.length;
}

export async function sendableIds(period: string, ids?: string[]) {
  const rows = await query<{ id: string }>(
    `SELECT id FROM payslips WHERE period = $1 AND status IN ('pending', 'failed')
       AND ($2::uuid[] IS NULL OR id = ANY($2)) ORDER BY row_no`,
    [period, ids?.filter((id) => UUID.test(id)) ?? null],
  );
  return rows.map((r) => r.id);
}

export async function claimForSending(id: string): Promise<PayslipData | null> {
  const [r] = await query<{ data_enc: string }>(
    `UPDATE payslips SET status = 'sending', attempts = attempts + 1, error = NULL, updated_at = now()
     WHERE id = $1 AND status IN ('pending', 'failed') RETURNING data_enc`,
    [id],
  );
  return r ? decryptJson<PayslipData>(r.data_enc) : null;
}

export const markSent = (id: string, userId: string) =>
  query("UPDATE payslips SET status = 'sent', sent_at = now(), sent_by = $2, updated_at = now() WHERE id = $1", [
    id,
    userId,
  ]);

export const markFailed = (id: string, error: string) =>
  query("UPDATE payslips SET status = 'failed', error = $2, updated_at = now() WHERE id = $1", [id, error]);

export const recoverStuckSending = () =>
  query(
    `UPDATE payslips SET status = 'failed', updated_at = now(),
       error = 'ລະບົບຢຸດລະຫວ່າງສົ່ງ — ບໍ່ແນ່ໃຈວ່າໄປເຖິງບໍ່ (ກວດໃນ WhatsApp ກ່ອນສົ່ງຄືນ)'
     WHERE status = 'sending'`,
  );
