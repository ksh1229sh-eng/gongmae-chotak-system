import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { isUuid } from "@/lib/case-input";
import { openTasks, todayKST } from "@/lib/cases";
import { getCase, type CaseWithTasks } from "@/lib/db";
import CloseButton from "./CloseButton";
import MemoEditor from "./MemoEditor";
import ReceivedDate from "./ReceivedDate";
import StageBar from "./StageBar";
import TaskSection from "./TaskSection";

export const metadata = { title: "사건 상세 · 공매촉탁업무통합관리시스템" };

async function CaseDetail({ params }: { params: PageProps<"/staff/cases/[id]">["params"] }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  let found: CaseWithTasks | null;
  try {
    found = await getCase(id);
  } catch {
    return (
      <p role="alert" className="text-sm text-red-600 dark:text-red-400">
        사건을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
      </p>
    );
  }
  if (!found) notFound();

  const today = todayKST();
  const closed = !!found.closed_at;
  const remaining = openTasks(found.tasks).length;
  const tasks = found.tasks.map((t) => ({
    id: t.id,
    title: t.title,
    due_on: t.due_on,
    done_at: t.done_at,
    auto_kind: t.auto_kind,
  }));

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link href="/staff/cases" className="text-sm text-zinc-500 hover:underline">
          ← 사건 목록
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <h1 className="break-words text-xl font-bold">{found.case_no}</h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">{found.property_summary || "물건 요약 없음"}</p>
          </div>
          {!closed && <CloseButton caseId={found.id} remaining={remaining} />}
        </div>
        {closed && (
          <p role="status" className="rounded-lg bg-zinc-100 px-3 py-2 text-sm dark:bg-zinc-800">
            종결된 사건입니다 (종결일 {todayKST(new Date(found.closed_at!))}). 진행 단계와 할 일은 바꿀 수 없고, 메모는
            보충할 수 있습니다.
          </p>
        )}
      </div>

      <StageBar caseId={found.id} stage={found.stage} closed={closed} />
      <ReceivedDate caseId={found.id} value={found.docs_received_on} closed={closed} />
      <TaskSection caseId={found.id} tasks={tasks} closed={closed} today={today} />
      <MemoEditor caseId={found.id} memo={found.memo} />
    </div>
  );
}

// 사건 상세 화면입니다. 사건은 요청마다 바뀌는 데이터라 Suspense로 감쌉니다. (Cache Components 규칙)
export default function StaffCaseDetailPage({ params }: PageProps<"/staff/cases/[id]">) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
      <Suspense fallback={<p className="text-sm text-zinc-500">불러오는 중…</p>}>
        <CaseDetail params={params} />
      </Suspense>
    </main>
  );
}
