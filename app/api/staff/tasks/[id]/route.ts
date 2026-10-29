import { isUuid } from "@/lib/case-input";
import { dbErrorResponse, getTask, updateTask } from "@/lib/db";
import { parseTaskPatch } from "@/lib/task-input";

// 할 일 수정: 내용·기한·완료 여부(done: true/false) 중 보낸 칸만. 종결된 사건의 할 일은 바꿀 수 없습니다.
export async function PATCH(request: Request, ctx: RouteContext<"/api/staff/tasks/[id]">) {
  const { id } = await ctx.params;
  const notFound = () => Response.json({ error: "할 일을 찾을 수 없습니다." }, { status: 404 });
  if (!isUuid(id)) return notFound();

  const parsed = parseTaskPatch(await request.json().catch(() => null));
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

  try {
    const current = await getTask(id);
    if (!current) return notFound();
    if (current.cases.closed_at) {
      return Response.json({ error: "종결된 사건의 할 일은 바꿀 수 없습니다." }, { status: 409 });
    }
    const { done, ...rest } = parsed.data;
    const patch = done === undefined ? rest : { ...rest, done_at: done ? new Date().toISOString() : null };
    const task = await updateTask(id, patch);
    return task ? Response.json({ task }) : notFound();
  } catch (error) {
    return dbErrorResponse(error);
  }
}
