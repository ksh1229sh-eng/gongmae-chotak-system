// 메뉴는 먼저 연결해 두고, 화면 내용은 PLAN의 해당 작업에서 채웁니다.
export default function ComingSoon({ title, plan }: { title: string; plan: string }) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-2 px-4 py-6">
      <h1 className="text-xl font-bold">{title}</h1>
      <p className="text-sm text-zinc-500">이 화면은 {plan}에서 만듭니다.</p>
    </main>
  );
}
