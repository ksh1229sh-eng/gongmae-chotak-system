"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import RegistryResult, { type RegistryResultData } from "./RegistryResult";

type Message =
  | { kind: "text"; role: "user" | "assistant"; content: string; error?: boolean }
  | { kind: "registry"; data: RegistryResultData };

const EXAMPLES = [
  "잔금 낸 다음에 무엇부터 해야 하나요?",
  "국민주택채권은 어떻게 사나요?",
  "우표는 왜 필요한가요?",
];

export default function ChatBot() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const listEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const push = (m: Message) => setMessages((prev) => [...prev, m]);

  async function send(text = input) {
    const question = text.trim();
    if (!question || busy) return;

    const history = messages
      .filter((m): m is Extract<Message, { kind: "text" }> => m.kind === "text" && !m.error)
      .map(({ role, content }) => ({ role, content }));
    setMessages((prev) => [
      ...prev,
      { kind: "text", role: "user", content: question },
      { kind: "text", role: "assistant", content: "" },
    ]);
    setInput("");
    setBusy(true);

    const setAnswer = (update: (content: string) => Partial<Message>) =>
      setMessages((prev) => {
        const last = prev[prev.length - 1] as Extract<Message, { kind: "text" }>;
        return [...prev.slice(0, -1), { ...last, ...update(last.content) } as Message];
      });

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "답변을 받지 못했어요");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setAnswer((content) => ({ content: content + chunk }));
      }
    } catch (error) {
      setAnswer(() => ({
        content: error instanceof Error ? error.message : "답변을 받지 못했어요",
        error: true,
      }));
    } finally {
      setBusy(false);
    }
  }

  async function attach(fileList: FileList | null) {
    const files = Array.from(fileList ?? []);
    if (fileRef.current) fileRef.current.value = "";
    if (!files.length || busy) return;

    push({ kind: "text", role: "user", content: `등기부 ${files.length}개 첨부: ${files.map((f) => f.name).join(", ")}` });
    push({ kind: "text", role: "assistant", content: "등기부를 읽고 말소 대상을 판단하는 중입니다… (30초 정도 걸릴 수 있어요)" });
    setBusy(true);

    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    try {
      const res = await fetch("/api/registry", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "등기부를 분석하지 못했어요");
      setMessages((prev) => [...prev.slice(0, -1), { kind: "registry", data }]);
    } catch (error) {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        {
          kind: "text",
          role: "assistant",
          content: error instanceof Error ? error.message : "등기부를 분석하지 못했어요",
          error: true,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6">
      <header className="mb-4 space-y-1">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-xl font-bold">공매 소유권이전 상담 챗봇</h1>
          {/* 담당자 화면 입구: 링크만 보이고, 들어가려면 공용 비밀번호가 필요합니다. */}
          <Link
            href="/staff"
            className="shrink-0 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800"
          >
            담당자 화면 →
          </Link>
        </div>
        <p className="text-sm text-zinc-500">
          한국자산관리공사 「압류재산 소유권이전 준비서류 및 절차 안내」만 근거로 답합니다. 부동산 공매만 안내해요.
        </p>
        <p className="text-xs text-red-600 dark:text-red-400">
          이름, 주민등록번호, 주소, 연락처 같은 개인정보는 입력하지 마세요.
        </p>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto">
        {messages.length === 0 && (
          <div className="space-y-2 text-sm text-zinc-500">
            <p>예시 질문을 눌러 보거나, 등기사항전부증명서 PDF를 첨부하면 말소 건수와 비용을 계산해 드려요.</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((q) => (
                <button
                  key={q}
                  type="button"
                  className="rounded-full border border-zinc-300 px-3 py-1 hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800"
                  onClick={() => send(q)}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) =>
          m.kind === "registry" ? (
            <div key={i} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
              <RegistryResult data={m.data} />
            </div>
          ) : (
            <div
              key={i}
              className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                m.role === "user"
                  ? "ml-auto bg-blue-600 text-white"
                  : m.error
                    ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                    : "bg-zinc-100 dark:bg-zinc-800"
              }`}
            >
              {m.content || "…"}
            </div>
          ),
        )}
        <div ref={listEndRef} />
      </div>

      <form
        className="mt-4 space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-600"
            placeholder="소유권이전 절차나 서류에 대해 물어보세요"
            maxLength={1000}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            보내기
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-800 disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-200"
          >
            등기부 첨부 (PDF)
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            hidden
            onChange={(e) => attach(e.target.files)}
          />
          <span>
            최대 5개·합계 4MB. 첨부 파일은 권리 목록을 읽기 위해 AI 서비스(OpenAI)로 전송되며, 서버에 저장하지 않습니다.
          </span>
        </div>
      </form>
    </div>
  );
}
