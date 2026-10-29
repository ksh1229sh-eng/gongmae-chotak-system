import { Suspense } from "react";
import LoginForm from "./LoginForm";

export const metadata = { title: "담당자 로그인 · 공매촉탁업무통합관리시스템" };

export default function StaffLoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16">
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-bold">촉탁업무관리</h1>
        <p className="text-sm text-zinc-500">한국자산관리공사 촉탁 담당자 전용 화면입니다.</p>
      </div>
      {/* 주소의 next 값을 읽기 때문에 Suspense로 감쌉니다. */}
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
