"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();

  async function logout() {
    await fetch("/api/staff/logout", { method: "POST" }).catch(() => null);
    router.replace("/staff/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={logout}
      className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
    >
      로그아웃
    </button>
  );
}
