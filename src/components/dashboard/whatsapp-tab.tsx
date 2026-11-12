"use client";

import { useEffect, useState } from "react";
import { useConfirm } from "@/components/confirm-dialog";
import type { WAState } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";
import { IconCheck, Spinner } from "./ui";

// WhatsApp ປ່ຽນ QR ທຸກ ~20 ວິນາທີ; ຖ້າບໍ່ໄດ້ອັນໃໝ່ເກີນເວລານີ້ ຖືວ່າ QR ໝົດອາຍຸ
const QR_STALE_MS = 45_000;

export function WhatsAppCard({ wa, onReconnect }: { wa: WAState; onReconnect: () => void }) {
  const confirm = useConfirm();
  const [qrAt, setQrAt] = useState(0);
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (wa.qr) setQrAt(Date.now());
  }, [wa.qr]);
  useEffect(() => {
    if (!wa.qr) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [wa.qr]);
  const qrStale = !!wa.qr && now - qrAt > QR_STALE_MS;
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"qr" | "phone">("qr");
  const [pairPhone, setPairPhone] = useState("");
  const [pairError, setPairError] = useState<string | null>(null);

  const requestCode = async () => {
    setBusy(true);
    setPairError(null);
    const res = await fetch("/api/whatsapp/pair", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: pairPhone }),
    });
    if (!res.ok) setPairError((await res.json()).error);
    setBusy(false);
  };
  const connected = wa.status === "ready";
  const statusText: Record<WAState["status"], string> = {
    idle: "ກຳລັງກຽມ...",
    initializing: "ກຳລັງເປີດ WhatsApp Web...",
    qr: "ລໍຖ້າສະແກນ QR Code",
    authenticated: "ຢືນຢັນຕົວຕົນແລ້ວ, ກຳລັງໂຫລດ...",
    ready: "Connected",
    disconnected: "Disconnected",
    error: "ເກີດຂໍ້ຜິດພາດ",
  };

  const logout = async () => {
    const ok = await confirm({
      title: "Logout WhatsApp?",
      message: "ລະບົບຈະລ້າງ session ອອກ ແລະ ຕ້ອງສະແກນ QR ໃໝ່ເພື່ອເຊື່ອມຕໍ່ອີກຄັ້ງ.",
      confirmText: "Logout",
      tone: "danger",
    });
    if (!ok) return;
    setBusy(true);
    await fetch("/api/whatsapp/logout", { method: "POST" });
    setBusy(false);
  };

  const resetSession = async () => {
    const ok = await confirm({
      title: "ລ້າງ session WhatsApp?",
      message: "ລະບົບຈະປິດການເຊື່ອມຕໍ່ປັດຈຸບັນ ແລະ ສະແດງ QR Code ໃໝ່ໃຫ້ສະແກນ.",
      confirmText: "ລ້າງ session",
      tone: "danger",
    });
    if (!ok) return;
    setBusy(true);
    await fetch("/api/whatsapp/reset", { method: "POST" });
    setBusy(false);
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">WhatsApp Connection</h2>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
            connected
              ? "bg-ntp-50 text-ntp-700 ring-1 ring-ntp-200"
              : "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              connected ? "bg-ntp-500" : "bg-slate-400",
              !connected && "animate-pulse",
            )}
          />
          {connected ? "Connected" : "Disconnected"}
        </span>
      </div>

      <div className="mt-6 flex flex-col items-center text-center">
        {connected ? (
          <>
            <div className="grid h-24 w-24 place-items-center rounded-full bg-ntp-50 ring-8 ring-ntp-50/50">
              <IconCheck className="h-12 w-12 text-ntp-600" />
            </div>
            <p className="mt-4 font-medium">{wa.me?.name ?? "WhatsApp"}</p>
            {wa.me?.phone && (
              <p className="text-sm text-slate-500">+{wa.me.phone}</p>
            )}
            <button
              onClick={logout}
              disabled={busy}
              className="mt-5 rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              {busy ? "ກຳລັງອອກ..." : "Logout / ປ່ຽນບັນຊີ"}
            </button>
          </>
        ) : wa.qr ? (
          <>
            <div className="mb-4 inline-flex rounded-lg bg-slate-100 p-1 text-xs font-medium">
              {(["qr", "phone"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={cn(
                    "rounded-md px-3 py-1.5 transition",
                    mode === m
                      ? "bg-white text-ntp-700 shadow-sm"
                      : "text-slate-500",
                  )}
                >
                  {m === "qr" ? "ສະແກນ QR" : "ໃຊ້ເບີໂທ"}
                </button>
              ))}
            </div>
            {mode === "qr" ? (
              <>
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={wa.qr}
                    alt="WhatsApp QR Code"
                    className={cn(
                      "h-56 w-56 rounded-xl border border-slate-200 p-2 transition",
                      qrStale && "opacity-20 blur-sm",
                    )}
                  />
                  {qrStale && (
                    <button
                      onClick={onReconnect}
                      className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm font-medium text-ntp-700"
                    >
                      <span className="text-2xl">↻</span>
                      QR ໝົດອາຍຸ — ກົດເພື່ອໂຫລດໃໝ່
                    </button>
                  )}
                </div>
                {!qrStale && now > 0 && (
                  <p className="mt-2 text-xs text-slate-400">
                    QR ຈະປ່ຽນອັດຕະໂນມັດ · ອັບເດດ {Math.max(0, Math.round((now - qrAt) / 1000))} ວິນາທີກ່ອນ
                  </p>
                )}
                <ol className="mt-4 space-y-1 text-left text-xs text-slate-500">
                  <li>1. ເປີດ WhatsApp ໃນໂທລະສັບ</li>
                  <li>2. ໄປທີ່ Settings → Linked Devices → Link a device</li>
                  <li>3. ສະແກນ QR Code ນີ້</li>
                </ol>
              </>
            ) : (
              <div className="w-full space-y-3">
                <div className="flex gap-2">
                  <input
                    value={pairPhone}
                    onChange={(e) => setPairPhone(e.target.value)}
                    placeholder="020 xxxx xxxx"
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-ntp-500 focus:ring-2 focus:ring-ntp-100"
                  />
                  <button
                    onClick={requestCode}
                    disabled={busy || !pairPhone}
                    className="rounded-lg bg-ntp-600 px-3 py-2 text-sm font-medium text-white hover:bg-ntp-700 disabled:bg-slate-300"
                  >
                    {busy ? "..." : "ຂໍລະຫັດ"}
                  </button>
                </div>
                {pairError && (
                  <p className="text-xs text-rose-600">{pairError}</p>
                )}
                {wa.pairingCode && (
                  <p className="rounded-xl bg-ntp-50 py-4 font-mono text-3xl font-bold tracking-[0.2em] text-ntp-800">
                    {wa.pairingCode.slice(0, 4)}-{wa.pairingCode.slice(4)}
                  </p>
                )}
                <ol className="space-y-1 text-left text-xs text-slate-500">
                  <li>1. ກອກເບີ WhatsApp ຂອງ HR ແລ້ວກົດ &quot;ຂໍລະຫັດ&quot;</li>
                  <li>
                    2. ໃນໂທລະສັບ: Linked Devices → Link a device → Link with
                    phone number instead
                  </li>
                  <li>3. ກອກລະຫັດ 8 ຕົວທີ່ສະແດງຢູ່ນີ້</li>
                </ol>
              </div>
            )}
          </>
        ) : (
          <div className="flex h-56 w-56 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50">
            {wa.status === "error" ? (
              <span className="text-3xl">⚠️</span>
            ) : (
              <Spinner className="h-8 w-8 text-ntp-600" />
            )}
            <p className="mt-3 text-sm text-slate-500">
              {statusText[wa.status]}
            </p>
            {wa.loading != null && wa.status !== "error" && (
              <p className="mt-1 text-xs font-medium text-ntp-600">
                {wa.loading}%
              </p>
            )}
          </div>
        )}
        {wa.status === "error" && wa.error && (
          <p className="mt-3 text-xs text-rose-600">{wa.error}</p>
        )}
        {!connected && wa.status !== "qr" && wa.status !== "idle" && (
          <button
            onClick={resetSession}
            disabled={busy}
            className="mt-4 rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            {busy ? "ກຳລັງລ້າງ..." : "ລ້າງ session ແລ້ວສະແກນໃໝ່"}
          </button>
        )}
      </div>
    </section>
  );
}
