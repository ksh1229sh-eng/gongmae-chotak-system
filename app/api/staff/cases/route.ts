import { parseCaseInput } from "@/lib/case-input";
import { createCase, dbErrorResponse, listCases } from "@/lib/db";
import { syncSendDeadline } from "@/lib/send-deadline";

// 사건 목록: ?status=open(진행 중, 기본) 또는 closed(종결). 할 일도 함께 돌려줍니다.
export async function GET(request: Request) {
  const status = new URL(request.url).searchParams.get("status") ?? "open";
  if (status !== "open" && status !== "closed") {
    return Response.json({ error: "status는 open 또는 closed만 가능합니다." }, { status: 400 });
  }
  try {
    return Response.json({ cases: await listCases(status) });
  } catch (error) {
    return dbErrorResponse(error);
  }
}

// 사건 등록: 관리번호(필수), 물건 요약, 서류 접수일, 메모. 개인정보 형태가 있으면 거부합니다.
// 서류 접수일을 넣으면 "촉탁서 발송 기한(접수일 + 7일)" 할 일이 자동으로 함께 만들어집니다.
export async function POST(request: Request) {
  const parsed = parseCaseInput(await request.json().catch(() => null), "create");
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  try {
    const created = await createCase({ ...parsed.data, case_no: parsed.data.case_no! });
    const warning = await syncSendDeadline(created.id, created.docs_received_on);
    return Response.json({ case: created, ...(warning ? { warning } : {}) }, { status: 201 });
  } catch (error) {
    return dbErrorResponse(error);
  }
}
