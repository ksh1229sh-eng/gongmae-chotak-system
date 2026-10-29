// 사건 사후관리 규칙을 계산하는 순수 함수 모음입니다. (PRD 5번 must 2, DESIGN.md 4장)
// 알림 상태·정렬·종결 가능 여부·촉탁서 발송 기한은 모두 이 파일이 정하고, AI는 관여하지 않습니다.
// Node가 테스트에서 직접 실행하므로 enum 같은 TypeScript 전용 문법은 쓰지 않습니다.

export const SOON_DAYS = 7; // 기한 7일 전부터 "임박"
export const SEND_DEADLINE_DAYS = 7; // 촉탁서는 구비서류 접수일로부터 7일 이내 발송 (안내문 p.5)
export const SEND_DEADLINE_TITLE = "촉탁서 발송 기한";

export const STAGES = [
  { key: "received", label: "서류 접수" },
  { key: "supplement", label: "보완 요청" },
  { key: "sent", label: "촉탁서 발송" },
  { key: "registered", label: "등기 완료" },
] as const;

export type StageKey = (typeof STAGES)[number]["key"];

export type AlertLevel = "overdue" | "soon" | "ok" | "none";

// 이 파일이 필요로 하는 할 일의 최소 모양 (lib/db.ts의 TaskRow와 호환)
export type TaskLike = { title: string; due_on: string | null; done_at: string | null };

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isStage(value: unknown): value is StageKey {
  return STAGES.some((s) => s.key === value);
}

export function stageLabel(key: string): string {
  return STAGES.find((s) => s.key === key)?.label ?? key;
}

