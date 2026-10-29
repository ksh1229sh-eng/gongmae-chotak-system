"use client";

import { useState } from "react";
import { BUTTON, INPUT, useMutation } from "./useMutation";

// 메모: 종결된 사건에서도 보충할 수 있습니다. 주민등록번호·전화번호 형태가 있으면 서버가 저장을 거부합니다.
export default function MemoEditor({ caseId, memo }: { caseId: string; memo: string }) {
  const { busy, error, run } = useMutation();
  const [text, setText] = useState(memo);
  const [saved, setSaved] = useState(false);
  const dirty = text.trim() !== memo.trim();

  async function save() {
    setSaved(false);
    if (await run("PATCH", `/api/staff/cases/${caseId}`, { memo: text })) setSaved(true);
  }

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">메모</h2>
      <p className="text-xs text-red-600 dark:text-red-400">
        개인정보(이름·주민번호·연락처)를 적지 마세요. 주민등록번호·전화번호 형태가 있으면 저장되지 않습니다.
      </p>
      <textarea
        aria-label="메모"
        rows={4}
        maxLength={2000}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setSaved(false);
        }}
        className={INPUT}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={busy || !dirty} className={BUTTON}>
          {busy ? "저장 중…" : "저장"}
        </button>
        {saved && !dirty && (
          <span role="status" className="text-sm text-green-700 dark:text-green-400">
            저장했습니다.
          </span>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </section>
  );
}
