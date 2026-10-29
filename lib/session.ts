// 담당자 로그인 쿠키의 서명·확인 도우미입니다. (DESIGN.md 8장)
// proxy.ts에서도 불러오므로 "server-only"를 붙이지 않습니다. 비밀 값은 실행할 때 .env에서만 읽습니다.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "staff_session";
export const SESSION_SECONDS = 12 * 60 * 60; // 12시간

export class MissingStaffPasswordError extends Error {}

function staffPassword() {
  const pw = process.env.STAFF_PASSWORD;
  if (!pw) throw new MissingStaffPasswordError("STAFF_PASSWORD가 .env에 없습니다.");
  return pw;
}

// 서명 열쇠는 비밀번호와 별개인 무작위 값(SESSION_SECRET)을 씁니다. 열쇠를 비밀번호에서 만들면 쿠키 하나만 손에 넣어도
// 잠금 없이 오프라인에서 비밀번호를 대입해 볼 수 있기 때문입니다. 이 값을 바꾸면 기존 로그인이 모두 풀립니다.
export class MissingSessionSecretError extends Error {}

const MIN_SECRET_LENGTH = 32;

function signingKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new MissingSessionSecretError("SESSION_SECRET이 .env에 없거나 32자보다 짧습니다.");
  }
  return createHash("sha256").update(`staff-session:${secret}`).digest();
}

function sign(payload: string) {
  return createHmac("sha256", signingKey()).update(payload).digest("base64url");
}

// 길이가 달라도 걸리는 시간이 같도록 해시끼리 비교합니다 (시간차로 비밀번호를 알아내는 공격 방지).
function safeEqual(a: string, b: string) {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function checkStaffPassword(input: string): boolean {
  return safeEqual(input, staffPassword());
}

// 쿠키 값 = "만료시각(초).서명"
export function createSessionToken(nowMs: number = Date.now()): string {
  const exp = String(Math.floor(nowMs / 1000) + SESSION_SECONDS);
  return `${exp}.${sign(exp)}`;
}

export function verifySessionToken(token: string | undefined, nowMs: number = Date.now()): boolean {
  if (!token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || !/^\d+$/.test(exp)) return false;
  try {
    if (!safeEqual(sig, sign(exp))) return false;
  } catch {
    return false; // 비밀번호나 서명 열쇠 설정이 없으면 아무도 들어갈 수 없습니다.
  }
  return Number(exp) * 1000 > nowMs;
}

// 접속지(IP)는 그대로 저장하지 않고, 비밀 값을 섞은 요약값으로 바꿔 둡니다.
export function hashIp(ip: string): string {
  return createHmac("sha256", signingKey()).update(`ip:${ip}`).digest("hex").slice(0, 32);
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0].trim() || request.headers.get("x-real-ip") || "unknown";
}

export function sessionCookieOptions() {
  return {
    httpOnly: true, // 화면의 자바스크립트로는 읽을 수 없게
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_SECONDS,
  };
}
