import { cookies } from "next/headers";
import { countLoginFailures, dbErrorResponse, recordLoginFailure } from "@/lib/db";
import {
  MissingStaffPasswordError,
  SESSION_COOKIE,
  checkStaffPassword,
  clientIp,
  createSessionToken,
  hashIp,
  sessionCookieOptions,
} from "@/lib/session";

const MAX_FAILURES = 5; // 15분 안에 5번까지 틀릴 수 있고, 그 뒤로는 잠급니다.
const WINDOW_MS = 15 * 60 * 1000;
const FAILURE_DELAY_MS = 1000; // 틀릴 때마다 1초 늦게 답해 대입 속도를 늦춥니다.

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 담당자 공용 비밀번호를 확인하고, 맞으면 12시간짜리 로그인 쿠키를 줍니다.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const password: unknown = body?.password;
  if (typeof password !== "string" || !password || password.length > 200) {
    return Response.json({ error: "비밀번호를 입력해 주세요." }, { status: 400 });
  }

  try {
    const ipHash = hashIp(clientIp(request));
    const since = new Date(Date.now() - WINDOW_MS).toISOString();
    if ((await countLoginFailures(ipHash, since)) >= MAX_FAILURES) {
      return Response.json({ error: "잠시 후 다시 시도해 주세요 (15분)." }, { status: 429 });
    }

    if (!checkStaffPassword(password)) {
      await recordLoginFailure(ipHash);
      await sleep(FAILURE_DELAY_MS);
      return Response.json({ error: "비밀번호가 맞지 않습니다." }, { status: 401 });
    }

    (await cookies()).set(SESSION_COOKIE, createSessionToken(), sessionCookieOptions());
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof MissingStaffPasswordError) {
      return Response.json({ error: "서버에 담당자 비밀번호가 설정되지 않았습니다. .env를 확인해 주세요." }, { status: 500 });
    }
    return dbErrorResponse(error);
  }
}
