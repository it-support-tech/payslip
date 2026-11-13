"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConfirm } from "@/components/confirm-dialog";
import type { JobResult, JobState } from "@/lib/payslip-job";
import type { PayslipStatus, PayslipView, PeriodSummary } from "@/lib/payslips";
import { cn, formatMoney, monthPeriod, periodKey } from "@/lib/utils";
import { api, download } from "./use-live-status";
import { IconEye, IconEyeOff, IconSend, Legend, Spinner, Stat } from "./ui";
import { BASE_PATH } from "@/lib/base-path";

function periodOptions(periods: PeriodSummary[], selected: string | null) {
  const map = new Map<string, PeriodSummary | null>(
    periods.map((p) => [p.period, p]),
  );
  for (let i = 1; i >= -12; i--)
    if (!map.has(monthPeriod(i))) map.set(monthPeriod(i), null);
  if (selected && !map.has(selected)) map.set(selected, null);
  return [...map.entries()].sort((a, b) => periodKey(b[0]) - periodKey(a[0]));
}
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export function SendTab({
  periods,
  period,
  onSelectPeriod,
  onPeriodsChanged,
  job,
  connected,
  onError,
}: {
  periods: PeriodSummary[];
  period: string | null;
  onSelectPeriod: (p: string) => void;
  onPeriodsChanged: () => Promise<void>;
  job: JobState | null;
  connected: boolean;
  onError: (msg: string) => void;
}) {
  const confirm = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [drag, setDrag] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [payslips, setPayslips] = useState<PayslipView[]>([]);
  const [loading, setLoading] = useState(false);
  const [showMoney, setShowMoney] = useState(false);
  const money = (n: number) => (showMoney ? formatMoney(n) : "****");

  const load = useCallback(async () => {
    if (!period) return setPayslips([]);
    setLoading(true);
    try {
      setPayslips(
        (
          await api<{ payslips: PayslipView[] }>(
            `${BASE_PATH}/api/payslips?period=${encodeURIComponent(period)}`,
          )
        ).payslips,
      );
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [period, onError]);

  useEffect(() => {
    load();
  }, [load]);

  // job ຂອງງວດນີ້ຈົບ → ໂຫລດສະຖານະຈາກຖານຂໍ້ມູນໃໝ່
  const jobForThis = job && job.period === period ? job : null;
  useEffect(() => {
    if (jobForThis?.finishedAt) {
      load();
      onPeriodsChanged();
    }
  }, [jobForThis?.finishedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  // ລະຫວ່າງສົ່ງ: ສະແດງສະຖານະສົດຈາກ job ແທນຄ່າໃນຖານຂໍ້ມູນ
  const liveById = useMemo(() => {
    const m = new Map<string, JobResult>();
    if (jobForThis?.running) jobForThis.results.forEach((r) => m.set(r.id, r));
    return m;
  }, [jobForThis]);

  const counts = useMemo(() => {
    const c = {
      total: payslips.length,
      sent: 0,
      pending: 0,
      failed: 0,
      net: 0,
    };
    for (const p of payslips) {
      if (p.status === "sent") c.sent++;
      else if (p.status === "failed") c.failed++;
      else c.pending++;
      c.net += p.data.netPay;
    }
    return c;
  }, [payslips]);
  const toSend = counts.pending + counts.failed;
  const running = !!job?.running;

  const startSend = async () => {
    if (!period) return;
    const ok = await confirm({
      title: "ຢືນຢັນການສົ່ງໃບແຈ້ງເງິນເດືອນ",
      message: (
        <>
          ສົ່ງໃຫ້ <b className="text-slate-800">{toSend} ຄົນ</b> ທີ່ຍັງບໍ່ໄດ້ຮັບ
          ຂອງງວດ <b>{period}</b>.
          <br />
          ໃຊ້ເວລາປະມານ {Math.max(1, Math.ceil((toSend * 4.5) / 60))} ນາທີ.
          {counts.sent > 0 && (
            <>
              <br />
              {counts.sent} ຄົນທີ່ໄດ້ຮັບແລ້ວ ຈະບໍ່ຖືກສົ່ງຊ້ຳ.
            </>
          )}
        </>
      ),
      confirmText: "ເລີ່ມສົ່ງ",
    });
    if (!ok) return;
    try {
      await api(`${BASE_PATH}/api/send`, { method: "POST", json: { period } });
    } catch (e) {
      onError((e as Error).message);
    }
  };

  const toggleDelivered = async (p: PayslipView) => {
    const delivered = p.status !== "sent";
    const ok = await confirm(
      delivered
        ? {
            title: `ໝາຍວ່າ ${p.data.name} ໄດ້ຮັບແລ້ວ?`,
            message:
              "ລະບົບຈະບໍ່ສົ່ງໃຫ້ຄົນນີ້ (ເຊັ່ນ ກໍລະນີ HR ສົ່ງເອງນອກລະບົບແລ້ວ).",
            confirmText: "ໝາຍວ່າສົ່ງແລ້ວ",
          }
        : {
            title: `ເອົາໝາຍວ່າ "ສົ່ງແລ້ວ" ຂອງ ${p.data.name} ອອກ?`,
            message: (
              <>
                ຄົນນີ້ຈະກັບໄປຢູ່ໃນລາຍການ <b>ລໍຖ້າສົ່ງ</b> ແລະ ຈະຖືກສົ່ງໃໝ່
                {p.sentAt && (
                  <>
                    ສົ່ງໄປແລ້ວເມື່ອ {fmtTime(p.sentAt)}
                    {p.sentBy ? ` ໂດຍ ${p.sentBy}` : ""}.
                  </>
                )}
              </>
            ),
            confirmText: "ເອົາຕິກອອກ",
            tone: "danger",
          },
    );
    if (!ok) return;
    try {
      await api(`${BASE_PATH}/api/payslips/${p.id}`, {
        method: "PATCH",
        json: { delivered },
      });
      await Promise.all([load(), onPeriodsChanged()]);
    } catch (e) {
      onError((e as Error).message);
    }
  };

  const upload = async (f: File) => {
    if (!/\.xlsx?$/i.test(f.name))
      return onError("ຮອງຮັບສະເພາະໄຟລ໌ .xlsx / .xls");
    setUploading(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      fd.append("period", period ?? monthPeriod());
      fd.append("commit", "1");
      const r = await api<ImportResult>(`${BASE_PATH}/api/payslips/import`, {
        method: "POST",
        body: fd,
      });
      setResult({ ...r, file: f.name });
      await onPeriodsChanged();
      const target = r.periods[0];
      if (target && target !== period) onSelectPeriod(target);
      else load();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const done = jobForThis
    ? jobForThis.sent + jobForThis.failed + jobForThis.skipped
    : 0;
  const pct = jobForThis?.total
    ? Math.round((done / jobForThis.total) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <section
        onClick={() => !uploading && !running && fileRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!running) setDrag(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node))
            setDrag(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files?.[0];
          if (f && !running) upload(f);
        }}
        className={cn(
          "group cursor-pointer rounded-2xl border-2 border-dashed px-6 py-10 transition",
          drag
            ? "border-ntp-500 bg-ntp-50 ring-4 ring-ntp-100"
            : "border-slate-300 bg-white hover:border-ntp-400 hover:bg-ntp-50/40",
          (uploading || running) && "cursor-not-allowed opacity-70",
        )}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) upload(f);
          }}
        />
        <div className="flex flex-col items-center gap-3 text-center">
          <span
            className={cn(
              "grid h-14 w-14 shrink-0 place-items-center rounded-full bg-ntp-50 text-2xl text-ntp-600 ring-1 ring-ntp-100 transition group-hover:scale-105",
              drag && "animate-bounce",
            )}
          >
            {uploading ? <Spinner className="h-5 w-5" /> : "⬆"}
          </span>
          <div>
            <p className="font-medium text-slate-700">
              {uploading ? (
                "ກຳລັງນຳເຂົ້າ..."
              ) : drag ? (
                "ປ່ອຍໄຟລ໌ເພື່ອນຳເຂົ້າ"
              ) : (
                <>
                  <span className="text-ntp-700 underline-offset-2 group-hover:underline">
                    ຄລິກເພື່ອເລືອກໄຟລ໌ ຫຼື ລາກໄຟລ໌ມາວາງທີ່ນີ້
                  </span>
                </>
              )}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              ງວດ <b className="text-slate-700">{period}</b>
            </p>
          </div>
        </div>
      </section>
      <p className="-mt-4 text-right text-xs text-slate-500">
        <button
          onClick={() =>
            download(`${BASE_PATH}/api/template`).catch((err) => onError(err.message))
          }
          className="font-medium text-ntp-700 hover:underline"
        >
          ດາວໂຫລດ Template
        </button>
      </p>

      {result && (
        <ImportSummary result={result} onClose={() => setResult(null)} />
      )}

      {period && (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-5">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-500">
                    ງວດເງິນເດືອນ
                  </span>
                  <select
                    value={period}
                    onChange={(e) => onSelectPeriod(e.target.value)}
                    className="min-w-56 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium outline-none focus:border-ntp-500 focus:ring-2 focus:ring-ntp-100"
                  >
                    {periodOptions(periods, period).map(([p, s]) => (
                      <option key={p} value={p}>
                        {p} ·{" "}
                        {s ? `ສົ່ງແລ້ວ ${s.sent}/${s.total}` : "ຍັງບໍ່ມີຂໍ້ມູນ"}
                      </option>
                    ))}
                  </select>
                </label>
                 
              </div>
              <div className="flex gap-2">
                {jobForThis?.running ? (
                  <button
                    onClick={() =>
                      api(`${BASE_PATH}/api/send`, { method: "DELETE" }).catch((e) =>
                        onError(e.message),
                      )
                    }
                    className="rounded-lg border border-rose-200 px-4 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50"
                  >
                    ຢຸດການສົ່ງ
                  </button>
                ) : (
                  <button
                    onClick={startSend}
                    disabled={!connected || running || toSend === 0}
                    className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-ntp-700 to-ntp-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-ntp-800 hover:to-ntp-600 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300"
                  >
                    <IconSend className="h-4 w-4" />
                    ສົ່ງ{" "}
                    {toSend > 0 ? `${toSend} ຄົນທີ່ຍັງບໍ່ໄດ້ຮັບ` : "Payslip"}
                  </button>
                )}
              </div>
            </div>

            {jobForThis && (
              <div className="mt-5">
                <div className="mb-2 flex justify-between text-xs font-medium text-slate-600">
                  <span>
                    {done} / {jobForThis.total}
                    {jobForThis.startedBy && (
                      <span className="ml-2 text-slate-400">
                        · ໂດຍ {jobForThis.startedBy}
                      </span>
                    )}
                  </span>
                  <span>{pct}%</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={cn(
                      "h-full rounded-full bg-gradient-to-r from-flame-600 via-flame-500 to-flame-300 transition-all duration-500",
                      jobForThis.running && "animate-pulse",
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-4 text-xs">
                  <Legend
                    color="bg-emerald-500"
                    label={`ສົ່ງສຳເລັດ ${jobForThis.sent}`}
                  />
                  <Legend
                    color="bg-rose-500"
                    label={`ລົ້ມເຫຼວ ${jobForThis.failed}`}
                  />
                  <Legend
                    color="bg-flame-400"
                    label={`ຂ້າມ ${jobForThis.skipped}`}
                  />
                  <Legend
                    color="bg-slate-300"
                    label={`ລໍຖ້າ ${jobForThis.total - done}`}
                  />
                </div>
              </div>
            )}

            {counts.total > 0 && (
              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4 text-sm">
                <span className="mr-1 text-slate-500">ດາວໂຫລດ Excel:</span>
                <button
                  onClick={() =>
                    download(
                      `${BASE_PATH}/api/report?period=${encodeURIComponent(period)}&only=remaining`,
                    ).catch((e) => onError(e.message))
                  }
                  className="rounded-lg border border-ntp-200 bg-ntp-50 px-3 py-1.5 font-medium text-ntp-700 transition hover:bg-ntp-100"
                >
                  ⬇ ລາຍຊື່ທີ່ຍັງບໍ່ໄດ້ຮັບ
                </button>
                <button
                  onClick={() =>
                    download(
                      `${BASE_PATH}/api/report?period=${encodeURIComponent(period)}`,
                    ).catch((e) => onError(e.message))
                  }
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-600 transition hover:bg-slate-50"
                >
                  ⬇ ລາຍງານທັງໝົດ
                </button>
              </div>
            )}
          </section>

          {counts.total > 0 && (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                <Stat label="ທັງໝົດ" value={counts.total} />
                <Stat label="ສົ່ງແລ້ວ" value={counts.sent} accent="emerald" />
                <Stat label="ລໍຖ້າສົ່ງ" value={counts.pending} accent="ntp" />
                <Stat
                  label="ລົ້ມເຫຼວ"
                  value={counts.failed}
                  accent={counts.failed ? "rose" : undefined}
                />
                <Stat label="ລວມເງິນສຸດທິ" value={money(counts.net)} small />
              </div>

              <PayslipTable
                payslips={payslips}
                loading={loading}
                liveById={liveById}
                money={money}
                showMoney={showMoney}
                onToggleMoney={() => setShowMoney((v) => !v)}
                onToggleDelivered={toggleDelivered}
                lockToggle={running}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}

interface ImportResult {
  file?: string;
  inserted: number;
  updated: number;
  unchanged: number;
  locked: number;
  periods: string[];
  problems: { row: number; name: string; reason: string }[];
}

function ImportSummary({
  result,
  onClose,
}: {
  result: ImportResult;
  onClose: () => void;
}) {
  const chips: [string, number, string][] = [
    ["ໃໝ່", result.inserted, "bg-ntp-50 text-ntp-700"],
    ["ອັບເດດ", result.updated, "bg-flame-300/20 text-flame-600"],
    ["ບໍ່ປ່ຽນ", result.unchanged, "bg-slate-100 text-slate-500"],
    ["ສົ່ງແລ້ວ (ບໍ່ແກ້)", result.locked, "bg-emerald-50 text-emerald-700"],
    ["ຜິດພາດ", result.problems.length, "bg-rose-50 text-rose-700"],
  ];
  const warn = result.problems.length > 0;
  return (
    <section
      className={cn(
        "animate-pop-in rounded-2xl border p-4 shadow-sm",
        warn
          ? "border-amber-200 bg-amber-50/60"
          : "border-emerald-200 bg-emerald-50/60",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-800">
            {warn ? "⚠️" : "✓"} ນຳເຂົ້າ {result.file} ແລ້ວ
            {result.periods.length > 0 && (
              <span className="font-normal text-slate-500">
                {" "}
                · ງວດ {result.periods.join(", ")}
              </span>
            )}
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs font-medium">
            {chips
              .filter(([, n]) => n > 0)
              .map(([label, n, cls]) => (
                <span key={label} className={cn("rounded-full px-3 py-1", cls)}>
                  {label} {n}
                </span>
              ))}
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600"
          aria-label="ປິດ"
        >
          ✕
        </button>
      </div>
      {warn && (
        <ul className="mt-3 max-h-40 space-y-1 overflow-auto rounded-lg bg-white/70 p-3 text-xs text-slate-600">
          {result.problems.map((p) => (
            <li key={p.row}>
              <span className="text-slate-400">ແຖວ {p.row}</span> ·{" "}
              {p.name || "—"} —{" "}
              <span className="text-rose-600">{p.reason}</span>
            </li>
          ))}
          <li className="pt-1 text-slate-400">
            ແກ້ແຖວເຫຼົ່ານີ້ໃນ Excel ແລ້ວອັບໂຫລດໄຟລ໌ເດີມອີກຄັ້ງ
          </li>
        </ul>
      )}
    </section>
  );
}

/* ─────────────────────────── Table ─────────────────────────── */

type Filter = "all" | "pending" | "sent" | "failed";
const FILTERS: [Filter, string][] = [
  ["all", "ທັງໝົດ"],
  ["pending", "ລໍຖ້າສົ່ງ"],
  ["failed", "ລົ້ມເຫຼວ"],
  ["sent", "ສົ່ງແລ້ວ"],
];

function PayslipTable({
  payslips,
  loading,
  liveById,
  money,
  showMoney,
  onToggleMoney,
  onToggleDelivered,
  lockToggle,
}: {
  payslips: PayslipView[];
  loading: boolean;
  liveById: Map<string, JobResult>;
  money: (n: number) => string;
  showMoney: boolean;
  onToggleMoney: () => void;
  onToggleDelivered: (p: PayslipView) => void;
  lockToggle: boolean;
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const matchFilter = (s: PayslipStatus) =>
    filter === "all" ||
    (filter === "pending" ? s === "pending" || s === "sending" : s === filter);
  const filtered = payslips.filter(
    (p) =>
      matchFilter(p.status) &&
      (!q ||
        `${p.data.name} ${p.data.phone} ${p.data.employeeId}`
          .toLowerCase()
          .includes(q.toLowerCase())),
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
        <div className="inline-flex rounded-lg bg-slate-100 p-1 text-xs font-medium">
          {FILTERS.map(([f, label]) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-md px-3 py-1.5 transition",
                filter === f
                  ? "bg-white text-ntp-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-700",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleMoney}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
          >
            {showMoney ? (
              <IconEyeOff className="h-4 w-4" />
            ) : (
              <IconEye className="h-4 w-4" />
            )}
            {showMoney ? "ເຊື່ອງຕົວເລກ" : "ສະແດງຕົວເລກ"}
          </button>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ຄົ້ນຫາ ຊື່ / ເບີໂທ / ລະຫັດ..."
            className="w-60 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-ntp-500 focus:ring-2 focus:ring-ntp-100"
          />
        </div>
      </div>
      <div className="max-h-[600px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-[1] bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th
                className="px-5 py-3 text-center"
                title="ຕິກ = ສົ່ງແລ້ວ (ບໍ່ສົ່ງຊ້ຳ). ເອົາຕິກອອກ = ສົ່ງໃໝ່ໄດ້"
              >
                ສົ່ງແລ້ວ
              </th>
              <th className="px-3 py-3">#</th>
              <th className="px-3 py-3">ຊື່</th>
              <th className="px-3 py-3">ເບີ WhatsApp</th>
              <th className="px-3 py-3 text-right">ເງິນເດືອນ</th>
              <th className="px-3 py-3 text-right">ລາຍການຫັກ</th>
              <th className="px-3 py-3 text-right">ສຸດທິ</th>
              <th className="px-3 py-3">ສະຖານະ</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && payslips.length === 0 && (
              <tr>
                <td colSpan={9} className="py-10 text-center">
                  <Spinner className="mx-auto h-6 w-6 text-ntp-600" />
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="py-10 text-center text-sm text-slate-400"
                >
                  ບໍ່ມີລາຍການ
                </td>
              </tr>
            )}
            {filtered.map((p) => {
              const live = liveById.get(p.id);
              const status = live?.status ?? p.status;
              const sent = p.status === "sent";
              return (
                <tr
                  key={p.id}
                  className={cn(
                    "hover:bg-slate-50/70",
                    status === "failed" && "bg-rose-50/30",
                  )}
                >
                  <td className="px-5 py-3 text-center align-middle">
                    <input
                      type="checkbox"
                      checked={sent}
                      disabled={lockToggle || status === "sending"}
                      onChange={() => onToggleDelivered(p)}
                      className="h-4 w-4 cursor-pointer accent-emerald-600 disabled:cursor-not-allowed"
                      aria-label="ສົ່ງແລ້ວ"
                    />
                  </td>
                  <td className="px-3 py-3 text-slate-400">{p.rowNo}</td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <div className="font-medium text-slate-800">
                      {p.data.name}
                    </div>
                    <div className="text-xs text-slate-400">
                      {[p.data.employeeId, p.data.position]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-slate-600">
                    +{p.data.phone}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {money(p.data.baseSalary)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-500">
                    {money(p.data.totalDeductions)}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums text-ntp-700">
                    {money(p.data.netPay)}
                  </td>
                  <td className="px-3 py-3 align-middle">
                    <StatusBadge
                      status={status}
                      error={live?.error ?? p.error}
                      sentAt={p.sentAt}
                      sentBy={p.sentBy}
                    />
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-right">
                    <a
                      href={`${BASE_PATH}/api/payslips/${p.id}/pdf`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-ntp-700 hover:underline"
                    >
                      ເບິ່ງ PDF
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function StatusBadge({
  status,
  error,
  sentAt,
  sentBy,
}: {
  status: JobResult["status"] | PayslipStatus;
  error?: string | null;
  sentAt: string | null;
  sentBy: string | null;
}) {
  const map = {
    pending: ["ລໍຖ້າສົ່ງ", "bg-slate-100 text-slate-600"],
    sending: ["ກຳລັງສົ່ງ...", "bg-sky-50 text-sky-700 animate-pulse"],
    sent: ["✓ ສົ່ງແລ້ວ", "bg-emerald-50 text-emerald-700"],
    failed: ["✕ ລົ້ມເຫຼວ", "bg-rose-50 text-rose-700"],
    skipped: ["ຂ້າມ", "bg-amber-50 text-amber-700"],
  } as const;
  const [label, cls] = map[status];
  const detail =
    status === "sent" && sentAt
      ? `${fmtTime(sentAt)}${sentBy ? ` · ${sentBy}` : ""}`
      : status === "failed" || status === "skipped"
        ? error
        : null;
  return (
    <span
      title={detail ?? undefined}
      className={cn(
        "inline-flex h-6 max-w-64 items-center whitespace-nowrap rounded-full px-2.5 text-xs font-medium leading-none",
        cls,
      )}
    >
      <span className="shrink-0">{label}</span>
      {detail && (
        <span className="ml-1 truncate font-normal opacity-80">· {detail}</span>
      )}
    </span>
  );
}
