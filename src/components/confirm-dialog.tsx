"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Tone = "primary" | "danger";

export interface ConfirmOptions {
  title: string;
  message?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  tone?: Tone;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm ຕ້ອງໃຊ້ພາຍໃນ <ConfirmProvider>");
  return ctx;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((o) => {
    setOpts(o);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = useCallback((ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOpts(null);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {opts && <Dialog opts={opts} onClose={close} />}
    </ConfirmContext.Provider>
  );
}

function Dialog({ opts, onClose }: { opts: ConfirmOptions; onClose: (ok: boolean) => void }) {
  const okRef = useRef<HTMLButtonElement>(null);
  const tone = opts.tone ?? "primary";

  useEffect(() => {
    okRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="animate-fade-in absolute inset-0 bg-ntp-950/50 backdrop-blur-sm" onClick={() => onClose(false)} />
      <div className="animate-pop-in relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="h-1 bg-gradient-to-r from-flame-600 via-flame-500 to-flame-300" />
        <div className="p-6">
          <div className="flex gap-4">
            <div
              className={cn(
                "grid h-12 w-12 shrink-0 place-items-center rounded-full",
                tone === "danger" ? "bg-rose-50 text-rose-600" : "bg-ntp-50 text-ntp-600",
              )}
            >
              {tone === "danger" ? <IconWarning className="h-6 w-6" /> : <IconSend className="h-6 w-6" />}
            </div>
            <div className="min-w-0 pt-1">
              <h3 className="text-base font-semibold text-slate-900">{opts.title}</h3>
              {opts.message && <div className="mt-1.5 text-sm leading-relaxed text-slate-500">{opts.message}</div>}
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button
              onClick={() => onClose(false)}
              className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              {opts.cancelText ?? "ຍົກເລີກ"}
            </button>
            <button
              ref={okRef}
              onClick={() => onClose(true)}
              className={cn(
                "rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition focus:outline-none focus:ring-2 focus:ring-offset-2",
                tone === "danger"
                  ? "bg-rose-600 hover:bg-rose-700 focus:ring-rose-300"
                  : "bg-gradient-to-r from-ntp-700 to-ntp-500 hover:from-ntp-800 hover:to-ntp-600 focus:ring-ntp-300",
              )}
            >
              {opts.confirmText ?? "ຕົກລົງ"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const IconSend = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" />
  </svg>
);
const IconWarning = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01" />
  </svg>
);
