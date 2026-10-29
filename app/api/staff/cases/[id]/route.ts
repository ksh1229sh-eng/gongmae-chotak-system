import { isUuid, parseCaseInput } from "@/lib/case-input";
import { dbErrorResponse, getCase, updateCase } from "@/lib/db";
import { syncSendDeadline } from "@/lib/send-deadline";

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
// 종결된 사건은 메모만 보충할 수 있고, 다른 칸을 보내면 거절합니다. (화면도 같은 규칙입니다)
export async function PATCH(request: Request, ctx: RouteContext<"/api/staff/cases/[id]">) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return NOT_FOUND();
  const parsed = parseCaseInput(await request.json().catch(() => null), "update");
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  const memoOnly = Object.keys(parsed.data).every((key) => key === "memo");
  try {
    const updated = await updateCase(id, parsed.data, { onlyOpen: !memoOnly });
    if (!updated) {
      // 없는 사건이거나(404), 종결돼서 메모 외 칸을 고칠 수 없는 경우(409)
      return (await getCase(id))
        ? Response.json({ error: "종결된 사건은 메모만 보충할 수 있습니다." }, { status: 409 })
        : NOT_FOUND();
    }
    // 서류 접수일을 넣거나 고치거나 비웠으면 "촉탁서 발송 기한" 할 일을 만들거나 기한을 갱신하거나 정리합니다. (종결 사건은 제외)
    const warning =
      "docs_received_on" in parsed.data && !updated.closed_at
        ? await syncSendDeadline(id, parsed.data.docs_received_on ?? null)
        : null;
    return Response.json({ case: updated, ...(warning ? { warning } : {}) });
  } catch (error) {
    return dbErrorResponse(error);
  }
}
