import Link from "next/link";
import { Suspense } from "react";
import { alertSummary, todayKST } from "@/lib/cases";
import { listOpenTasks } from "@/lib/db";
import LogoutButton from "./LogoutButton";
import StaffNav from "./StaffNav";
import { MENU } from "./menu";

// 메뉴 옆에 붙일 "지연+임박" 건수. 저장소에 문제가 있어도 화면 틀은 열리도록 숫자만 생략합니다.
async function loadAlertCount(): Promise<number | null> {
  try {
    return alertSummary(await listOpenTasks(), todayKST()).count;
  } catch {
    return null;
  }
}

// 요청마다 바뀌는 데이터를 읽는 부분은 Suspense로 감싸 둡니다. (Cache Components 규칙)
async function NavWithAlerts() {
  return <StaffNav alertCount={await loadAlertCount()} />;
}

// 준비되기 전에 먼저 보이는 대체 메뉴. 현재 주소를 읽지 않아서(강조·숫자 없음) 어떤 화면에서도 미리 만들 수 있습니다.
function NavFallback() {
  return (
    <header className="border-b border-zinc-200 dark:border-zinc-700">
      <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <Link href="/staff" className="font-bold">
          촉탁업무관리
        </Link>
        <nav aria-label="담당자 메뉴" className="flex flex-1 flex-wrap items-center gap-1">
          {MENU.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <LogoutButton />
      </div>
    </header>
  );
}

// 로그인한 담당자가 보는 모든 화면(/staff 아래, 로그인 화면 제외)의 공통 틀입니다.
export default function StaffLayout({ children }: LayoutProps<"/staff">) {
  return (
    <div className="flex flex-1 flex-col">
      <Suspense fallback={<NavFallback />}>
        <NavWithAlerts />
      </Suspense>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
