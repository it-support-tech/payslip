"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ConfirmProvider } from "@/components/confirm-dialog";
import { Modal } from "@/components/modal";
import { PasswordForm } from "@/components/password-form";
import { COMPANY } from "@/config";
import type { SessionUser } from "@/lib/auth";
import type { PeriodSummary } from "@/lib/payslips";
import { cn, monthPeriod } from "@/lib/utils";
import { HistoryTab } from "./history-tab";
import { MessageTemplateCard } from "./message-tab";
import { SendTab } from "./send-tab";
import { api, useLiveStatus } from "./use-live-status";
import { UsersTab } from "./users-tab";
import { WhatsAppCard } from "./whatsapp-tab";
import { BASE_PATH } from "@/lib/base-path";

type Tab = "send" | "history" | "message" | "whatsapp" | "users";

export function Dashboard({ user }: { user: SessionUser }) {
  return (
    <ConfirmProvider>
      <Shell user={user} />
    </ConfirmProvider>
  );
}

function Shell({ user }: { user: SessionUser }) {
  const { wa, job, online, reconnect } = useLiveStatus();
  const [tab, setTab] = useState<Tab>("send");
  const [periods, setPeriods] = useState<PeriodSummary[] | null>(null);
  const [period, setPeriod] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const connected = wa.status === "ready";
  const isAdmin = user.role === "admin";

  const loadPeriods = useCallback(async () => {
    try {
      const list = (await api<{ periods: PeriodSummary[] }>(`${BASE_PATH}/api/periods`)).periods;
      setPeriods(list);
      setPeriod((cur) => cur ?? list[0]?.period ?? monthPeriod());
    } catch (e) {
      setError((e as Error).message);
      setPeriods([]);
    }
  }, []);

  useEffect(() => {
    loadPeriods();
  }, [loadPeriods]);

  const tabs: { id: Tab; label: string; badge?: React.ReactNode }[] = [
    { id: "send", label: "ສົ່ງ Payslip" },
    { id: "history", label: "ປະຫວັດ" },
    { id: "message", label: "ຂໍ້ຄວາມ WhatsApp" },
    {
      id: "whatsapp",
      label: "WhatsApp",
      badge: <span className={cn("h-2 w-2 rounded-full", connected ? "bg-emerald-500" : "animate-pulse bg-rose-500")} />,
    },
    ...(isAdmin ? [{ id: "users" as Tab, label: "ຜູ້ໃຊ້" }] : []),
  ];

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-20 bg-gradient-to-r from-ntp-950 to-ntp-600 text-white shadow-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${BASE_PATH}/logo.png`} alt={COMPANY.shortName} className="h-11 w-11 shrink-0 object-contain drop-shadow" />
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold leading-tight">ລະບົບສົ່ງໃບແຈ້ງເງິນເດືອນ</h1>
              <p className="truncate text-xs text-ntp-100">{COMPANY.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setTab("whatsapp")}
              className="hidden items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs ring-1 ring-white/20 transition hover:bg-white/20 sm:inline-flex"
            >
              <span className={cn("h-2 w-2 rounded-full", connected ? "bg-emerald-400" : "animate-pulse bg-rose-400")} />
              WhatsApp {connected ? "Connected" : "Disconnected"}
            </button>
            {!online && <span className="text-xs text-ntp-100">ກຳລັງເຊື່ອມຕໍ່...</span>}
            <UserMenu user={user} />
          </div>
        </div>
        <div className="h-1 bg-gradient-to-r from-flame-600 via-flame-500 to-flame-300" />
      </header>

      <nav className="sticky top-[67px] z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-6">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "relative inline-flex items-center gap-2 whitespace-nowrap px-4 py-3.5 text-sm font-medium transition",
                tab === t.id ? "text-ntp-700" : "text-slate-500 hover:text-slate-800",
              )}
            >
              {t.label}
              {t.badge}
              {tab === t.id && (
                <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-gradient-to-r from-ntp-600 to-flame-500" />
              )}
            </button>
          ))}
        </div>
      </nav>

      <div className="mx-auto max-w-7xl space-y-6 px-6 py-6">
        {error && (
          <div className="flex items-start justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <span>⚠️ {error}</span>
            <button onClick={() => setError(null)} className="ml-4 text-rose-400 hover:text-rose-600">
              ✕
            </button>
          </div>
        )}

        {tab === "send" && periods && (
          <SendTab
            periods={periods}
            period={period}
            onSelectPeriod={setPeriod}
            onPeriodsChanged={loadPeriods}
            job={job}
            connected={connected}
            onError={setError}
          />
        )}
        {tab === "history" && periods && (
          <HistoryTab
            periods={periods}
            isAdmin={isAdmin}
            onOpen={(p) => {
              setPeriod(p);
              setTab("send");
            }}
            onChanged={loadPeriods}
            onError={setError}
          />
        )}
        {tab === "message" && (
          <div className="mx-auto max-w-2xl">
            <MessageTemplateCard />
          </div>
        )}
        {tab === "whatsapp" && (
          <div className="mx-auto max-w-md">
            <WhatsAppCard wa={wa} onReconnect={reconnect} />
          </div>
        )}
        {tab === "users" && isAdmin && <UsersTab currentUserId={user.id} onError={setError} />}
      </div>
    </main>
  );
}

function UserMenu({ user }: { user: SessionUser }) {
  const [open, setOpen] = useState(false);
  const [changing, setChanging] = useState(false);
  const [changed, setChanged] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const logout = async () => {
    await fetch(`${BASE_PATH}/api/auth/logout`, { method: "POST" });
    window.location.assign(`${BASE_PATH}/login`);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full bg-white/10 py-1 pl-1 pr-3 ring-1 ring-white/20 transition hover:bg-white/20"
      >
        <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-flame-400 to-flame-600 text-xs font-bold">
          {[...user.displayName][0]?.toUpperCase()}
        </span>
        <span className="max-w-32 truncate text-sm">{user.displayName}</span>
        <span className="text-xs opacity-70">▾</span>
      </button>
      {open && (
        <div className="animate-pop-in absolute right-0 mt-2 w-56 overflow-hidden rounded-xl bg-white text-slate-700 shadow-xl ring-1 ring-slate-200">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="truncate text-sm font-semibold text-slate-900">{user.displayName}</p>
            <p className="font-mono text-xs text-slate-400">
              {user.username} · {user.role}
            </p>
          </div>
          <button
            onClick={() => {
              setOpen(false);
              setChanged(false);
              setChanging(true);
            }}
            className="block w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50"
          >
            🔑 ປ່ຽນລະຫັດຜ່ານ
          </button>
          <button onClick={logout} className="block w-full px-4 py-2.5 text-left text-sm text-rose-600 hover:bg-rose-50">
            ↪ ອອກຈາກລະບົບ
          </button>
        </div>
      )}
      <Modal open={changing} onClose={() => setChanging(false)} title="ປ່ຽນລະຫັດຜ່ານ">
        {changed ? (
          <div className="space-y-4 text-center">
            <p className="text-4xl">✅</p>
            <p className="text-sm text-slate-600">ປ່ຽນລະຫັດຜ່ານສຳເລັດ</p>
            <button
              onClick={() => setChanging(false)}
              className="rounded-lg bg-ntp-600 px-5 py-2 text-sm font-medium text-white hover:bg-ntp-700"
            >
              ປິດ
            </button>
          </div>
        ) : (
          <PasswordForm onDone={() => setChanged(true)} />
        )}
      </Modal>
    </div>
  );
}
