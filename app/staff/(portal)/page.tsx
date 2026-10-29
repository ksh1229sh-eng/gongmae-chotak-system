import Link from "next/link";
import { Suspense } from "react";
import { alertSummary, dueLabel, openTasks, todayKST } from "@/lib/cases";
import { listOpenTasks, type OpenTaskRow } from "@/lib/db";

export const metadata = { title: "알림 · 공매촉탁업무통합관리시스템" };

const TONE = {
  overdue: {
    title: "text-red-600 dark:text-red-400",
    box: "border-red-300 dark:border-red-800",
    due: "text-red-600 dark:text-red-400",
  },
  soon: {
    title: "text-amber-600 dark:text-amber-400",
    box: "border-amber-300 dark:border-amber-800",
    due: "text-amber-600 dark:text-amber-400",
  },
};

function Group({
  heading,
  tone,
  tasks,
  today,
}: {
  heading: string;
  tone: keyof typeof TONE;
  tasks: OpenTaskRow[];
  today: string;
}) {
  if (tasks.length === 0) return null;
  const style = TONE[tone];
  return (
    <section className={`rounded-lg border p-4 ${style.box}`}>
      <h2 className={`mb-1 text-sm font-semibold ${style.title}`}>{heading}</h2>
      <ul>
        {tasks.map((t) => (
          <li
            key={t.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-zinc-200 py-2 text-sm first:border-t-0 dark:border-zinc-700"
          >
            <span className={`font-medium ${style.due}`}>
              {t.due_on} · {dueLabel(t.due_on, today)}
            </span>
            <span className="min-w-[60%] flex-1 basis-60">
              <span className="font-medium">{t.cases.case_no}</span> · {t.title}
              {t.cases.property_summary && (
                <span className="block text-xs text-zinc-500">{t.cases.property_summary}</span>
              )}
            </span>
            <Link
              href={`/staff/cases/${t.cases.id}`}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800"
            >
              사건 열기
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

// 메뉴 옆 숫자와 같은 규칙(lib/cases.ts)으로 지연·임박 할 일을 모아 보여 줍니다.
async function Alerts() {
  let tasks: OpenTaskRow[];
  try {
    tasks = await listOpenTasks();
  } catch {
    return (
      <p role="alert" className="text-sm text-red-600 dark:text-red-400">
        알림을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
      </p>
    );
  }

  const today = todayKST();
  const { overdue, soon, count } = alertSummary(tasks, today);
  // 기한이 8일 이상 남았거나 기한이 없는 할 일은 알림에 뜨지 않으니, 있다는 사실만 알려 줍니다.
  const hidden = openTasks(tasks).length - count;

  return (
    <div className="space-y-4">
      {count === 0 && <p className="text-sm text-zinc-500">기한이 다가오는 일이 없습니다.</p>}
      <Group heading={`지연 ${overdue.length}건`} tone="overdue" tasks={overdue} today={today} />
      <Group heading={`임박 ${soon.length}건 (7일 이내)`} tone="soon" tasks={soon} today={today} />
      {hidden > 0 && (
        <p className="text-xs text-zinc-500">
          기한이 8일 이상 남았거나 기한이 없는 미완료 할 일 {hidden}건은 알림에 나타나지 않습니다. 각 사건에서
          확인해 주세요.
        </p>
      )}
    </div>
  );
}

// 로그인 뒤 처음 보는 알림 화면입니다. 할 일은 요청마다 바뀌는 데이터라 Suspense로 감쌉니다. (Cache Components 규칙)
export default function StaffAlertsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-6">
      <h1 className="text-xl font-bold">알림</h1>
      <Suspense fallback={<p className="text-sm text-zinc-500">불러오는 중…</p>}>
        <Alerts />
      </Suspense>
    </main>
  );
}
