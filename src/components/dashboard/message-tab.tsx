"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_MESSAGE_LENGTH, MESSAGE_PLACEHOLDERS, type MessageFields, renderMessage } from "@/lib/message";
import { BASE_PATH } from "@/lib/base-path";
import { Skeleton } from "./ui";
import { api } from "./use-live-status";

const SAMPLE_EMPLOYEE: MessageFields = {
  employeeId: "NTP/0001",
  name: "ສົມສັກ ພົມມະວົງ",
  position: "ພະນັກງານ",
  department: "HR",
  month: "10/2026",
  netPay: 8910000,
};

export function MessageTemplateCard({ sample }: { sample?: MessageFields }) {
  const [saved, setSaved] = useState("");
  const [text, setText] = useState("");
  const [defaultText, setDefaultText] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [err, setErr] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    api<{ messageTemplate: string; defaultTemplate: string }>(`${BASE_PATH}/api/settings`)
      .then((j) => {
        setSaved(j.messageTemplate);
        setText(j.messageTemplate);
        setDefaultText(j.defaultTemplate);
        setLoaded(true);
      })
      .catch(() => setErr("ໂຫລດຂໍ້ຄວາມບໍ່ສຳເລັດ — ກະລຸນາ refresh ໜ້າເວັບ"));
  }, []);

  const dirty = text !== saved;

  const insert = (key: string) => {
    const el = ref.current;
    const token = `{${key}}`;
    if (!el) return setText((t) => t + token);
    const { selectionStart: a, selectionEnd: b } = el;
    setText(text.slice(0, a) + token + text.slice(b));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a + token.length, a + token.length);
    });
  };

  const save = async () => {
    setStatus("saving");
    setErr(null);
    let j: { messageTemplate: string };
    try {
      j = await api(`${BASE_PATH}/api/settings`, { method: "PUT", json: { messageTemplate: text } });
    } catch (e) {
      setErr((e as Error).message);
      setStatus("idle");
      return;
    }
    setSaved(j.messageTemplate);
    setText(j.messageTemplate);
    setStatus("saved");
    setTimeout(() => setStatus("idle"), 2000);
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">ຂໍ້ຄວາມ WhatsApp</h2>
        {dirty && <span className="text-xs text-flame-600">ຍັງບໍ່ໄດ້ບັນທຶກ</span>}
      </div>
      <p className="mt-1 text-xs text-slate-500">
        ຂໍ້ຄວາມທີ່ສົ່ງພ້ອມໄຟລ໌ PDF. ກົດປ້າຍລຸ່ມນີ້ເພື່ອແຊກຂໍ້ມູນຂອງແຕ່ລະຄົນ.
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {MESSAGE_PLACEHOLDERS.map((p) => (
          <button
            key={p.key}
            onClick={() => insert(p.key)}
            title={p.label}
            className="rounded-md bg-ntp-50 px-2 py-1 text-xs font-medium text-ntp-700 ring-1 ring-ntp-100 transition hover:bg-ntp-100"
          >
            {`{${p.key}}`}
          </button>
        ))}
      </div>

      {!loaded && !err ? (
        <Skeleton className="mt-3 h-44" />
      ) : (
      <textarea
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        maxLength={MAX_MESSAGE_LENGTH}
        className="mt-3 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm leading-relaxed outline-none focus:border-ntp-500 focus:ring-2 focus:ring-ntp-100"
      />
      )}

      <p className="mt-3 mb-1 text-xs font-medium text-slate-500">
        ຕົວຢ່າງ{sample ? ` (${sample.name})` : ""}:
      </p>
      <div className="whitespace-pre-wrap rounded-lg rounded-tl-none bg-emerald-50 px-3 py-2 text-sm text-slate-800 ring-1 ring-emerald-100">
        {renderMessage(text, sample ?? SAMPLE_EMPLOYEE) || "—"}
      </div>

      {err && <p className="mt-2 text-xs text-rose-600">{err}</p>}

      <div className="mt-4 flex justify-between gap-2">
        <button
          onClick={() => setText(defaultText)}
          disabled={!defaultText || text === defaultText}
          className="text-xs text-slate-500 hover:text-slate-700 disabled:opacity-40"
        >
          ຄືນຄ່າເລີ່ມຕົ້ນ
        </button>
        <div className="flex gap-2">
          {dirty && (
            <button
              onClick={() => setText(saved)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              ຍົກເລີກ
            </button>
          )}
          <button
            onClick={save}
            disabled={!loaded || !dirty || !text.trim() || status === "saving"}
            className="rounded-lg bg-ntp-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-ntp-700 disabled:bg-slate-300"
          >
            {status === "saving" ? "ກຳລັງບັນທຶກ..." : status === "saved" ? "✓ ບັນທຶກແລ້ວ" : "ບັນທຶກ"}
          </button>
        </div>
      </div>
    </section>
  );
}
