// 서류 접수일에 맞춰 "촉탁서 발송 기한" 할 일을 만들거나 고칩니다. (PRD 5번 must 2, 규칙은 lib/cases.ts)
import "server-only";
import { SEND_DEADLINE_TITLE, planSendDeadline } from "@/lib/cases";
import { createTask, deleteTask, getCase, updateTask } from "@/lib/db";

// 사건은 이미 저장된 뒤에 부르므로, 실패해도 사건 저장을 되돌리지 않고 안내 문구만 돌려줍니다.
export const SEND_DEADLINE_WARNING = "사건은 저장했지만 촉탁서 발송 기한 할 일을 만들지 못했습니다. 서류 접수일을 다시 저장해 주세요.";

export async function syncSendDeadline(caseId: string, docsReceivedOn: string | null): Promise<string | null> {
  try {
    const current = await getCase(caseId);
    const plan = planSendDeadline(docsReceivedOn, current?.tasks ?? []);
    if (plan.action === "create") {
      await createTask(caseId, { title: SEND_DEADLINE_TITLE, due_on: plan.due_on, auto_kind: "send_deadline" });
    } else if (plan.action === "update") {
      await updateTask(plan.id, { due_on: plan.due_on, done_at: null });
    } else if (plan.action === "delete") {
      await deleteTask(plan.id);
    }
    return null;
  } catch (error) {
    console.error("발송 기한 할 일 동기화 실패", error);
    return SEND_DEADLINE_WARNING;
  }
}
