import ComingSoon from "./ComingSoon";

export const metadata = { title: "알림 · 공매촉탁업무통합관리시스템" };

// 로그인 뒤 처음 보는 화면입니다. 지연·임박 알림 목록은 PLAN 18번에서 만듭니다.
export default function StaffAlertsPage() {
  return <ComingSoon title="알림" plan="PLAN 18번" />;
}
