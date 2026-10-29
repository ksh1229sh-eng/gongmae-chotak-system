"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const INPUT =
  "w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-600";

export default function NewCaseForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const form = new FormData(e.currentTarget);
    const text = (key: string) => String(form.get(key) ?? "");
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/staff/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          case_no: text("case_no"),
          property_summary: text("property_summary"),
          docs_received_on: text("docs_received_on") || null,
          memo: text("memo"),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "사건을 등록하지 못했어요.");
        return;
      }
      setOpen(false);
      setNotice(data.warning ?? `관리번호 ${data.case.case_no} 사건을 등록했습니다.`);
      router.refresh(); // 목록과 메뉴 옆 알림 숫자를 새로 받아 옵니다.
    } catch {
      setError("서버와 연결하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => {
            setOpen((v) => !v);
            setError("");
            setNotice("");
          }}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"
        >
          {open ? "닫기" : "+ 새 사건"}
        </button>
        {notice && (
          <p role="status" className="text-sm text-green-700 dark:text-green-400">
            {notice}
          </p>
        )}
      </div>

      {open && (
        <form onSubmit={submit} className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
          <p className="text-xs text-red-600 dark:text-red-400">
            개인정보(이름·주민번호·연락처)를 적지 마세요. 주민등록번호·전화번호 형태가 있으면 저장되지 않습니다.
          </p>

          <div className="space-y-1">
            <label htmlFor="case_no" className="text-sm font-medium">
              관리번호
            </label>
            <input id="case_no" name="case_no" required maxLength={50} placeholder="예: 2026-0012" className={INPUT} />
          </div>

          <div className="space-y-1">
            <label htmlFor="property_summary" className="text-sm font-medium">
              물건 요약
            </label>
            <input
              id="property_summary"
              name="property_summary"
              maxLength={200}
              placeholder="예: 경기 수원 아파트 1세대 (주소 전체는 적지 않음)"
              className={INPUT}
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="docs_received_on" className="block text-sm font-medium">
              서류 접수일 (선택)
            </label>
            <input id="docs_received_on" name="docs_received_on" type="date" className={`${INPUT} block sm:w-48`} />
            <p className="text-xs text-zinc-500">
              넣으면 &quot;촉탁서 발송 기한&quot;(접수일 + 7일) 할 일이 자동으로 만들어집니다.
            </p>
          </div>

          <div className="space-y-1">
            <label htmlFor="memo" className="text-sm font-medium">
              메모 (선택)
            </label>
            <textarea id="memo" name="memo" rows={3} maxLength={2000} className={INPUT} />
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {busy ? "저장 중…" : "사건 등록"}
          </button>
        </form>
      )}
    </div>
  );
}
