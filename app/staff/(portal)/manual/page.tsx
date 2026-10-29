import { GUIDE_TITLE } from "@/lib/guide";
import { MANUAL_SECTIONS } from "./sections";

export const metadata = { title: "업무 매뉴얼 · 공매촉탁업무통합관리시스템" };

export default function StaffManualPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
      <h1 className="text-xl font-bold">업무 매뉴얼</h1>
      <p className="mt-1 text-sm text-zinc-500">
        공개 안내문 「{GUIDE_TITLE}」을 주제별로 나눠 보여 줍니다. 각 내용 위에 안내문 쪽 번호를 적었습니다.
      </p>

      <div className="mt-5 md:flex md:items-start md:gap-8">
        {/* 목차: 넓은 화면은 왼쪽에 붙여 두고, 휴대폰은 위에 가로로 둡니다 */}
        <nav aria-label="매뉴얼 목차" className="md:sticky md:top-4 md:w-48 md:shrink-0">
          <ol className="flex flex-wrap gap-2 md:flex-col md:gap-1">
            {MANUAL_SECTIONS.map((s, i) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="block rounded-md border border-zinc-200 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-900 md:border-0"
                >
                  {i + 1}. {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-6 min-w-0 flex-1 space-y-8 md:mt-0">
          {MANUAL_SECTIONS.map((s, i) => (
            <section key={s.id} id={s.id} className="scroll-mt-4 space-y-3">
              <div>
                <h2 className="text-lg font-semibold">
                  {i + 1}. {s.title}
                </h2>
                <p className="text-sm text-zinc-500">{s.summary}</p>
              </div>
              {s.parts.map((p) => (
                <article key={`${s.id}-${p.page}`} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                  <p className="mb-2 text-xs font-medium text-zinc-500">안내문 p.{p.page}</p>
                  <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">{p.text}</div>
                </article>
              ))}
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