// 존재하는 날짜인지까지 확인합니다 (예: 2026-02-30은 거부).
export function isDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  // 월이 13이거나 일이 32처럼 달력에 아예 없는 값은 Invalid Date라 toISOString이 오류를 던지므로 먼저 거릅니다.
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// 서버가 어느 나라 시간대에서 돌든 "오늘"은 한국 날짜로 셉니다. (Vercel 서버는 UTC)
export function todayKST(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

// to - from (일). 기한까지 남은 날 수를 셀 때 씁니다.
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

export function sendDeadline(docsReceivedOn: string): string {
  return addDays(docsReceivedOn, SEND_DEADLINE_DAYS);
}

type SendDeadlineTask = TaskLike & { id: string; auto_kind: string | null };

// 서류 접수일을 넣거나 고치거나 비울 때 "촉탁서 발송 기한" 할 일을 어떻게 할지 정합니다. (사건당 1개)
// - 아직 없으면 새로 만들고, 있는데 기한이 다르면 기한을 고치며 다시 미완료로 돌립니다 (접수일이 바뀌면 새 기한이 생긴 것).
// - 이미 같은 기한이면 아무것도 하지 않습니다.
// - 접수일을 비우면 기준이 사라진 것이므로, 아직 안 끝낸 자동 할 일은 지웁니다. 안 지우면 옛 기한이 계속 '지연'으로 뜨고 종결도 막습니다.
//   이미 완료한 것은 처리 기록이라 그대로 둡니다.
export function planSendDeadline(
  docsReceivedOn: string | null,
  tasks: SendDeadlineTask[],
):
  | { action: "none" }
  | { action: "create"; due_on: string }
  | { action: "update"; id: string; due_on: string }
  | { action: "delete"; id: string } {
  const existing = tasks.find((t) => t.auto_kind === "send_deadline");
  if (!docsReceivedOn) {
    return existing && !existing.done_at ? { action: "delete", id: existing.id } : { action: "none" };
  }
  const due_on = sendDeadline(docsReceivedOn);
  if (!existing) return { action: "create", due_on };
  if (existing.due_on === due_on) return { action: "none" };
  return { action: "update", id: existing.id, due_on };
}

// 기한이 지나면 "지연", 오늘부터 7일 안이면 "임박", 그보다 멀면 "여유", 기한이 없으면 "없음"
export function alertLevel(dueOn: string | null, today: string): AlertLevel {
  if (!dueOn) return "none";
  const left = daysBetween(today, dueOn);
  if (left < 0) return "overdue";
  if (left <= SOON_DAYS) return "soon";
  return "ok";
}

// 화면에 붙일 "D-3", "D-day", "3일 지남" 표시
export function dueLabel(dueOn: string | null, today: string): string {
  if (!dueOn) return "기한 없음";
  const left = daysBetween(today, dueOn);
  if (left < 0) return `${-left}일 지남`;
  if (left === 0) return "D-day";
  return `D-${left}`;
}

const LEVEL_ORDER: Record<AlertLevel, number> = { overdue: 0, soon: 1, ok: 2, none: 3 };

// 지연 → 임박 → 여유 → 기한 없음 순, 같은 무리 안에서는 기한이 이른 것부터. 원래 순서는 최대한 유지합니다.
export function sortByUrgency<T extends Pick<TaskLike, "due_on">>(tasks: T[], today: string): T[] {
  return [...tasks].sort((a, b) => {
    const level = LEVEL_ORDER[alertLevel(a.due_on, today)] - LEVEL_ORDER[alertLevel(b.due_on, today)];
    if (level) return level;
    if (a.due_on && b.due_on && a.due_on !== b.due_on) return a.due_on < b.due_on ? -1 : 1;
    return 0;
  });
}

export function openTasks<T extends TaskLike>(tasks: T[]): T[] {
  return tasks.filter((t) => !t.done_at);
}

// 가장 급한 미완료 할 일 (사건 목록의 "가장 가까운 기한", 인수인계의 "다음 할 일")
export function nextTask<T extends TaskLike>(tasks: T[], today: string): T | null {
  return sortByUrgency(openTasks(tasks), today)[0] ?? null;
}

// 인수인계 화면: 미처리 사건을 "가장 급한 할 일" 기준으로 정렬합니다.
// 지연 → 임박 → 여유 → 기한 없는 할 일만 남음 → 남은 할 일이 없음(종결만 하면 됨) 순이고,
// 같은 무리 안에서는 기한이 이른 사건이 위로 옵니다. 그 밖의 순서는 원래대로 유지합니다.
export function sortCasesByUrgency<T extends { tasks: TaskLike[] }>(cases: T[], today: string): T[] {
  const NO_TASK = 4;
  const rank = (c: T) => {
    const next = nextTask(c.tasks, today);
    if (!next) return { group: NO_TASK, due: "" };
    return { group: LEVEL_ORDER[alertLevel(next.due_on, today)], due: next.due_on ?? "" };
  };
  return [...cases].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra.group !== rb.group) return ra.group - rb.group;
    if (ra.due && rb.due && ra.due !== rb.due) return ra.due < rb.due ? -1 : 1;
    return 0;
  });
}

// 메모 앞부분만 한 줄로 보여 줍니다 (줄바꿈·겹친 띄어쓰기는 하나로, 길면 …으로 자름).
export function previewText(text: string, max = 100): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max).trimEnd()}…` : flat;
}

// 남은 할 일이 하나라도 있으면 종결할 수 없습니다. (임차권 말소 등 추가 말소 누락 방지)
export function canClose(tasks: TaskLike[]): { ok: boolean; remaining: number } {
  const remaining = openTasks(tasks).length;
  return { ok: remaining === 0, remaining };
}

// 알림 화면에 보여 줄 할 일(지연·임박)과 메뉴 옆 숫자
export function alertSummary<T extends TaskLike>(tasks: T[], today: string) {
  const open = sortByUrgency(openTasks(tasks), today);
  const overdue = open.filter((t) => alertLevel(t.due_on, today) === "overdue");
  const soon = open.filter((t) => alertLevel(t.due_on, today) === "soon");
  return { overdue, soon, count: overdue.length + soon.length };
}
