import { useRouter } from "next/navigation";
import { useState } from "react";

export type ApiData = {
  error?: string;
  warning?: string;
  remaining?: number;
  tasks?: { id: string; title: string; due_on: string | null }[];
};

// 상세 화면의 모든 조작(단계 변경, 할 일, 메모, 종결)이 같은 방식으로 API를 부르고 결과를 처리합니다.
// 성공하면 화면의 서버 데이터를 새로 받아 오고(router.refresh), 실패하면 API가 준 안내 한 줄을 보여 줍니다.
export function useMutation() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run(method: string, url: string, body?: unknown): Promise<ApiData | null> {
    if (busy) return null;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data: ApiData = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "요청을 처리하지 못했어요.");
        return null;
      }
      router.refresh(); // 목록·메뉴 옆 알림 숫자까지 새로 받아 옵니다.
      return data;
    } catch {
      setError("서버와 연결하지 못했어요. 잠시 후 다시 시도해 주세요.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  return { busy, error, setError, run };
}

export const INPUT = "w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-600";
export const BUTTON = "rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40";
export const BUTTON_SUB =
  "rounded-lg border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-zinc-600";
