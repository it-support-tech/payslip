"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const rules = [
  { test: (p: string) => p.length >= 8, label: "ຢ່າງໜ້ອຍ 8 ຕົວອັກສອນ" },
  { test: (p: string) => /[A-Za-z]/.test(p) && /\d/.test(p), label: "ມີທັງຕົວອັກສອນ ແລະ ຕົວເລກ" },
];

export function PasswordForm({ onDone, submitText = "ປ່ຽນລະຫັດຜ່ານ" }: { onDone: () => void; submitText?: string }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mismatch = confirm.length > 0 && confirm !== next;
  const valid = current && rules.every((r) => r.test(next)) && next === confirm;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    });
    setBusy(false);
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error ?? "ປ່ຽນລະຫັດບໍ່ສຳເລັດ");
    onDone();
  };

  const input =
    "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-ntp-500 focus:ring-4 focus:ring-ntp-100";

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">ລະຫັດຜ່ານປັດຈຸບັນ</span>
        <input
          type={show ? "text" : "password"}
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          autoComplete="current-password"
          className={input}
          required
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">ລະຫັດຜ່ານໃໝ່</span>
        <input
          type={show ? "text" : "password"}
          value={next}
          onChange={(e) => setNext(e.target.value)}
          autoComplete="new-password"
          className={input}
          required
        />
      </label>
      <ul className="space-y-1 text-xs">
        {rules.map((r) => (
          <li key={r.label} className={cn("flex items-center gap-1.5", r.test(next) ? "text-emerald-600" : "text-slate-400")}>
            <span>{r.test(next) ? "✓" : "○"}</span>
            {r.label}
          </li>
        ))}
      </ul>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">ຢືນຢັນລະຫັດຜ່ານໃໝ່</span>
        <input
          type={show ? "text" : "password"}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          className={cn(input, mismatch && "border-rose-300 focus:border-rose-400 focus:ring-rose-100")}
          required
        />
        {mismatch && <span className="mt-1 block text-xs text-rose-600">ລະຫັດຜ່ານບໍ່ກົງກັນ</span>}
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="accent-ntp-600" />
        ສະແດງລະຫັດຜ່ານ
      </label>

      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <button
        type="submit"
        disabled={!valid || busy}
        className="w-full rounded-xl bg-gradient-to-r from-ntp-700 to-ntp-500 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-ntp-800 hover:to-ntp-600 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300"
      >
        {busy ? "ກຳລັງບັນທຶກ..." : submitText}
      </button>
      <p className="text-center text-xs text-slate-400">ຫຼັງປ່ຽນລະຫັດ ທຸກເຄື່ອງອື່ນທີ່ login ໄວ້ຈະຖືກອອກຈາກລະບົບ</p>
    </form>
  );
}
