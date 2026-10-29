import Link from "next/link";
import { Suspense } from "react";
import {
  alertLevel,
  dueLabel,
  nextTask,
  openTasks,
  stageLabel,
  todayKST,
  type AlertLevel,
} from "@/lib/cases";
import { listCases, type CaseWithTasks } from "@/lib/db";
import NewCaseForm from "./NewCaseForm";

export const metadata = { title: "사건 · 공매촉탁업무통합관리시스템" };

const LEVEL_STYLE: Record<AlertLevel, string> = {
  overdue: "font-medium text-red-600 dark:text-red-400",
  soon: "font-medium text-amber-600 dark:text-amber-400",
  ok: "text-zinc-700 dark:text-zinc-300",
  none: "text-zinc-500",
};

// 목록 한 줄에 필요한 값을 미리 계산합니다. 판정은 모두 lib/cases.ts의 규칙을 씁니다.
function toRow(c: CaseWithTasks, today: string, closed: boolean) {
  const open = openTasks(c.tasks);
  const next = nextTask(c.tasks, today);
  const level = next ? alertLevel(next.due_on, today) : "none";
  const due = closed
    ? { text: c.closed_at ? todayKST(new Date(c.closed_at)) : "-", style: LEVEL_STYLE.none }
    : !next
      ? { text: "-", style: LEVEL_STYLE.none }
      : { text: next.due_on ? `${next.due_on} · ${dueLabel(next.due_on, today)}` : "기한 없음", style: LEVEL_STYLE[level] };
  return {
    id: c.id,
    caseNo: c.case_no,
    summary: c.property_summary || "-",
    stage: stageLabel(c.stage),
    remaining: open.length,
    due,
  };
}

function Tabs({ status }: { status: "open" | "closed" }) {
  const tab = (key: "open" | "closed", label: string, href: string) => (
    <Link
      href={href}
      aria-current={status === key ? "page" : undefined}
      className={`rounded-lg px-3 py-1.5 text-sm ${
        status === key
          ? "bg-zinc-900 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
      }`}
    >
      {label}
    </Link>
  );
  return (
    <div className="flex gap-1">
      {tab("open", "진행 중", "/staff/cases")}
      {tab("closed", "종결", "/staff/cases?status=closed")}
    </div>
  );
}

async function CasesContent({ searchParams }: { searchParams: PageProps<"/staff/cases">["searchParams"] }) {
  const params = await searchParams;
  const status = params.status === "closed" ? "closed" : "open";
  const closed = status === "closed";

  let cases: CaseWithTasks[];
  try {
    cases = await listCases(status);
  } catch {
    return (
      <p role="alert" className="text-sm text-red-600 dark:text-red-400">
        사건 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
      </p>
    );
  }

  const today = todayKST();
  const rows = cases.map((c) => toRow(c, today, closed));

  return (
    <div className="space-y-4">
      {!closed && <NewCaseForm />}
      <Tabs status={status} />

      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500">
          {closed ? "종결된 사건이 없습니다." : "진행 중인 사건이 없습니다. [+ 새 사건]으로 등록해 보세요."}
        </p>
      ) : (
        <>
          <table className="hidden w-full text-left text-sm sm:table">
            <thead className="text-zinc-500">
              <tr>
                <th className="py-2 pr-3 font-medium">관리번호</th>
                <th className="py-2 pr-3 font-medium">물건 요약</th>
                <th className="py-2 pr-3 font-medium">진행 단계</th>
                <th className="py-2 pr-3 text-right font-medium">남은 할 일</th>
                <th className="py-2 font-medium">{closed ? "종결일" : "가장 가까운 기한"}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-zinc-200 dark:border-zinc-700">
                  <td className="py-2 pr-3 font-medium">
                    <Link href={`/staff/cases/${r.id}`} className="underline-offset-2 hover:underline">
                      {r.caseNo}
                    </Link>
                  </td>
                  <td className="py-2 pr-3">{r.summary}</td>
                  <td className="py-2 pr-3">{r.stage}</td>
                  <td className="py-2 pr-3 text-right">{r.remaining}건</td>
                  <td className={`py-2 ${r.due.style}`}>{r.due.text}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <ul className="space-y-2 sm:hidden">
            {rows.map((r) => (
              <li key={r.id} className="space-y-1 rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-700">
                <div className="flex items-baseline justify-between gap-2">
                  <Link href={`/staff/cases/${r.id}`} className="font-medium underline-offset-2 hover:underline">
                    {r.caseNo}
                  </Link>
                  <span className="text-zinc-500">{r.stage}</span>
                </div>
                <p>{r.summary}</p>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-zinc-500">남은 할 일 {r.remaining}건</span>
                  <span className={r.due.style}>
                    {closed ? "종결 " : ""}
                    {r.due.text}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

// 사건 목록·등록 화면입니다. 목록은 요청마다 바뀌는 데이터라 Suspense로 감쌉니다. (Cache Components 규칙)
export default function StaffCasesPage({ searchParams }: PageProps<"/staff/cases">) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-6">
      <h1 className="text-xl font-bold">사건</h1>
      <Suspense fallback={<p className="text-sm text-zinc-500">불러오는 중…</p>}>
        <CasesContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
