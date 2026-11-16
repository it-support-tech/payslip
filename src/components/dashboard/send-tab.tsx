"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConfirm } from "@/components/confirm-dialog";
import { SEND_DELAY } from "@/config";
import { BASE_PATH } from "@/lib/base-path";
import type { JobResult, JobState } from "@/lib/payslip-job";
import type { PayslipStatus, PayslipView, PeriodSummary } from "@/lib/payslips";
import { cn, formatMoney, monthPeriod, periodKey } from "@/lib/utils";
import {
  IconAlert,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconDownload,
  IconEye,
  IconEyeOff,
  IconFile,
  IconSearch,
  IconSend,
  IconUpload,
  IconUsers,
  IconWallet,
  IconX,
  Skeleton,
  Spinner,
} from "./ui";
import { api, download } from "./use-live-status";

const MAX_SIZE = 10 * 1024 * 1024;
const SECONDS_PER_PERSON = (SEND_DELAY.minMs + SEND_DELAY.maxMs) / 2000 + 2;

function periodOptions(periods: PeriodSummary[], selected: string | null) {
  const map = new Map<string, PeriodSummary | null>(periods.map((p) => [p.period, p]));
  for (let i = 1; i >= -12; i--) if (!map.has(monthPeriod(i))) map.set(monthPeriod(i), null);
  if (selected && !map.has(selected)) map.set(selected, null);
  return [...map.entries()].sort((a, b) => periodKey(b[0]) - periodKey(a[0]));
}

function shiftPeriod(p: string, delta: number) {
  const m = p.match(/^(\d{1,2})\/(\d{4})$/);
  return m ? monthPeriod(delta, new Date(Number(m[2]), Number(m[1]) - 1, 1)) : monthPeriod(delta);
}

const initial = (name: string) =>
  name.replace(/^(ທ້າວ|ນາງ|ທ|ນ)\.\s*/, "").match(/[\u0E81-\u0EAEA-Za-z]/)?.[0]?.toUpperCase() ?? "?";

const minutes = (people: number) => Math.max(1, Math.ceil((people * SECONDS_PER_PERSON) / 60));

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

type Filter = "all" | "pending" | "sent" | "failed";

