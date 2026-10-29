import { isUuid } from "@/lib/case-input";
import { createTask, dbErrorResponse, getCase } from "@/lib/db";
import { parseNewTask } from "@/lib/task-input";

// 사건에 할 일 추가: 내용(필수), 기한(선택). 종결된 사건에는 추가할 수 없습니다.
export async function POST(request: Request, ctx: RouteContext<"/api/staff/cases/[id]/tasks">) {
  const { id } = await ctx.params;
  const notFound = () => Response.json({ error: "사건을 찾을 수 없습니다." }, { status: 404 });
  if (!isUuid(id)) return notFound();

  const parsed = parseNewTask(await request.json().catch(() => null));
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

  try {
    const found = await getCase(id);
    if (!found) return notFound();
    if (found.closed_at) return Response.json({ error: "종결된 사건에는 할 일을 추가할 수 없습니다." }, { status: 409 });
    const task = await createTask(id, parsed.data);
    return Response.json({ task }, { status: 201 });
  } catch (error) {
    return dbErrorResponse(error);
  }
}
