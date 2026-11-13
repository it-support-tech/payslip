"use client";

import { useConfirm } from "@/components/confirm-dialog";
import type { PeriodSummary } from "@/lib/payslips";
import { api, download } from "./use-live-status";
import { BASE_PATH } from "@/lib/base-path";

export function HistoryTab({
  periods,
  isAdmin,
  onOpen,
  onChanged,
  onError,
}: {
  periods: PeriodSummary[];
  isAdmin: boolean;
  onOpen: (period: string) => void;
  onChanged: () => Promise<void>;
  onError: (msg: string) => void;
}) {
  const confirm = useConfirm();

  const remove = async (p: PeriodSummary) => {
    const ok = await confirm({
      title: `ລຶບງວດ ${p.period}?`,
      message: `ຂໍ້ມູນ ${p.total} ລາຍການ (ລວມທັງປະຫວັດການສົ່ງ ${p.sent} ຄົນ) ຈະຖືກລຶບຖາວອນ ແລະ ກູ້ຄືນບໍ່ໄດ້.`,
      confirmText: "ລຶບຖາວອນ",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await api(`${BASE_PATH}/api/periods?period=${encodeURIComponent(p.period)}`, { method: "DELETE" });
      await onChanged();
    } catch (e) {
      onError((e as Error).message);
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="font-semibold">ປະຫວັດການສົ່ງ</h2>
        <p className="text-xs text-slate-500">ສະຫຼຸບແຕ່ລະງວດ — ກົດ &quot;ເປີດ&quot; ເພື່ອເບິ່ງລາຍຊື່ ແລະ ສົ່ງຕໍ່</p>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs text-slate-500">
          <tr>
            <th className="px-5 py-3">ງວດ</th>
            <th className="px-3 py-3 text-right">ທັງໝົດ</th>
            <th className="px-3 py-3 text-right">ສົ່ງແລ້ວ</th>
            <th className="px-3 py-3 text-right">ລໍຖ້າ</th>
            <th className="px-3 py-3 text-right">ລົ້ມເຫຼວ</th>
            <th className="w-48 px-3 py-3">ຄວາມຄືບໜ້າ</th>
            <th className="px-3 py-3">ອັບເດດລ່າສຸດ</th>
            <th className="px-5 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {periods.length === 0 && (
            <tr>
              <td colSpan={8} className="py-12 text-center text-sm text-slate-400">
                ຍັງບໍ່ມີຂໍ້ມູນ — ນຳເຂົ້າໄຟລ໌ Excel ໃນແຖບ &quot;ສົ່ງ Payslip&quot;
              </td>
            </tr>
          )}
          {periods.map((p) => {
            const pct = p.total ? Math.round((p.sent / p.total) * 100) : 0;
            return (
              <tr key={p.period} className="hover:bg-slate-50/70">
                <td className="px-5 py-3 font-semibold text-slate-800">{p.period}</td>
                <td className="px-3 py-3 text-right tabular-nums">{p.total}</td>
                <td className="px-3 py-3 text-right tabular-nums text-emerald-600">{p.sent}</td>
                <td className="px-3 py-3 text-right tabular-nums text-ntp-600">{p.pending}</td>
                <td className="px-3 py-3 text-right tabular-nums text-rose-600">{p.failed || "—"}</td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-9 text-right text-xs text-slate-500">{pct}%</span>
                  </div>
                </td>
                <td className="px-3 py-3 text-xs text-slate-500">{new Date(p.lastActivity).toLocaleString("en-GB")}</td>
                <td className="whitespace-nowrap px-5 py-3 text-right text-xs font-medium">
                  <button onClick={() => onOpen(p.period)} className="text-ntp-700 hover:underline">
                    ເປີດ
                  </button>
                  <button
                    onClick={() =>
                      download(`${BASE_PATH}/api/report?period=${encodeURIComponent(p.period)}`).catch((e) => onError(e.message))
                    }
                    className="ml-4 text-slate-600 hover:underline"
                  >
                    ລາຍງານ
                  </button>
                  {isAdmin && (
                    <button onClick={() => remove(p)} className="ml-4 text-rose-600 hover:underline">
                      ລຶບ
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
