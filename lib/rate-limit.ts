// 로그인 없이 열린 챗봇·등기부 API의 남용(반복 호출로 OpenAI 비용이 늘어나는 일)을 막습니다.
// 두 겹입니다: ① 접속지별 10분 한도(정상 사용은 막지 않는 수준) ② 접속지와 상관없는 하루 전체 상한(비용의 최대치).
// 접속지는 IPv6를 /64로 묶어서 보므로 주소를 바꿔 가며 ①을 피할 수 없고, 그래도 뚫려도 ②가 비용의 천장이 됩니다.
import "server-only";
import { countUsageSince, deleteOldUsage, deleteUsage, recordUsageAndCount, type UsageKind } from "@/lib/db";
import { clientIp, hashIp } from "@/lib/session";

const WINDOW_MS = 10 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// 사용량의 단위: 챗봇은 질문 1번, 등기부는 파일 1개. 이 값을 고치면 비용 천장이 바뀝니다.
const PER_IP_10MIN: Record<UsageKind, number> = {
  chat: 30, // 10분에 질문 30번
  registry: 10, // 10분에 등기부 파일 10개 (한 번에 최대 5개)
};
const DAILY_TOTAL: Record<UsageKind, number> = {
  chat: 3000, // 하루 전체 질문 3,000번
  registry: 150, // 하루 전체 등기부 파일 150개 (gpt-4o)
};

const limited = (message: string, status: number, retryAfterSec: number) =>
  Response.json({ error: message }, { status, headers: { "Retry-After": String(retryAfterSec) } });

// 한도를 넘으면 429/503 응답을, 아니면 null을 돌려줍니다. units는 이번 요청의 사용량(등기부는 파일 수).
// 사용 기록 저장소에 문제가 생겨도 정상 이용자를 막지 않도록 통과시키고, 서버 기록에만 남깁니다.
export async function limitOrNull(request: Request, kind: UsageKind, units = 1): Promise<Response | null> {
  let ids: string[] = [];
  try {
    const now = Date.now();
    const rec = await recordUsageAndCount(hashIp(clientIp(request)), kind, new Date(now - WINDOW_MS).toISOString(), units);
    ids = rec.ids;
    if (Math.random() < 0.02) await deleteOldUsage(new Date(now - 2 * DAY_MS).toISOString());

    if (rec.rank > PER_IP_10MIN[kind]) {
      await deleteUsage(ids);
      return limited("요청이 너무 많습니다. 10분 정도 뒤에 다시 시도해 주세요.", 429, WINDOW_MS / 1000);
    }
    if ((await countUsageSince(kind, new Date(now - DAY_MS).toISOString())) > DAILY_TOTAL[kind]) {
      await deleteUsage(ids);
      return limited("오늘 이용 가능한 횟수를 모두 사용했습니다. 내일 다시 이용해 주세요.", 503, 3600);
    }
  } catch (error) {
    console.error("사용 횟수 확인 실패", error instanceof Error ? error.message : error);
  }
  return null;
}
