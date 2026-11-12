"use client";

import { useEffect, useRef, useState } from "react";
import type { JobState } from "@/lib/payslip-job";
import type { WAState } from "@/lib/whatsapp";

const INITIAL_WA: WAState = { status: "idle", qr: null, pairingCode: null, loading: null, me: null };

/**
 * ສະຖານະ WhatsApp + job ສົ່ງ ແບບ real-time (SSE).
 * ຖ້າຫຼຸດ (server restart / recompile) EventSource ອາດຢຸດຖາວອນ ແລະ QR ຄ້າງເປັນອັນເກົ່າ
 * → ເຊື່ອມຕໍ່ໃໝ່ເອງ, ແລະ ເຊື່ອມຕໍ່ໃໝ່ທຸກຄັ້ງທີ່ກັບມາເບິ່ງ tab ນີ້.
 * ຖ້າ session ໝົດອາຍຸ (401) → ກັບໄປໜ້າ login.
 */
export function useLiveStatus() {
  const [wa, setWa] = useState<WAState>(INITIAL_WA);
  const [job, setJob] = useState<JobState | null>(null);
  const [online, setOnline] = useState(false);
  const reconnectRef = useRef<() => void>(() => {});

  useEffect(() => {
    let es: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      clearTimeout(retry);
      es?.close();
      const source = new EventSource("/api/whatsapp/events");
      es = source;
      source.onopen = () => setOnline(true);
      source.onerror = async () => {
        setOnline(false);
        if (source.readyState !== EventSource.CLOSED) return;
        const me = await fetch("/api/settings").catch(() => null);
        if (me?.status === 401) return window.location.assign("/login");
        retry = setTimeout(connect, 2000);
      };
      source.addEventListener("wa", (e) => setWa(JSON.parse((e as MessageEvent).data)));
      source.addEventListener("job", (e) => {
        const s: JobState = JSON.parse((e as MessageEvent).data);
        setJob(s.id ? s : null);
      });
    };
    reconnectRef.current = connect;

    const onVisible = () => document.visibilityState === "visible" && connect();
    document.addEventListener("visibilitychange", onVisible);
    connect();
    return () => {
      clearTimeout(retry);
      document.removeEventListener("visibilitychange", onVisible);
      es?.close();
    };
  }, []);

  return { wa, job, online, reconnect: () => reconnectRef.current() };
}

/** fetch JSON + ໂຍນ error ເປັນຂໍ້ຄວາມຈາກ server; 401 → ກັບໄປ login */
export async function api<T = unknown>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(url, {
    ...rest,
    headers: json !== undefined ? { "Content-Type": "application/json", ...rest.headers } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (res.status === 401) {
    window.location.assign("/login");
    throw new Error("ກະລຸນາ login ໃໝ່");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `ເກີດຂໍ້ຜິດພາດ (${res.status})`);
  return body as T;
}

/** ດາວໂຫລດໄຟລ໌ຈາກ API (ໃຊ້ຊື່ໄຟລ໌ຈາກ Content-Disposition) */
export async function download(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "ດາວໂຫລດບໍ່ສຳເລັດ");
  const name = res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ?? "download";
  const a = document.createElement("a");
  a.href = URL.createObjectURL(await res.blob());
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
