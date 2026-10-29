import { cookies } from "next/headers";
import { clearLoginAttempts, dbErrorResponse, isLoginLocked, lockLogin, recordLoginAttempt } from "@/lib/db";
import {
  MissingStaffPasswordError,
  SESSION_COOKIE,
  checkStaffPassword,
  clientIp,
  createSessionToken,
  hashIp,
  sessionCookieOptions,
} from "@/lib/session";

const MAX_ATTEMPTS = 5; // 15분 안에 비밀번호를 5번까지만 확인하고, 그 뒤로는 15분 동안 잠급니다.
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
    const locked = () => Response.json({ error: "잠시 후 다시 시도해 주세요 (15분)." }, { status: 429 });
    const lockUntil = () => new Date(Date.now() + WINDOW_MS).toISOString();

    if (await isLoginLocked(ipHash, new Date().toISOString())) return locked();

    // 비밀번호를 보기 전에 시도부터 기록하고 순번을 받습니다. 한도를 넘은 시도는 비밀번호를 확인하지 않습니다.
    const attempt = await recordLoginAttempt(ipHash, new Date(Date.now() - WINDOW_MS).toISOString());
    if (attempt > MAX_ATTEMPTS) {
      if (attempt === MAX_ATTEMPTS + 1) await lockLogin(ipHash, lockUntil());
      return locked();
    }

    if (!checkStaffPassword(password)) {
      if (attempt === MAX_ATTEMPTS) await lockLogin(ipHash, lockUntil()); // 5번째 실패 순간부터 15분
      await sleep(FAILURE_DELAY_MS);
      return Response.json({ error: "비밀번호가 맞지 않습니다." }, { status: 401 });
    }
    await clearLoginAttempts(ipHash);

    (await cookies()).set(SESSION_COOKIE, createSessionToken(), sessionCookieOptions());
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof MissingStaffPasswordError) {
      return Response.json({ error: "서버에 담당자 비밀번호가 설정되지 않았습니다. .env를 확인해 주세요." }, { status: 500 });
    }
    return dbErrorResponse(error);
  }
}
