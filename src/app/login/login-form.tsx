"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { BASE_PATH } from "@/lib/base-path";

export function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`${BASE_PATH}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (res.ok) return window.location.assign(`${BASE_PATH}/`);
    setError((await res.json().catch(() => ({}))).error ?? "ເຂົ້າສູ່ລະບົບບໍ່ສຳເລັດ");
    setBusy(false);
  };

  const input =
    "w-full rounded-xl border border-slate-200 bg-slate-50/60 py-3 pl-11 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-ntp-500 focus:bg-white focus:ring-4 focus:ring-ntp-100";

  return (
    <form onSubmit={submit} className="space-y-5">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">ຊື່ຜູ້ໃຊ້</span>
        <div className="relative">
          <svg className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21a8 8 0 0 1 16 0" strokeLinecap="round" />
          </svg>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
            required
            placeholder="username"
            className={input}
          />
        </div>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">ລະຫັດຜ່ານ</span>
        <div className="relative">
          <svg className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="4" y="10" width="16" height="11" rx="2.5" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" strokeLinecap="round" />
          </svg>
          <input
            type={show ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            placeholder="••••••••"
            className={cn(input, "pr-16")}
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100"
          >
            {show ? "ເຊື່ອງ" : "ສະແດງ"}
          </button>
        </div>
      </label>

      {error && (
        <div className="animate-pop-in flex items-start gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-100">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-ntp-700 to-ntp-500 py-3 text-sm font-semibold text-white shadow-lg shadow-ntp-600/25 transition hover:shadow-ntp-600/40 disabled:opacity-70"
      >
        <span className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-flame-600 via-flame-500 to-flame-300 opacity-0 transition group-hover:opacity-100" />
        {busy ? "ກຳລັງເຂົ້າສູ່ລະບົບ..." : "ເຂົ້າສູ່ລະບົບ"}
      </button>
    </form>
  );
}
