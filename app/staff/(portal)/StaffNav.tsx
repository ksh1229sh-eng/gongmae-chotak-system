"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import LogoutButton from "./LogoutButton";
import { MENU } from "./menu";

export default function StaffNav({ alertCount }: { alertCount: number | null }) {
  const pathname = usePathname();
  const router = useRouter();

  // 공통 틀은 화면을 옮겨 다녀도 다시 그려지지 않아서, 화면을 옮길 때마다 알림 숫자를 새로 받아 옵니다.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    router.refresh();
  }, [pathname, router]);

  return (
    <header className="border-b border-zinc-200 dark:border-zinc-700">
      <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <Link href="/staff" className="font-bold">
          촉탁업무관리
        </Link>
        <nav aria-label="담당자 메뉴" className="flex flex-1 flex-wrap items-center gap-1">
          {MENU.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm ${
                  active
                    ? "bg-zinc-900 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
              >
                {item.label}
                {item.href === "/staff" && alertCount ? (
                  <span
                    aria-label={`지연·임박 ${alertCount}건`}
                    className="min-w-5 rounded-full bg-red-600 px-1.5 text-center text-xs font-semibold leading-5 text-white"
                  >
                    {alertCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <LogoutButton />
      </div>
    </header>
  );
}
