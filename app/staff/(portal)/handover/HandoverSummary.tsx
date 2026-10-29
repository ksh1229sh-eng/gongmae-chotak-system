"use client";

import { createContext, useContext, useState } from "react";

type Entry = { lines?: string[]; notice?: string };
type State = {
  entries: Record<string, Entry>;
  busy: boolean;
  error: string;
  done: boolean;
  truncated: number;
  run: () => Promise<void>;
};

const Ctx = createContext<State | null>(null);

function useSummary() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("SummaryProvider 안에서만 쓸 수 있습니다.");
  return ctx;
}

// 인수인계 화면 전체를 감싸서, 위쪽 버튼이 만든 요약을 각 사건 카드가 받아 보여 줍니다.
// 요약은 저장하지 않으므로 화면을 새로고침하면 사라집니다.
export function SummaryProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [truncated, setTruncated] = useState(0);

  async function run() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/staff/handover-summary", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "요약을 만들지 못했어요.");
        return;
      }
      setEntries(data.summaries ?? {});
      setTruncated(data.truncated ? data.total : 0);
      setDone(true);
    } catch {
      setError("서버와 연결하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return <Ctx.Provider value={{ entries, busy, error, done, truncated, run }}>{children}</Ctx.Provider>;
}

export function SummaryButton() {
  const { busy, error, done, truncated, run } = useSummary();
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {busy ? "요약 만드는 중… (잠시 걸릴 수 있어요)" : done ? "AI 요약 다시 만들기" : "AI 요약 만들기"}
        </button>
        {done && !busy && (
          <span role="status" className="text-xs text-zinc-500">
            AI가 기록을 요약한 것입니다. 정확한 내용은 사건에서 확인하세요.
          </span>
        )}
      </div>
      <p className="text-xs text-zinc-500">
        사건 기록(관리번호·진행 단계·할 일·메모)이 AI 서비스(OpenAI)로 전송되며, 요약은 저장하지 않습니다.
      </p>
      {truncated > 0 && (
        <p className="text-xs text-zinc-500">사건이 {truncated}건이라 급한 순서대로 앞의 30건만 요약했습니다.</p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

export function SummarySlot({ caseId }: { caseId: string }) {
  const { entries } = useSummary();
  const entry = entries[caseId];
  if (!entry) return null;

  if (!entry.lines) {
    return (
      <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
        {entry.notice}
      </p>
    );
  }
  return (
    <div className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-900">
      <p className="mb-1 text-xs font-medium text-zinc-500">AI 요약</p>
      <ul className="space-y-0.5">
        {entry.lines.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    </div>
  );
}
