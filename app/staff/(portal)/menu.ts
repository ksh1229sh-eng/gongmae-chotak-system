// 담당자 화면 위쪽 메뉴 목록. 실제 메뉴(StaffNav)와 로딩 중 대체 메뉴(layout.tsx)가 함께 씁니다.
export const MENU = [
  { href: "/staff", label: "알림", exact: true },
  { href: "/staff/cases", label: "사건" },
  { href: "/staff/handover", label: "인수인계" },
  { href: "/staff/manual", label: "매뉴얼" },
];
