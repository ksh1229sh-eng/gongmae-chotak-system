import Link from "next/link";
import { Suspense } from "react";
import {
  alertLevel,
  dueLabel,
  nextTask,
  openTasks,
  previewText,
  sortCasesByUrgency,
  stageLabel,
  todayKST,
  type AlertLevel,
} from "@/lib/cases";
import { listCases, type CaseWithTasks } from "@/lib/db";

export const metadata = { title: "인수인계 · 공매촉탁업무통합관리시스템" };

const DUE_STYLE: Record<AlertLevel, string> = {
  overdue: "font-medium text-red-600 dark:text-red-400",
  soon: "font-medium text-amber-600 dark:text-amber-400",
  ok: "text-zinc-700 dark:text-zinc-300",
  none: "text-zinc-500",
};

function NextTaskLine({ c, today }: { c: CaseWithTasks; today: string }) {
  const open = openTasks(c.tasks);
  const next = nextTask(c.tasks, today);
  if (!next) {
    return <span className="text-zinc-500">남은 할 일이 없습니다. 확인 후 종결할 수 있습니다.</span>;
  }
  const level = alertLevel(next.due_on, today);
  return (
    <span>
      {next.title}
      <span className={`ml-2 ${DUE_STYLE[level]}`}>
        {next.due_on ? `${next.due_on} · ${dueLabel(next.due_on, today)}` : "기한 없음"}
      </span>
      {open.length > 1 && <span className="ml-2 text-zinc-500">외 {open.length - 1}건</span>}
    </span>
  );
}

async function Handover() {
  let cases: CaseWithTasks[];
  try {
    cases = await listCases("open");
  } catch {
    return (
      <p role="alert" className="text-sm text-red-600 dark:text-red-400">
        사건 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
      </p>
    );
  }

  const today = todayKST();
  const sorted = sortCasesByUrgency(cases, today);
  // 사건 단위로 셉니다 (알림 숫자는 할 일 단위). 사건의 가장 급한 할 일이 지연·임박인 사건 수입니다.
  const levelOf = (c: CaseWithTasks) => alertLevel(nextTask(c.tasks, today)?.due_on ?? null, today);
  const overdue = sorted.filter((c) => levelOf(c) === "overdue").length;
  const soon = sorted.filter((c) => levelOf(c) === "soon").length;

  if (sorted.length === 0) {
    return <p className="text-sm text-zinc-500">미처리 사건이 없습니다.</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium">
        미처리 사건 {sorted.length}건 · <span className="text-red-600 dark:text-red-400">지연 {overdue}</span> ·{" "}
        <span className="text-amber-600 dark:text-amber-400">임박 {soon}</span>
      </p>

      <ul className="space-y-3">
        {sorted.map((c) => {
          const memo = previewText(c.memo);
          return (
            <li key={c.id} className="space-y-2 rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-700">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <Link href={`/staff/cases/${c.id}`} className="font-semibold underline-offset-2 hover:underline">
                  {c.case_no}
                </Link>
                <span className="rounded-full border border-zinc-300 px-2 py-0.5 text-xs dark:border-zinc-600">
                  {stageLabel(c.stage)}
                </span>
              </div>
              <p className="text-zinc-600 dark:text-zinc-300">{c.property_summary || "물건 요약 없음"}</p>
              <p>
                <span className="mr-2 text-xs text-zinc-500">다음 할 일</span>
                <NextTaskLine c={c} today={today} />
              </p>
              <p className={memo ? "" : "text-zinc-500"}>
                <span className="mr-2 text-xs text-zinc-500">메모</span>
                {memo || "메모 없음"}
              </p>
              <Link
                href={`/staff/cases/${c.id}`}
                className="inline-block rounded-lg border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800"
              >
                사건 열기
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// 인수인계 화면: 담당자가 바뀌었을 때 미처리 사건을 한 화면에서 파악합니다. 급한 사건이 위에 옵니다.
// 사건은 요청마다 바뀌는 데이터라 Suspense로 감쌉니다. (Cache Components 규칙)
export default function StaffHandoverPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-6">
      <div className="space-y-1">
        <h1 className="text-xl font-bold">인수인계</h1>
        <p className="text-sm text-zinc-500">
          아직 종결하지 않은 사건을 가장 급한 할 일 순서로 보여 줍니다. 업무를 이어받을 때 위에서부터 확인하세요.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">불러오는 중…</p>}>
        <Handover />
      </Suspense>
      <p className="text-sm">
        <Link href="/staff/manual" className="underline underline-offset-2">
          업무 매뉴얼 보기
        </Link>
      </p>
    </main>
  );
}