export function SendTab({
  periods,
  period,
  onSelectPeriod,
  onPeriodsChanged,
  onOpenWhatsApp,
  job,
  connected,
  onError,
}: {
  periods: PeriodSummary[];
  period: string | null;
  onSelectPeriod: (p: string) => void;
  onPeriodsChanged: () => Promise<void>;
  onOpenWhatsApp: () => void;
  job: JobState | null;
  connected: boolean;
  onError: (msg: string) => void;
}) {
  const confirm = useConfirm();
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [payslips, setPayslips] = useState<PayslipView[]>([]);
  const [loadedPeriod, setLoadedPeriod] = useState<string | null>(null);
  const [showMoney, setShowMoney] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const money = (n: number) => (showMoney ? formatMoney(n) : "••••");
  const loading = loadedPeriod !== period;

  const load = useCallback(async () => {
    if (!period) return;
    try {
      const r = await api<{ payslips: PayslipView[] }>(
        `${BASE_PATH}/api/payslips?period=${encodeURIComponent(period)}`,
      );
      setPayslips(r.payslips);
      setLoadedPeriod(period);
    } catch (e) {
      onError((e as Error).message);
    }
  }, [period, onError]);

  useEffect(() => {
    load();
  }, [load]);

  const jobForThis = job && job.period === period ? job : null;
  const handledFinish = useRef<number | null>(null);
  useEffect(() => {
    const finished = jobForThis?.finishedAt;
    if (!finished || handledFinish.current === finished) return;
    handledFinish.current = finished;
    load();
    onPeriodsChanged();
  }, [jobForThis?.finishedAt, load, onPeriodsChanged]);

  const liveById = useMemo(() => {
    const m = new Map<string, JobResult>();
    if (jobForThis?.running) jobForThis.results.forEach((r) => m.set(r.id, r));
    return m;
  }, [jobForThis]);

  const counts = useMemo(() => {
    const c = { total: payslips.length, sent: 0, pending: 0, failed: 0, net: 0 };
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
  const otherRunning = running && !jobForThis?.running;
  const hasData = !loading && counts.total > 0;
  const allSent = hasData && toSend === 0;

  const blocker = !hasData
    ? "ອັບໂຫລດ Excel ກ່ອນ"
    : allSent
      ? "ທຸກຄົນໄດ້ຮັບແລ້ວ"
      : !connected
        ? "WhatsApp ຍັງບໍ່ໄດ້ເຊື່ອມຕໍ່"
        : otherRunning
          ? `ກຳລັງສົ່ງງວດ ${job?.period} ຢູ່`
          : null;

  const send = async (ids?: string[], who?: string) => {
    if (!period) return;
    const n = ids?.length ?? toSend;
    const ok = await confirm({
      title: who ? `ສົ່ງ Payslip ໃຫ້ ${who}?` : "ຢືນຢັນການສົ່ງໃບແຈ້ງເງິນເດືອນ",
      message: who ? (
        <>
          ສົ່ງໃບແຈ້ງເງິນເດືອນງວດ <b>{period}</b> ໄປທາງ WhatsApp.
        </>
      ) : (
        <>
          ສົ່ງໃຫ້ <b className="text-slate-800">{n} ຄົນ</b> ທີ່ຍັງບໍ່ໄດ້ຮັບ ຂອງງວດ <b>{period}</b>.
          <br />
          ໃຊ້ເວລາປະມານ {minutes(n)} ນາທີ — ປິດໜ້ານີ້ໄດ້, ລະບົບຈະສົ່ງຕໍ່ເອງ.
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
      await api(`${BASE_PATH}/api/send`, { method: "POST", json: { period, ids } });
    } catch (e) {
      onError((e as Error).message);
    }
  };

  const stop = async () => {
    const ok = await confirm({
      title: "ຢຸດການສົ່ງ?",
      message: "ຄົນທີ່ສົ່ງໄປແລ້ວຈະບໍ່ຖືກກະທົບ. ຄົນທີ່ເຫຼືອຈະກັບໄປລໍຖ້າສົ່ງ ແລະ ກົດສົ່ງຕໍ່ໄດ້ພາຍຫຼັງ.",
      confirmText: "ຢຸດສົ່ງ",
      tone: "danger",
    });
    if (ok) api(`${BASE_PATH}/api/send`, { method: "DELETE" }).catch((e) => onError(e.message));
  };

  const toggleDelivered = async (p: PayslipView) => {
    const delivered = p.status !== "sent";
    const ok = await confirm(
      delivered
        ? {
            title: `ໝາຍວ່າ ${p.data.name} ໄດ້ຮັບແລ້ວ?`,
            message: "ລະບົບຈະບໍ່ສົ່ງໃຫ້ຄົນນີ້ (ເຊັ່ນ ກໍລະນີ HR ສົ່ງເອງນອກລະບົບແລ້ວ).",
            confirmText: "ໝາຍວ່າສົ່ງແລ້ວ",
          }
        : {
            title: `ເອົາໝາຍ "ສົ່ງແລ້ວ" ຂອງ ${p.data.name} ອອກ?`,
            message: (
              <>
                ຄົນນີ້ຈະກັບໄປຢູ່ໃນລາຍການ <b>ລໍຖ້າສົ່ງ</b> ແລະ ຈະຖືກສົ່ງໃໝ່ໃນຮອບຕໍ່ໄປ.
                {p.sentAt && (
                  <>
                    <br />
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
      await api(`${BASE_PATH}/api/payslips/${p.id}`, { method: "PATCH", json: { delivered } });
      await Promise.all([load(), onPeriodsChanged()]);
    } catch (e) {
      onError((e as Error).message);
    }
  };

  const upload = async (f: File) => {
    if (!/\.xlsx?$/i.test(f.name)) return onError("ຮອງຮັບສະເພາະໄຟລ໌ .xlsx / .xls");
    if (f.size > MAX_SIZE) return onError("ໄຟລ໌ໃຫຍ່ເກີນ 10MB");
    setUploading(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      fd.append("period", period ?? monthPeriod());
      fd.append("commit", "1");
      const r = await api<ImportResult>(`${BASE_PATH}/api/payslips/import`, { method: "POST", body: fd });
      setResult({ ...r, file: f.name });
      setFilter("all");
      await onPeriodsChanged();
      const target = r.periods[0];
      if (target && target !== period) onSelectPeriod(target);
      else await load();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <UploadZone
        period={period}
        uploading={uploading}
        disabled={running}
        onFile={upload}
        onTemplate={() => download(`${BASE_PATH}/api/template`).catch((err) => onError(err.message))}
      />

      {result && <ImportSummary result={result} onClose={() => setResult(null)} />}

      {period && (
        <>
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-4 p-5">
              <div>
                <span className="mb-1.5 block text-xs font-medium text-slate-500">ງວດເງິນເດືອນ</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onSelectPeriod(shiftPeriod(period, -1))}
                    className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
                    aria-label="ເດືອນກ່ອນ"
                  >
                    <IconChevronLeft className="h-4 w-4" />
                  </button>
                  <select
                    value={period}
                    onChange={(e) => onSelectPeriod(e.target.value)}
                    className="h-10 min-w-56 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-ntp-500 focus:ring-2 focus:ring-ntp-100"
                  >
                    {periodOptions(periods, period).map(([p, s]) => (
                      <option key={p} value={p}>
                        {p} · {s ? `ສົ່ງແລ້ວ ${s.sent}/${s.total}` : "ຍັງບໍ່ມີຂໍ້ມູນ"}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => onSelectPeriod(shiftPeriod(period, 1))}
                    className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
                    aria-label="ເດືອນຖັດໄປ"
                  >
                    <IconChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1.5">
                {jobForThis?.running ? (
                  <button
                    onClick={stop}
                    className="inline-flex h-11 items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-5 text-sm font-semibold text-rose-600 transition hover:bg-rose-100"
                  >
                    <IconX className="h-4 w-4" />
                    ຢຸດການສົ່ງ
                  </button>
                ) : (
                  <button
                    onClick={() => send()}
                    disabled={!!blocker}
                    title={blocker ?? undefined}
                    className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-ntp-700 to-ntp-500 px-6 text-sm font-semibold text-white shadow-md shadow-ntp-500/20 transition hover:-translate-y-px hover:from-ntp-800 hover:to-ntp-600 hover:shadow-lg disabled:translate-y-0 disabled:cursor-not-allowed disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 disabled:shadow-none"
                  >
                    <IconSend className="h-4 w-4" />
                    {toSend > 0 && hasData ? `ສົ່ງໃຫ້ ${toSend} ຄົນ` : "ສົ່ງ Payslip"}
                  </button>
                )}
                {!blocker && !jobForThis?.running && (
                  <span className="text-xs text-slate-400">ໃຊ້ເວລາປະມານ {minutes(toSend)} ນາທີ</span>
                )}
              </div>
            </div>

            {!jobForThis?.running && (
              <Checklist
                loading={loading}
                total={counts.total}
                toSend={toSend}
                connected={connected}
                otherRunning={otherRunning ? job?.period ?? null : null}
                onOpenWhatsApp={onOpenWhatsApp}
              />
            )}

            {jobForThis && <Progress job={jobForThis} />}

            {hasData && (
              <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3 text-sm">
                <span className="mr-1 text-xs text-slate-500">ດາວໂຫລດ Excel:</span>
                {toSend > 0 && (
                  <button
                    onClick={() =>
                      download(
                        `${BASE_PATH}/api/report?period=${encodeURIComponent(period)}&only=remaining`,
                      ).catch((e) => onError(e.message))
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg border border-ntp-200 bg-white px-3 py-1.5 text-xs font-medium text-ntp-700 transition hover:bg-ntp-50"
                  >
                    <IconDownload className="h-3.5 w-3.5" />
                    ລາຍຊື່ທີ່ຍັງບໍ່ໄດ້ຮັບ
                  </button>
                )}
                <button
                  onClick={() =>
                    download(`${BASE_PATH}/api/report?period=${encodeURIComponent(period)}`).catch((e) =>
                      onError(e.message),
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                >
                  <IconDownload className="h-3.5 w-3.5" />
                  ລາຍງານທັງໝົດ
                </button>
              </div>
            )}
          </section>

          {loading ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                {Array.from({ length: 5 }, (_, i) => (
                  <Skeleton key={i} className="h-[88px] rounded-2xl" />
                ))}
              </div>
              <Skeleton className="h-64 rounded-2xl" />
            </div>
          ) : counts.total === 0 ? (
            <EmptyPeriod period={period} />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                <StatCard
                  label="ທັງໝົດ"
                  value={counts.total}
                  icon={<IconUsers className="h-4 w-4" />}
                  tone="slate"
                  active={filter === "all"}
                  onClick={() => setFilter("all")}
                />
                <StatCard
                  label="ສົ່ງແລ້ວ"
                  value={counts.sent}
                  icon={<IconCheck className="h-4 w-4" />}
                  tone="emerald"
                  active={filter === "sent"}
                  onClick={() => setFilter("sent")}
                />
                <StatCard
                  label="ລໍຖ້າສົ່ງ"
                  value={counts.pending}
                  icon={<IconClock className="h-4 w-4" />}
                  tone="ntp"
                  active={filter === "pending"}
                  onClick={() => setFilter("pending")}
                />
                <StatCard
                  label="ລົ້ມເຫຼວ"
                  value={counts.failed}
                  icon={<IconAlert className="h-4 w-4" />}
                  tone={counts.failed ? "rose" : "slate"}
                  active={filter === "failed"}
                  onClick={() => setFilter("failed")}
                />
                <StatCard
                  label="ລວມເງິນສຸດທິ"
                  value={money(counts.net)}
                  icon={<IconWallet className="h-4 w-4" />}
                  tone="flame"
                  small
                  onClick={() => setShowMoney((v) => !v)}
                  hint={showMoney ? "ກົດເພື່ອເຊື່ອງ" : "ກົດເພື່ອເບິ່ງ"}
                />
              </div>

              <PayslipTable
                payslips={payslips}
                counts={counts}
                filter={filter}
                onFilter={setFilter}
                liveById={liveById}
                money={money}
                showMoney={showMoney}
                onToggleMoney={() => setShowMoney((v) => !v)}
                onToggleDelivered={toggleDelivered}
                onSendOne={connected && !running ? (p) => send([p.id], p.data.name) : null}
                lockToggle={running}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}

function UploadZone({
  period,
  uploading,
  disabled,
  onFile,
  onTemplate,
}: {
  period: string | null;
  uploading: boolean;
  disabled: boolean;
  onFile: (f: File) => void;
  onTemplate: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const blocked = uploading || disabled;

  return (
    <div>
      <section
        role="button"
        tabIndex={0}
        onClick={() => !blocked && fileRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && !blocked && fileRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!blocked) setDrag(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrag(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files?.[0];
          if (f && !blocked) onFile(f);
        }}
        className={cn(
          "group relative cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed px-6 py-10 outline-none transition focus-visible:ring-4 focus-visible:ring-ntp-100",
          drag
            ? "scale-[1.01] border-ntp-500 bg-ntp-50 ring-4 ring-ntp-100"
            : "border-slate-300 bg-white hover:border-ntp-400 hover:bg-ntp-50/40",
          blocked && "cursor-not-allowed opacity-70 hover:border-slate-300 hover:bg-white",
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
            if (f) onFile(f);
          }}
        />
        {uploading && (
          <div className="absolute inset-x-0 top-0 h-1 overflow-hidden bg-ntp-100">
            <div className="animate-loader h-full w-full origin-left bg-gradient-to-r from-ntp-500 to-flame-500" />
          </div>
        )}
        <div className="flex flex-col items-center gap-3 text-center">
          <span
            className={cn(
              "grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-ntp-50 to-ntp-100 text-ntp-600 ring-1 ring-ntp-200/60 transition group-hover:-translate-y-0.5 group-hover:shadow-md",
              drag && "animate-bounce",
            )}
          >
            {uploading ? <Spinner className="h-6 w-6" /> : <IconUpload className="h-7 w-7" />}
          </span>
          <div>
            <p className="font-medium text-slate-700">
              {uploading ? (
                "ກຳລັງນຳເຂົ້າ ແລະ ກວດຂໍ້ມູນ..."
              ) : drag ? (
                "ປ່ອຍໄຟລ໌ເພື່ອນຳເຂົ້າ"
              ) : disabled ? (
                "ກຳລັງສົ່ງຢູ່ — ອັບໂຫລດໄດ້ຫຼັງສົ່ງສຳເລັດ"
              ) : (
                <span className="text-ntp-700 underline-offset-2 group-hover:underline">
                  ຄລິກເພື່ອເລືອກໄຟລ໌ ຫຼື ລາກໄຟລ໌ມາວາງທີ່ນີ້
                </span>
              )}
            </p>
            <p className="mt-1.5 text-xs text-slate-500">
              Excel (.xlsx, .xls) ບໍ່ເກີນ 10MB
              {period && (
                <>
                  {" "}
                  · ແຖວທີ່ບໍ່ມີເດືອນຈະເຂົ້າງວດ <b className="text-slate-700">{period}</b>
                </>
              )}
            </p>
          </div>
        </div>
      </section>
      <div className="mt-2 flex justify-end">
        <button
          onClick={onTemplate}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-ntp-700 hover:underline"
        >
          <IconFile className="h-3.5 w-3.5" />
          ດາວໂຫລດ Template
        </button>
      </div>
    </div>
  );
}

function Checklist({
  loading,
  total,
  toSend,
  connected,
  otherRunning,
  onOpenWhatsApp,
}: {
  loading: boolean;
  total: number;
  toSend: number;
  connected: boolean;
  otherRunning: string | null;
  onOpenWhatsApp: () => void;
}) {
  if (loading) {
    return (
      <div className="flex gap-2 px-5 pb-5">
        <Skeleton className="h-8 w-32 rounded-full" />
        <Skeleton className="h-8 w-40 rounded-full" />
      </div>
    );
  }
  if (total > 0 && toSend === 0) {
    return (
      <div className="mx-5 mb-5 flex items-center gap-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-100">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-500 text-white">
          <IconCheck className="h-4 w-4" />
        </span>
        <span>
          <b>ສົ່ງຄົບທຸກຄົນແລ້ວ</b> — ພະນັກງານທັງ {total} ຄົນໄດ້ຮັບໃບແຈ້ງເງິນເດືອນງວດນີ້ແລ້ວ
        </span>
      </div>
    );
  }
  const items: { ok: boolean; label: string; action?: React.ReactNode }[] = [
    { ok: total > 0, label: total > 0 ? `ມີຂໍ້ມູນ ${total} ຄົນ` : "ຍັງບໍ່ມີຂໍ້ມູນ — ອັບໂຫລດ Excel ຂ້າງເທິງ" },
    {
      ok: connected,
      label: connected ? "WhatsApp ພ້ອມສົ່ງ" : "WhatsApp ຍັງບໍ່ໄດ້ເຊື່ອມຕໍ່",
      action: !connected && (
        <button onClick={onOpenWhatsApp} className="ml-1 font-semibold underline underline-offset-2">
          ໄປເຊື່ອມຕໍ່
        </button>
      ),
    },
  ];
  if (otherRunning) items.push({ ok: false, label: `ກຳລັງສົ່ງງວດ ${otherRunning} ຢູ່ — ລໍຖ້າໃຫ້ສຳເລັດກ່ອນ` });

  return (
    <div className="flex flex-wrap gap-2 px-5 pb-5">
      {items.map((it) => (
        <span
          key={it.label}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1",
            it.ok ? "bg-emerald-50 text-emerald-700 ring-emerald-100" : "bg-amber-50 text-amber-800 ring-amber-200",
          )}
        >
          {it.ok ? <IconCheck className="h-3.5 w-3.5" /> : <IconAlert className="h-3.5 w-3.5" />}
          {it.label}
          {it.action}
        </span>
      ))}
    </div>
  );
}

function Progress({ job }: { job: JobState }) {
  const done = job.sent + job.failed + job.skipped;
  const pct = job.total ? Math.round((done / job.total) * 100) : 0;
  const left = job.total - done;
  return (
    <div className="border-t border-slate-100 px-5 py-4">
      <div className="mb-2 flex items-end justify-between gap-4 text-sm">
        <div className="min-w-0">
          {job.running ? (
            <p className="flex items-center gap-2 font-medium text-slate-700">
              <Spinner className="h-4 w-4 shrink-0 text-ntp-600" />
              <span className="truncate">ກຳລັງສົ່ງ{job.current ? ` ໃຫ້ ${job.current}` : "..."}</span>
            </p>
          ) : (
            <p className="font-medium text-slate-700">ສົ່ງຮອບນີ້ສຳເລັດແລ້ວ</p>
          )}
          <p className="mt-0.5 text-xs text-slate-400">
            {done} / {job.total} ຄົນ
            {job.startedBy && ` · ໂດຍ ${job.startedBy}`}
            {job.running && left > 0 && ` · ເຫຼືອປະມານ ${minutes(left)} ນາທີ`}
          </p>
        </div>
        <span className="text-2xl font-bold tabular-nums text-ntp-700">{pct}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-flame-600 via-flame-500 to-flame-300 transition-all duration-500"
          style={{ width: `${pct}%` }}
        >
          {job.running && (
            <div className="animate-shimmer absolute inset-0 bg-[linear-gradient(90deg,transparent_25%,rgba(255,255,255,.45)_50%,transparent_75%)] bg-[length:200%_100%]" />
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs">
        <Dot color="bg-emerald-500" label={`ສຳເລັດ ${job.sent}`} />
        <Dot color="bg-rose-500" label={`ລົ້ມເຫຼວ ${job.failed}`} />
        <Dot color="bg-flame-400" label={`ຂ້າມ ${job.skipped}`} />
        <Dot color="bg-slate-300" label={`ລໍຖ້າ ${left}`} />
      </div>
    </div>
  );
}

function Dot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-slate-600">
      <span className={cn("h-2 w-2 rounded-full", color)} />
      {label}
    </span>
  );
}

const TONES = {
  slate: { icon: "bg-slate-100 text-slate-600", value: "text-slate-900", ring: "ring-slate-300" },
  emerald: { icon: "bg-emerald-50 text-emerald-600", value: "text-emerald-600", ring: "ring-emerald-300" },
  ntp: { icon: "bg-ntp-50 text-ntp-600", value: "text-ntp-600", ring: "ring-ntp-300" },
  rose: { icon: "bg-rose-50 text-rose-600", value: "text-rose-600", ring: "ring-rose-300" },
  flame: { icon: "bg-flame-300/20 text-flame-600", value: "text-slate-900", ring: "ring-flame-300" },
};

function StatCard({
  label,
  value,
  icon,
  tone,
  small,
  active,
  hint,
  onClick,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  tone: keyof typeof TONES;
  small?: boolean;
  active?: boolean;
  hint?: string;
  onClick: () => void;
}) {
  const t = TONES[tone];
  return (
    <button
      onClick={onClick}
      title={hint}
      className={cn(
        "rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
        active && cn("ring-2", t.ring),
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <span className={cn("grid h-7 w-7 place-items-center rounded-lg", t.icon)}>{icon}</span>
      </div>
      <p className={cn("mt-2 font-bold tabular-nums", small ? "text-lg leading-8" : "text-2xl", t.value)}>{value}</p>
    </button>
  );
}

function EmptyPeriod({ period }: { period: string }) {
  return (
    <section className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-400">
        <IconFile className="h-7 w-7" />
      </span>
      <p className="mt-4 font-semibold text-slate-700">ງວດ {period} ຍັງບໍ່ມີຂໍ້ມູນ</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500">
        ອັບໂຫລດໄຟລ໌ Excel ເງິນເດືອນຂ້າງເທິງ ລະບົບຈະສ້າງ Payslip ໃຫ້ພະນັກງານແຕ່ລະຄົນອັດຕະໂນມັດ
      </p>
    </section>
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

function ImportSummary({ result, onClose }: { result: ImportResult; onClose: () => void }) {
  const chips: [string, number, string][] = [
    ["ໃໝ່", result.inserted, "bg-ntp-50 text-ntp-700 ring-ntp-100"],
    ["ອັບເດດ", result.updated, "bg-flame-300/20 text-flame-600 ring-flame-300/40"],
    ["ບໍ່ປ່ຽນ", result.unchanged, "bg-slate-100 text-slate-500 ring-slate-200"],
    ["ສົ່ງແລ້ວ (ບໍ່ແກ້)", result.locked, "bg-emerald-50 text-emerald-700 ring-emerald-100"],
    ["ຜິດພາດ", result.problems.length, "bg-rose-50 text-rose-700 ring-rose-100"],
  ];
  const warn = result.problems.length > 0;
  return (
    <section
      className={cn(
        "animate-pop-in rounded-2xl border p-4 shadow-sm",
        warn ? "border-amber-200 bg-amber-50/60" : "border-emerald-200 bg-emerald-50/60",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 gap-3">
          <span
            className={cn(
              "grid h-9 w-9 shrink-0 place-items-center rounded-full text-white",
              warn ? "bg-amber-500" : "bg-emerald-500",
            )}
          >
            {warn ? <IconAlert className="h-4 w-4" /> : <IconCheck className="h-4 w-4" />}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-800">
              ນຳເຂົ້າ {result.file} ແລ້ວ
              {result.periods.length > 0 && (
                <span className="font-normal text-slate-500"> · ງວດ {result.periods.join(", ")}</span>
              )}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-medium">
              {chips
                .filter(([, n]) => n > 0)
                .map(([label, n, cls]) => (
                  <span key={label} className={cn("rounded-full px-2.5 py-1 ring-1", cls)}>
                    {label} {n}
                  </span>
                ))}
            </div>
          </div>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="ປິດ">
          <IconX className="h-4 w-4" />
        </button>
      </div>
      {warn && (
        <ul className="mt-3 max-h-40 space-y-1 overflow-auto rounded-lg bg-white/80 p-3 text-xs text-slate-600">
          {result.problems.map((p) => (
            <li key={p.row}>
              <span className="text-slate-400">ແຖວ {p.row}</span> · {p.name || "—"} —{" "}
              <span className="text-rose-600">{p.reason}</span>
            </li>
          ))}
          <li className="pt-1 text-slate-400">ແກ້ແຖວເຫຼົ່ານີ້ໃນ Excel ແລ້ວອັບໂຫລດໄຟລ໌ເດີມອີກຄັ້ງ</li>
        </ul>
      )}
    </section>
  );
}

const FILTERS: [Filter, string][] = [
  ["all", "ທັງໝົດ"],
  ["pending", "ລໍຖ້າສົ່ງ"],
  ["failed", "ລົ້ມເຫຼວ"],
  ["sent", "ສົ່ງແລ້ວ"],
];

function PayslipTable({
  payslips,
  counts,
  filter,
  onFilter,
  liveById,
  money,
  showMoney,
  onToggleMoney,
  onToggleDelivered,
  onSendOne,
  lockToggle,
}: {
  payslips: PayslipView[];
  counts: Record<"total" | "sent" | "pending" | "failed", number>;
  filter: Filter;
  onFilter: (f: Filter) => void;
  liveById: Map<string, JobResult>;
  money: (n: number) => string;
  showMoney: boolean;
  onToggleMoney: () => void;
  onToggleDelivered: (p: PayslipView) => void;
  onSendOne: ((p: PayslipView) => void) | null;
  lockToggle: boolean;
}) {
  const [q, setQ] = useState("");
  const countOf = { all: counts.total, pending: counts.pending, failed: counts.failed, sent: counts.sent };

  const matchFilter = (s: PayslipStatus) =>
    filter === "all" || (filter === "pending" ? s === "pending" || s === "sending" : s === filter);
  const needle = q.trim().toLowerCase();
  const filtered = payslips.filter(
    (p) =>
      matchFilter(p.status) &&
      (!needle || `${p.data.name} ${p.data.phone} ${p.data.employeeId}`.toLowerCase().includes(needle)),
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
        <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-medium">
          {FILTERS.map(([f, label]) => (
            <button
              key={f}
              onClick={() => onFilter(f)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition",
                filter === f ? "bg-white text-ntp-700 shadow-sm" : "text-slate-500 hover:text-slate-700",
              )}
            >
              {label}
              <span
                className={cn(
                  "rounded-full px-1.5 text-[10px] tabular-nums",
                  filter === f ? "bg-ntp-50 text-ntp-700" : "bg-slate-200/70 text-slate-500",
                  f === "failed" && countOf.failed > 0 && "bg-rose-100 text-rose-700",
                )}
              >
                {countOf[f]}
              </span>
            </button>
          ))}
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <button
            onClick={onToggleMoney}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
          >
            {showMoney ? <IconEyeOff className="h-4 w-4" /> : <IconEye className="h-4 w-4" />}
            <span className="hidden sm:inline">{showMoney ? "ເຊື່ອງຕົວເລກ" : "ສະແດງຕົວເລກ"}</span>
          </button>
          <label className="relative flex-1 sm:w-64 sm:flex-none">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ຄົ້ນຫາ ຊື່ / ເບີໂທ / ລະຫັດ..."
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-8 text-sm outline-none focus:border-ntp-500 focus:ring-2 focus:ring-ntp-100"
            />
            {q && (
              <button
                onClick={() => setQ("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600"
                aria-label="ລ້າງ"
              >
                <IconX className="h-3.5 w-3.5" />
              </button>
            )}
          </label>
        </div>
      </div>
      <div className="max-h-[600px] overflow-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="sticky top-0 z-[1] bg-slate-50/95 text-left text-xs text-slate-500 backdrop-blur">
            <tr>
              <th className="px-5 py-3 text-center" title="ຕິກ = ສົ່ງແລ້ວ (ບໍ່ສົ່ງຊ້ຳ). ເອົາຕິກອອກ = ສົ່ງໃໝ່ໄດ້">
                ສົ່ງແລ້ວ
              </th>
              <th className="px-3 py-3">ພະນັກງານ</th>
              <th className="px-3 py-3">ເບີ WhatsApp</th>
              <th className="px-3 py-3 text-right">ເງິນເດືອນ</th>
              <th className="px-3 py-3 text-right">ລາຍການຫັກ</th>
              <th className="px-3 py-3 text-right">ສຸດທິ</th>
              <th className="px-3 py-3">ສະຖານະ</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="py-12 text-center text-sm text-slate-400">
                  {needle ? `ບໍ່ພົບ "${q.trim()}"` : "ບໍ່ມີລາຍການໃນໝວດນີ້"}
                </td>
              </tr>
            )}
            {filtered.map((p) => {
              const live = liveById.get(p.id);
              const status = live?.status ?? p.status;
              const error = live?.error ?? p.error;
              const canSend = onSendOne && (status === "pending" || status === "failed");
              return (
                <tr
                  key={p.id}
                  className={cn(
                    "transition-colors hover:bg-slate-50/70",
                    status === "failed" && "bg-rose-50/40",
                    status === "sending" && "bg-sky-50/50",
                  )}
                >
                  <td className="px-5 py-3 text-center align-middle">
                    <input
                      type="checkbox"
                      checked={p.status === "sent"}
                      disabled={lockToggle || status === "sending"}
                      onChange={() => onToggleDelivered(p)}
                      className="h-4 w-4 cursor-pointer accent-emerald-600 disabled:cursor-not-allowed"
                      aria-label="ສົ່ງແລ້ວ"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ntp-50 text-xs font-semibold text-ntp-700">
                        {initial(p.data.name)}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate font-medium text-slate-800">{p.data.name}</div>
                        <div className="truncate text-xs text-slate-400">
                          {[p.data.employeeId, p.data.position].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-slate-600">+{p.data.phone}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-600">{money(p.data.baseSalary)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-400">
                    {money(p.data.totalDeductions)}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums text-ntp-700">
                    {money(p.data.netPay)}
                  </td>
                  <td className="px-3 py-3 align-middle">
                    <StatusBadge status={status} sentAt={p.sentAt} sentBy={p.sentBy} />
                    {(status === "failed" || status === "skipped") && error && (
                      <p className="mt-1 max-w-64 truncate text-xs text-rose-600" title={error}>
                        {error}
                      </p>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {canSend && (
                        <button
                          onClick={() => onSendOne(p)}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-ntp-700 transition hover:bg-ntp-50"
                          title="ສົ່ງໃຫ້ຄົນນີ້ຄົນດຽວ"
                        >
                          <IconSend className="h-3.5 w-3.5" />
                          {status === "failed" ? "ສົ່ງຄືນ" : "ສົ່ງ"}
                        </button>
                      )}
                      <a
                        href={`${BASE_PATH}/api/payslips/${p.id}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
                      >
                        <IconFile className="h-3.5 w-3.5" />
                        PDF
                      </a>
                    </div>
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
  sentAt,
  sentBy,
}: {
  status: JobResult["status"] | PayslipStatus;
  sentAt: string | null;
  sentBy: string | null;
}) {
  const map = {
    pending: ["ລໍຖ້າສົ່ງ", "bg-slate-100 text-slate-600 ring-slate-200"],
    sending: ["ກຳລັງສົ່ງ...", "bg-sky-50 text-sky-700 ring-sky-200 animate-pulse"],
    sent: ["ສົ່ງແລ້ວ", "bg-emerald-50 text-emerald-700 ring-emerald-200"],
    failed: ["ລົ້ມເຫຼວ", "bg-rose-50 text-rose-700 ring-rose-200"],
    skipped: ["ຂ້າມ", "bg-amber-50 text-amber-700 ring-amber-200"],
  } as const;
  const [label, cls] = map[status];
  const detail = status === "sent" && sentAt ? `${fmtTime(sentAt)}${sentBy ? ` · ${sentBy}` : ""}` : null;
  return (
    <span
      title={detail ?? undefined}
      className={cn(
        "inline-flex h-6 max-w-64 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-xs font-medium leading-none ring-1",
        cls,
      )}
    >
      {status === "sent" && <IconCheck className="h-3 w-3 shrink-0" />}
      {status === "failed" && <IconX className="h-3 w-3 shrink-0" />}
      <span className="shrink-0">{label}</span>
      {detail && <span className="truncate font-normal opacity-80">· {detail}</span>}
    </span>
  );
}
