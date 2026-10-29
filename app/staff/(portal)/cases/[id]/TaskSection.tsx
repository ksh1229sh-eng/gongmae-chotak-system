"use client";

import { useState } from "react";
import { alertLevel, dueLabel, openTasks, sortByUrgency, type AlertLevel } from "@/lib/cases";
import { BUTTON, INPUT, useMutation } from "./useMutation";

export type TaskView = { id: string; title: string; due_on: string | null; done_at: string | null; auto_kind: string | null };

const LEVEL: Record<AlertLevel, { label: string; style: string }> = {
  overdue: { label: "지연", style: "font-medium text-red-600 dark:text-red-400" },
  soon: { label: "임박", style: "font-medium text-amber-600 dark:text-amber-400" },
  ok: { label: "", style: "text-zinc-700 dark:text-zinc-300" },
  none: { label: "", style: "text-zinc-500" },
};

// 할 일 목록: 미완료는 급한 순, 완료한 것은 아래로. 종결된 사건은 보기만 할 수 있습니다.
export default function TaskSection({
  caseId,
  tasks,
  closed,
  today,
}: {
  caseId: string;
  tasks: TaskView[];
  closed: boolean;
  today: string;
}) {
  const { busy, error, setError, run } = useMutation();
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");

  const open = openTasks(tasks);
  const ordered = [...sortByUrgency(open, today), ...tasks.filter((t) => t.done_at)];

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const data = await run("POST", `/api/staff/cases/${caseId}/tasks`, { title, due_on: due || null });
    if (data) {
      setTitle("");
      setDue("");
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">할 일 (남은 {open.length}건)</h2>

      {ordered.length === 0 ? (
        <p className="text-sm text-zinc-500">할 일이 없습니다.</p>
      ) : (
        <ul>
          {ordered.map((t) => {
            const done = !!t.done_at;
            const level = alertLevel(t.due_on, today);
            return (
              <li
                key={t.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-zinc-200 py-2 text-sm dark:border-zinc-700"
              >
                <input
                  type="checkbox"
                  checked={done}
                  disabled={closed || busy}
                  onChange={() => run("PATCH", `/api/staff/tasks/${t.id}`, { done: !done })}
                  aria-label={`${t.title} 완료`}
                  className="h-4 w-4"
                />
                <span className={`min-w-0 flex-1 ${done ? "text-zinc-500 line-through" : ""}`}>
                  {t.title}
                  {t.auto_kind && <span className="ml-1 text-xs text-zinc-500">(자동)</span>}
                </span>
                {done ? (
                  <span className="text-zinc-500">완료{t.due_on ? ` · 기한 ${t.due_on}` : ""}</span>
                ) : (
                  <span className={LEVEL[level].style}>
                    {t.due_on ? `${t.due_on} · ${dueLabel(t.due_on, today)}` : "기한 없음"}
                    {LEVEL[level].label && ` · ${LEVEL[level].label}`}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!closed && (
        <form onSubmit={add} className="space-y-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
          <p className="text-xs text-red-600 dark:text-red-400">
            개인정보(이름·주민번호·연락처)를 적지 마세요. 임차권 말소 같은 추가 말소는 할 일로 남겨 두세요.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              aria-label="할 일 내용"
              placeholder="할 일 내용 (예: 임차권 말소 촉탁 확인)"
              maxLength={200}
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={`${INPUT} sm:flex-1`}
            />
            <input
              type="date"
              aria-label="기한"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className={`${INPUT} block sm:w-44`}
            />
            <button type="submit" disabled={busy || !title.trim()} className={BUTTON}>
              추가
            </button>
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400" onClick={() => setError("")}>
              {error}
            </p>
          )}
        </form>
      )}
      {closed && error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </section>
  );
}
