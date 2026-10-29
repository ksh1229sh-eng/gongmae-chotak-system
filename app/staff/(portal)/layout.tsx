import { Suspense } from "react";
import { alertSummary, todayKST } from "@/lib/cases";
import { listOpenTasks } from "@/lib/db";
import StaffNav from "./StaffNav";

// 메뉴 옆에 붙일 "지연+임박" 건수. 저장소에 문제가 있어도 화면 틀은 열리도록 숫자만 생략합니다.
async function loadAlertCount(): Promise<number | null> {
  try {
    return alertSummary(await listOpenTasks(), todayKST()).count;
  } catch {
    return null;
  }
}

// 요청마다 바뀌는 데이터를 읽는 부분은 Suspense로 감싸 둡니다. (Cache Components 규칙)
// 메뉴 틀은 먼저 보이고, 숫자는 준비되는 대로 따라 나타납니다.
async function NavWithAlerts() {
  return <StaffNav alertCount={await loadAlertCount()} />;
}

// 로그인한 담당자가 보는 모든 화면(/staff 아래, 로그인 화면 제외)의 공통 틀입니다.
export default function StaffLayout({ children }: LayoutProps<"/staff">) {
  return (
    <div className="flex flex-1 flex-col">
      <Suspense fallback={<StaffNav alertCount={null} />}>
        <NavWithAlerts />
      </Suspense>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
