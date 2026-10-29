"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // 로그인 뒤에는 원래 가려던 담당자 화면으로 돌려보냅니다. (다른 사이트 주소로는 보내지 않음)
  const next = params.get("next");
  const target = next?.startsWith("/staff") ? next : "/staff";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/staff/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.replace(target);
        router.refresh();
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "로그인하지 못했어요.");
      setPassword("");
    } catch {
      setError("서버와 연결하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="w-full max-w-xs space-y-3">
      <label className="block text-sm font-medium" htmlFor="staff-password">
        담당자 비밀번호
      </label>
      <input
        id="staff-password"
        type="password"
        autoComplete="current-password"
        autoFocus
        maxLength={200}
        className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-600"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={busy || !password}
        className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
      >
        {busy ? "확인 중…" : "들어가기"}
      </button>
    </form>
  );
}
