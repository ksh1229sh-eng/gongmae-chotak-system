// 로그인 없이 열린 챗봇·등기부 API의 남용(반복 호출로 OpenAI 비용이 늘어나는 일)을 막습니다.
// 정상적인 매수자의 사용(질문 몇십 개, 등기부 1~5개)은 막지 않는 수준으로 잡았습니다.
import "server-only";
import { deleteOldUsage, recordUsageAndCount, type UsageKind } from "@/lib/db";
import { clientIp, hashIp } from "@/lib/session";

const WINDOW_MS = 10 * 60 * 1000;
const LIMITS: Record<UsageKind, number> = {
  chat: 30, // 10분에 질문 30번
  registry: 6, // 10분에 등기부 분석 6번 (한 번에 최대 5개씩 올릴 수 있음)
};

// 한도를 넘으면 429 응답을, 아니면 null을 돌려줍니다.
// 사용 기록 저장소에 문제가 생겨도 정상 이용자를 막지 않도록 통과시키고, 서버 기록에만 남깁니다.
export async function limitOrNull(request: Request, kind: UsageKind): Promise<Response | null> {
  try {
    const now = Date.now();
    const count = await recordUsageAndCount(hashIp(clientIp(request)), kind, new Date(now - WINDOW_MS).toISOString());
    if (Math.random() < 0.02) await deleteOldUsage(new Date(now - 24 * 60 * 60 * 1000).toISOString());
    if (count > LIMITS[kind]) {
      return Response.json(
        { error: "요청이 너무 많습니다. 10분 정도 뒤에 다시 시도해 주세요." },
        { status: 429, headers: { "Retry-After": String(WINDOW_MS / 1000) } },
      );
    }
  } catch (error) {
    console.error("사용 횟수 확인 실패", error instanceof Error ? error.message : error);
  }
  return null;
}
