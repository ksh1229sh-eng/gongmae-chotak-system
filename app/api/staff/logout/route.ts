import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/session";

// 로그인 쿠키를 지워 담당자 화면에서 나갑니다.
export async function POST() {
  (await cookies()).delete(SESSION_COOKIE);
  return Response.json({ ok: true });
}
