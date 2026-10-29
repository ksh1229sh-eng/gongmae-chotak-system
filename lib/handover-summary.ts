// 인수인계 AI 요약의 규칙 모음입니다. (PRD 5번 must 2, DESIGN.md 4·8장)
// AI에게 보낼 기록을 만들고, 돌아온 요약이 기록에 없는 날짜·숫자를 지어내지 않았는지 코드가 확인합니다.
// Node가 테스트에서 직접 실행하므로 다른 파일을 불러오지 않고 TypeScript 전용 문법도 쓰지 않습니다.

export type SummaryLevel = "overdue" | "soon" | "ok" | "none";
export type SummaryTask = { title: string; due_on: string | null; done: boolean; level: SummaryLevel };
export type SummaryCase = { case_no: string; stage: string; memo: string; tasks: SummaryTask[] };

export const MAX_SUMMARY_LINES = 3;
export const MAX_LISTED_TASKS = 4; // AI에게 이름까지 보여 주는 미완료 할 일 수 (5개부터 나머지는 개수로만)

const LEVEL_WORD: Record<SummaryLevel, string> = { overdue: "지연", soon: "임박", ok: "", none: "" };

// 저장소의 사건·할 일을 요약용 모양으로 바꿉니다. 기한 상태(지연·임박)는 코드가 정해 주고, AI는 날짜를 계산하지 않습니다.
export function toSummaryCase(
  c: {
    case_no: string;
    memo: string;
    tasks: { title: string; due_on: string | null; done_at: string | null }[];
  },
  stage: string,
  levelOf: (dueOn: string | null) => SummaryLevel,
): SummaryCase {
  return {
    case_no: c.case_no,
    stage,
    memo: c.memo,
    tasks: c.tasks.map((t) => ({ title: t.title, due_on: t.due_on, done: !!t.done_at, level: levelOf(t.due_on) })),
  };
}

// AI에게 보내는 기록이자, 요약이 기록에서 벗어나지 않았는지 대조하는 기준입니다.
// 관리번호·진행 단계·할 일·메모만 담고, 물건 요약은 보내지 않습니다. (DESIGN 8장)
export function buildSummarySource(c: SummaryCase): string {
  const open = c.tasks.filter((t) => !t.done);
  // 가장 급한 할 일이 맨 위에 오도록 코드가 먼저 정렬합니다 (지연 → 임박 → 여유 → 기한 없음, 같으면 기한이 이른 순).
  // AI에게 "무엇이 가장 급한지" 고르게 두면 틀리는 일이 있어서, 순서와 "가장 급한 할 일"은 코드가 정해 줍니다.
  const rank: Record<SummaryLevel, number> = { overdue: 0, soon: 1, ok: 2, none: 3 };
  const ordered = [...open].sort(
    (a, b) => rank[a.level] - rank[b.level] || (a.due_on ?? "9999").localeCompare(b.due_on ?? "9999"),
  );
  const describe = (t: SummaryTask) =>
    `${t.title} (${[t.due_on ? `기한 ${t.due_on}` : "기한 없음", LEVEL_WORD[t.level]].filter(Boolean).join(", ")})`;

  const lines = [
    `관리번호: ${c.case_no}`,
    `진행 단계: ${c.stage}`,
    `남은 할 일 ${open.length}건, 완료한 할 일 ${c.tasks.length - open.length}건`,
    `가장 급한 할 일: ${ordered[0] ? describe(ordered[0]) : "없음"}`,
  ];
  // 급한 할 일 4개까지만 이름을 보여 주고, 나머지는 개수만 알려 줍니다. 할 일이 많을 때 AI가 한 줄에 전부 나열해
  // 줄이 길어지거나 개수를 스스로 세다가 틀리는 일을 막기 위해, 줄일 부분과 그 개수를 코드가 미리 정해 둡니다.
  for (const t of ordered.slice(0, MAX_LISTED_TASKS)) lines.push(`- 미완료: ${describe(t)}`);
  if (ordered.length > MAX_LISTED_TASKS) {
    lines.push(`- 그 밖의 미완료 할 일: ${ordered.length - MAX_LISTED_TASKS}건 (덜 급한 순, 이름은 생략)`);
  }
  const memo = c.memo.replace(/\s+/g, " ").trim();
  lines.push(`메모: ${memo || "없음"}`);
  return lines.join("\n");
}

// 요약에 있는데 기록에는 없는 날짜·숫자·기한 상태("지연"·"임박")를 돌려줍니다. 비어 있으면 기록 안에서만 쓴 것입니다.
// 완벽한 사실 검증은 아니고, 지어내기 쉬운 값을 잡는 점검입니다. 기한 상태는 코드가 정하므로, 기록에 없는 상태를 AI가
// 덧붙이면(예: 17일 남은 기한을 "임박"이라고 씀) 후임자가 오해합니다. 이런 말은 단어로 직접 대조합니다.
export function findUnrecordedFacts(summary: string, source: string): string[] {
  const missing: string[] = [];
  for (const word of ["지연", "임박"]) {
    if (summary.includes(word) && !source.includes(word)) missing.push(word);
  }
  for (const date of summary.match(/\d{4}-\d{2}-\d{2}/g) ?? []) {
    if (!source.includes(date)) missing.push(date);
  }
  const recorded = new Set(source.match(/\d+/g) ?? []);
  for (const num of summary.match(/\d+/g) ?? []) {
    if (!recorded.has(num)) missing.push(num);
  }
  return [...new Set(missing)];
}

// AI가 준 줄들을 다듬습니다. 빈 줄은 빼고 최대 3줄까지만 씁니다.
export function normalizeLines(lines: unknown[]): string[] {
  return lines
    .filter((l): l is string => typeof l === "string")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, MAX_SUMMARY_LINES);
}
