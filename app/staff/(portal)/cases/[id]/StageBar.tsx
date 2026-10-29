"use client";

import { STAGES } from "@/lib/cases";
import { useMutation } from "./useMutation";

// 진행 단계: 눌러서 바꿉니다. 보완 요청 뒤 다시 서류 접수로 돌아가는 일도 있어 순서는 제한하지 않습니다.
export default function StageBar({ caseId, stage, closed }: { caseId: string; stage: string; closed: boolean }) {
  const { busy, error, run } = useMutation();

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">진행 단계</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STAGES.map((s, i) => {
          const current = s.key === stage;
          return (
            <button
              key={s.key}
              type="button"
              aria-pressed={current}
              disabled={closed || busy}
              onClick={() => !current && run("PATCH", `/api/staff/cases/${caseId}`, { stage: s.key })}
              className={`rounded-lg border px-3 py-2 text-sm disabled:cursor-not-allowed ${
                current
                  ? "border-zinc-900 bg-zinc-900 font-medium text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                  : "border-zinc-300 text-zinc-600 hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              {i + 1}. {s.label}
            </button>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </section>
  );
}
