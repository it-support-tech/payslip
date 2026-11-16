"use client";

import { useCallback, useEffect, useState } from "react";
import { useConfirm } from "@/components/confirm-dialog";
import { Modal } from "@/components/modal";
import type { UserView } from "@/lib/users";
import { cn } from "@/lib/utils";
import { Skeleton } from "./ui";
import { api } from "./use-live-status";
import { BASE_PATH } from "@/lib/base-path";

export function UsersTab({ currentUserId, onError }: { currentUserId: string; onError: (msg: string) => void }) {
  const confirm = useConfirm();
  const [users, setUsers] = useState<UserView[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [issued, setIssued] = useState<{ username: string; password: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setUsers((await api<{ users: UserView[] }>(`${BASE_PATH}/api/users`)).users);
    } catch (e) {
      onError((e as Error).message);
    }
  }, [onError]);

  useEffect(() => {
    load();
  }, [load]);

  const patch = async (u: UserView, body: Record<string, unknown>) => {
    try {
      const r = await api<{ tempPassword?: string }>(`${BASE_PATH}/api/users/${u.id}`, { method: "PATCH", json: body });
      if (r.tempPassword) setIssued({ username: u.username, password: r.tempPassword });
      await load();
    } catch (e) {
      onError((e as Error).message);
    }
  };

  const resetPassword = async (u: UserView) => {
    const ok = await confirm({
      title: `Reset ລະຫັດຜ່ານຂອງ ${u.displayName}?`,
      message: "ລະບົບຈະສ້າງລະຫັດຊົ່ວຄາວໃໝ່ ແລະ ອອກຈາກລະບົບທຸກເຄື່ອງຂອງຜູ້ໃຊ້ນີ້. ຜູ້ໃຊ້ຕ້ອງປ່ຽນລະຫັດຕອນ login.",
      confirmText: "Reset",
      tone: "danger",
    });
    if (ok) patch(u, { resetPassword: true });
  };

  const toggleActive = async (u: UserView) => {
    const ok = await confirm({
      title: u.isActive ? `ປິດບັນຊີ ${u.displayName}?` : `ເປີດບັນຊີ ${u.displayName}?`,
      message: u.isActive ? "ຜູ້ໃຊ້ນີ້ຈະ login ບໍ່ໄດ້ ແລະ ຖືກອອກຈາກລະບົບທັນທີ." : "ຜູ້ໃຊ້ນີ້ຈະ login ໄດ້ອີກຄັ້ງ.",
      confirmText: u.isActive ? "ປິດບັນຊີ" : "ເປີດບັນຊີ",
      tone: u.isActive ? "danger" : "primary",
    });
    if (ok) patch(u, { isActive: !u.isActive });
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="font-semibold">ຜູ້ໃຊ້ລະບົບ</h2>
          <p className="text-xs text-slate-500">admin ຈັດການບັນຊີໄດ້ · hr ສົ່ງ payslip ໄດ້</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="rounded-lg bg-ntp-600 px-4 py-2 text-sm font-medium text-white hover:bg-ntp-700"
        >
          + ເພີ່ມຜູ້ໃຊ້
        </button>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs text-slate-500">
          <tr>
            <th className="px-5 py-3">ຜູ້ໃຊ້</th>
            <th className="px-3 py-3">ສິດ</th>
            <th className="px-3 py-3">ສະຖານະ</th>
            <th className="px-3 py-3">ສ້າງເມື່ອ</th>
            <th className="px-5 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {!users &&
            Array.from({ length: 3 }, (_, i) => (
              <tr key={i}>
                <td colSpan={5} className="px-5 py-3">
                  <Skeleton className="h-9" />
                </td>
              </tr>
            ))}
          {users?.map((u) => {
            const self = u.id === currentUserId;
            return (
              <tr key={u.id} className={cn(!u.isActive && "bg-slate-50 text-slate-400")}>
                <td className="px-5 py-3">
                  <div className="font-medium text-slate-800">
                    {u.displayName}
                    {self && <span className="ml-2 text-xs font-normal text-ntp-600">(ທ່ານ)</span>}
                  </div>
                  <div className="font-mono text-xs text-slate-400">{u.username}</div>
                </td>
                <td className="px-3 py-3">
                  <select
                    value={u.role}
                    disabled={self}
                    onChange={(e) => patch(u, { role: e.target.value })}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs disabled:opacity-60"
                  >
                    <option value="hr">hr</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
                <td className="px-3 py-3 text-xs">
                  {!u.isActive ? (
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-slate-600">ປິດໃຊ້ງານ</span>
                  ) : u.lockedUntil ? (
                    <span className="rounded-full bg-rose-50 px-2 py-0.5 text-rose-700">ຖືກລັອກ</span>
                  ) : u.mustChangePassword ? (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">ລໍຖ້າປ່ຽນລະຫັດ</span>
                  ) : (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">ໃຊ້ງານ</span>
                  )}
                </td>
                <td className="px-3 py-3 text-xs text-slate-500">{new Date(u.createdAt).toLocaleDateString("en-GB")}</td>
                <td className="whitespace-nowrap px-5 py-3 text-right text-xs font-medium">
                  {u.lockedUntil && (
                    <button onClick={() => patch(u, { unlock: true })} className="mr-4 text-ntp-700 hover:underline">
                      ປົດລັອກ
                    </button>
                  )}
                  {!self && (
                    <>
                      <button onClick={() => resetPassword(u)} className="text-flame-600 hover:underline">
                        Reset ລະຫັດ
                      </button>
                      <button onClick={() => toggleActive(u)} className="ml-4 text-slate-600 hover:underline">
                        {u.isActive ? "ປິດບັນຊີ" : "ເປີດບັນຊີ"}
                      </button>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <CreateUserModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={async (username, password) => {
          setCreating(false);
          setIssued({ username, password });
          await load();
        }}
      />

      <Modal open={!!issued} onClose={() => setIssued(null)} title="ລະຫັດຜ່ານຊົ່ວຄາວ">
        {issued && <IssuedPassword {...issued} onClose={() => setIssued(null)} />}
      </Modal>
    </section>
  );
}

function IssuedPassword({ username, password, onClose }: { username: string; password: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        ແຈ້ງຂໍ້ມູນນີ້ໃຫ້ຜູ້ໃຊ້ (ສະແດງ<b>ຄັ້ງດຽວ</b>). ຜູ້ໃຊ້ຈະຖືກບັງຄັບໃຫ້ປ່ຽນລະຫັດຕອນ login ຄັ້ງທຳອິດ.
      </p>
      <div className="space-y-2 rounded-xl bg-ntp-50 p-4 font-mono text-sm">
        <div>
          <span className="text-slate-500">username:</span> <b>{username}</b>
        </div>
        <div>
          <span className="text-slate-500">password:</span> <b className="tracking-wider">{password}</b>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button
          onClick={() => navigator.clipboard.writeText(password).then(() => setCopied(true))}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          {copied ? "✓ ສຳເນົາແລ້ວ" : "ສຳເນົາລະຫັດ"}
        </button>
        <button onClick={onClose} className="rounded-lg bg-ntp-600 px-4 py-2 text-sm font-medium text-white hover:bg-ntp-700">
          ປິດ
        </button>
      </div>
    </div>
  );
}

function CreateUserModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (username: string, password: string) => void;
}) {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<"hr" | "admin">("hr");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ user: UserView; tempPassword: string }>(`${BASE_PATH}/api/users`, {
        method: "POST",
        json: { username, displayName, role },
      });
      setUsername("");
      setDisplayName("");
      setRole("hr");
      onCreated(r.user.username, r.tempPassword);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const input =
    "w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-ntp-500 focus:ring-4 focus:ring-ntp-100";

  return (
    <Modal open={open} onClose={onClose} title="ເພີ່ມຜູ້ໃຊ້ໃໝ່">
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">ຊື່ຜູ້ໃຊ້ (username)</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            placeholder="ຊື່ຜູ້ໃຊ້"
            className={cn(input, "font-mono")}
            required
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">ຊື່ທີ່ສະແດງ</span>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={input} required />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">ສິດ</span>
          <select value={role} onChange={(e) => setRole(e.target.value as "hr" | "admin")} className={input}>
            <option value="hr">hr</option>
            <option value="admin">admin</option>
          </select>
        </label>
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-ntp-600 py-2.5 text-sm font-semibold text-white hover:bg-ntp-700 disabled:bg-slate-300"
        >
          {busy ? "ກຳລັງສ້າງ..." : "ສ້າງ ແລະ ອອກລະຫັດຊົ່ວຄາວ"}
        </button>
      </form>
    </Modal>
  );
}
