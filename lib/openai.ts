// 서버에서만 쓰는 OpenAI 호출 도우미입니다.
// 키는 .env의 OPENAI_API_KEY에서 읽고, 브라우저로는 절대 보내지 않습니다.
import "server-only";

export const CHAT_MODEL = "gpt-4o-mini";
// 등기부 표·취소선을 정확히 읽어야 해서 더 큰 모델을 씁니다.
export const REGISTRY_MODEL = "gpt-4o";

const OPENAI_URL = "https://api.openai.com/v1";

export class MissingKeyError extends Error {}

function apiKey() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new MissingKeyError("OPENAI_API_KEY가 .env에 없습니다.");
  return key;
}

export async function openaiFetch(path: string, body: unknown) {
  const res = await fetch(`${OPENAI_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey()}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    // 응답 본문에는 키가 들어 있지 않지만, 사용자에게는 상태 코드만 알립니다.
    console.error("OpenAI 오류", res.status, await res.text());
    throw new Error(`OpenAI 요청 실패 (${res.status})`);
  }
  return res;
}

export function errorResponse(error: unknown) {
  if (error instanceof MissingKeyError) {
    return Response.json(
      { error: "서버에 OpenAI 키가 설정되지 않았습니다. .env를 확인해 주세요." },
      { status: 500 },
    );
  }
  return Response.json(
    { error: "AI 서버와 통신 중 문제가 생겼습니다. 잠시 후 다시 시도해 주세요." },
    { status: 502 },
  );
}
