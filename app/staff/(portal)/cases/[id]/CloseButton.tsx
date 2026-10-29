"use client";

import { useState } from "react";
import { BUTTON_SUB, useMutation } from "./useMutation";

// 종결: 남은 할 일이 있으면 회색으로 막고 이유를 보여 줍니다. 종결하면 되돌릴 수 없어서 한 번 더 확인합니다.
export default function CloseButton({ caseId, remaining }: { caseId: string; remaining: number }) {
  const { busy, error, run } = useMutation();
  const [confirming, setConfirming] = useState(false);

  async function close() {
    await run("POST", `/api/staff/cases/${caseId}/close`);
    setConfirming(false);
  }

  if (remaining > 0) {
    return (
      <div className="space-y-1 sm:text-right">
        <button type="button" disabled className={BUTTON_SUB}>
          종결
        </button>
        <p className="text-xs text-zinc-500">남은 할 일 {remaining}건이 있어 종결할 수 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 sm:text-right">
      {confirming ? (
        <div className="space-y-2">
          <p className="text-sm">종결하면 되돌릴 수 없습니다. 종결할까요?</p>
          <div className="flex gap-2 sm:justify-end">
            <button
              type="button"
              onClick={close}
              disabled={busy}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              {busy ? "종결 중…" : "종결 확인"}
            </button>
            <button type="button" onClick={() => setConfirming(false)} disabled={busy} className={BUTTON_SUB}>
              취소
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className={BUTTON_SUB}>
          종결
        </button>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
