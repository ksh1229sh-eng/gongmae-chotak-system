"use client";

import { useState } from "react";
import { sendDeadline } from "@/lib/cases";
import { BUTTON, BUTTON_SUB, INPUT, useMutation } from "./useMutation";

// 서류 접수일: 넣거나 고치면 "촉탁서 발송 기한"(접수일 + 7일) 할 일이 자동으로 만들어지거나 갱신됩니다.
export default function ReceivedDate({ caseId, value, closed }: { caseId: string; value: string | null; closed: boolean }) {
  const { busy, error, setError, run } = useMutation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [warning, setWarning] = useState("");

  async function save() {
    const data = await run("PATCH", `/api/staff/cases/${caseId}`, { docs_received_on: draft || null });
    if (data) {
      setEditing(false);
      setWarning(data.warning ?? "");
    }
  }

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">서류 접수일</h2>
      {editing ? (
        <div className="space-y-2">
          <input
            type="date"
            aria-label="서류 접수일"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className={`${INPUT} block sm:w-48`}
          />
          <p className="text-xs text-zinc-500">
            접수일을 바꾸면 촉탁서 발송 기한(접수일 + 7일)이 새로 계산되고, 완료한 발송 기한 할 일은 다시 미완료가 됩니다. 접수일을 비우면 아직 끝내지 않은 발송 기한 할 일은 함께 지워집니다.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={save} disabled={busy} className={BUTTON}>
              {busy ? "저장 중…" : "저장"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setError("");
              }}
              disabled={busy}
              className={BUTTON_SUB}
            >
              취소
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span>{value ?? "아직 입력하지 않았습니다"}</span>
          {value && <span className="text-zinc-500">촉탁서 발송 기한 {sendDeadline(value)}</span>}
          {!closed && (
            <button
              type="button"
              onClick={() => {
                setDraft(value ?? "");
                setWarning("");
                setEditing(true);
              }}
              className={BUTTON_SUB}
            >
              수정
            </button>
          )}
        </div>
      )}
      {warning && (
        <p role="alert" className="text-sm text-amber-700 dark:text-amber-400">
          {warning}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </section>
  );
}
