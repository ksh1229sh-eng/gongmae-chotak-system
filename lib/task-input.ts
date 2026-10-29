// 담당자 API로 들어온 할 일 입력값을 검사하고 정리합니다. (사건 입력 검사는 lib/case-input.ts)
import { isDate } from "@/lib/cases";
import { personalInfoMessage } from "@/lib/privacy";

export const TASK_TITLE_MAX = 200;

type TaskPatch = { title?: string; due_on?: string | null; done?: boolean };
type Result<T> = { ok: true; data: T } | { ok: false; error: string };

function asObject(body: unknown): Record<string, unknown> | null {
  return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
}

function parseTitle(value: unknown): Result<string> {
  if (typeof value !== "string") return { ok: false, error: "할 일 내용은 글자로 입력해 주세요." };
  const title = value.trim().replace(/\s+/g, " ");
  if (!title) return { ok: false, error: "할 일 내용을 입력해 주세요." };
  if (title.length > TASK_TITLE_MAX) return { ok: false, error: `할 일 내용은 ${TASK_TITLE_MAX}자 이내로 입력해 주세요.` };
  const privacy = personalInfoMessage({ "할 일 내용": title });
  if (privacy) return { ok: false, error: privacy };
  return { ok: true, data: title };
}

function parseDue(value: unknown): Result<string | null> {
  if (value === null || value === "") return { ok: true, data: null };
  if (isDate(value)) return { ok: true, data: value };
  return { ok: false, error: "기한은 2026-10-29 같은 형식의 날짜로 입력해 주세요." };
}

// 할 일 추가: 내용(필수), 기한(선택)
export function parseNewTask(body: unknown): Result<{ title: string; due_on: string | null }> {
  const raw = asObject(body);
  if (!raw) return { ok: false, error: "잘못된 요청입니다." };
  const title = parseTitle(raw.title);
  if (!title.ok) return title;
  const due = "due_on" in raw ? parseDue(raw.due_on) : ({ ok: true, data: null } as const);
  if (!due.ok) return due;
  return { ok: true, data: { title: title.data, due_on: due.data } };
}

// 할 일 수정: 내용·기한·완료 여부 중 보낸 칸만
export function parseTaskPatch(body: unknown): Result<TaskPatch> {
  const raw = asObject(body);
  if (!raw) return { ok: false, error: "잘못된 요청입니다." };
  const data: TaskPatch = {};
  if ("title" in raw) {
    const title = parseTitle(raw.title);
    if (!title.ok) return title;
    data.title = title.data;
  }
  if ("due_on" in raw) {
    const due = parseDue(raw.due_on);
    if (!due.ok) return due;
    data.due_on = due.data;
  }
  if ("done" in raw) {
    if (typeof raw.done !== "boolean") return { ok: false, error: "done은 true 또는 false여야 합니다." };
    data.done = raw.done;
  }
  if (!Object.keys(data).length) return { ok: false, error: "고칠 내용이 없습니다." };
  return { ok: true, data };
}
