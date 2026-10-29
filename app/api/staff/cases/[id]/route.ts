import { isUuid, parseCaseInput } from "@/lib/case-input";
import { dbErrorResponse, getCase, updateCase } from "@/lib/db";

const NOT_FOUND = () => Response.json({ error: "사건을 찾을 수 없습니다." }, { status: 404 });

// 사건 상세 (할 일 포함)
export async function GET(_request: Request, ctx: RouteContext<"/api/staff/cases/[id]">) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return NOT_FOUND();
  try {
    const found = await getCase(id);
    return found ? Response.json({ case: found }) : NOT_FOUND();
  } catch (error) {
    return dbErrorResponse(error);
  }
}

// 사건 수정: 관리번호·물건 요약·서류 접수일·메모·진행 단계 중 보낸 칸만 고칩니다.
// 진행 단계는 종결된 사건에서는 바꿀 수 없습니다. 종결은 PLAN 14번 API에서 다룹니다.
export async function PATCH(request: Request, ctx: RouteContext<"/api/staff/cases/[id]">) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return NOT_FOUND();
  const parsed = parseCaseInput(await request.json().catch(() => null), "update");
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  try {
    if (parsed.data.stage) {
      const current = await getCase(id);
      if (!current) return NOT_FOUND();
      if (current.closed_at) {
        return Response.json({ error: "종결된 사건은 진행 단계를 바꿀 수 없습니다." }, { status: 409 });
      }
    }
    const updated = await updateCase(id, parsed.data);
    return updated ? Response.json({ case: updated }) : NOT_FOUND();
  } catch (error) {
    return dbErrorResponse(error);
  }
}
