import { canClose, openTasks } from "@/lib/cases";
import { isUuid } from "@/lib/case-input";
import { closeCase, dbErrorResponse, getCase } from "@/lib/db";

// 사건 종결: 남은 할 일이 하나라도 있으면 거부합니다. (임차권 말소 등 추가 말소를 놓치지 않게 하는 장치)
// 거부할 때는 남은 할 일의 개수와 내용을 함께 알려 줘서 화면에서 바로 보여 줄 수 있습니다.
export async function POST(_request: Request, ctx: RouteContext<"/api/staff/cases/[id]/close">) {
  const { id } = await ctx.params;
  const notFound = () => Response.json({ error: "사건을 찾을 수 없습니다." }, { status: 404 });
  if (!isUuid(id)) return notFound();

  try {
    const found = await getCase(id);
    if (!found) return notFound();
    if (found.closed_at) return Response.json({ error: "이미 종결된 사건입니다." }, { status: 409 });

    const { ok, remaining } = canClose(found.tasks);
    if (!ok) {
      return Response.json(
        {
          error: `남은 할 일이 ${remaining}건 있어 종결할 수 없습니다.`,
          remaining,
          tasks: openTasks(found.tasks).map((t) => ({ id: t.id, title: t.title, due_on: t.due_on })),
        },
        { status: 409 },
      );
    }

    const closed = await closeCase(id);
    // 확인한 뒤 다른 곳에서 먼저 종결했다면 closed가 비어 있습니다.
    if (!closed) return Response.json({ error: "이미 종결된 사건입니다." }, { status: 409 });
    return Response.json({ case: closed });
  } catch (error) {
    return dbErrorResponse(error);
  }
}
