import LogoutButton from "./LogoutButton";

export const metadata = { title: "담당자 화면 · 공매촉탁업무통합관리시스템" };

// 로그인 뒤 처음 보는 화면입니다. 알림 목록은 PLAN 18번에서 이 자리에 만듭니다.
export default function StaffHomePage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">촉탁업무관리</h1>
        <LogoutButton />
      </div>
      <p className="text-sm text-zinc-500">로그인되었습니다. 알림·사건·인수인계 화면은 차례로 추가됩니다.</p>
    </main>
  );
}
