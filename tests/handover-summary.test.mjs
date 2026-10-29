import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSummarySource, findUnrecordedFacts, normalizeLines, toSummaryCase } from "../lib/handover-summary.ts";

const task = (title, due_on, done = false, level = "none") => ({ title, due_on, done, level });
const base = {
  case_no: "2026-0012",
  stage: "보완 요청",
  memo: "보완서류\n재접수   확인",
  tasks: [
    task("촉탁서 발송 기한", "2026-10-22", false, "overdue"),
    task("임차권 말소 확인", "2026-12-08", false, "ok"),
    task("서류 접수 확인", null, false, "none"),
    task("끝낸 일", "2026-10-01", true, "overdue"),
  ],
};

test("AI에게 보낼 기록: 관리번호·단계·할 일·메모만, 완료한 할 일은 개수만", () => {
  const src = buildSummarySource(base);
  assert.equal(
    src,
    [
      "관리번호: 2026-0012",
      "진행 단계: 보완 요청",
      "남은 할 일 3건, 완료한 할 일 1건",
      "가장 급한 할 일: 촉탁서 발송 기한 (기한 2026-10-22, 지연)",
      "- 미완료: 촉탁서 발송 기한 (기한 2026-10-22, 지연)",
      "- 미완료: 임차권 말소 확인 (기한 2026-12-08)",
      "- 미완료: 서류 접수 확인 (기한 없음)",
      "메모: 보완서류 재접수 확인",
    ].join("\n"),
  );
  assert.ok(!src.includes("끝낸 일"));
});

test("할 일은 코드가 급한 순으로 정렬: 지연 → 임박 → 여유 → 기한 없음, 같으면 기한 이른 순", () => {
  const src = buildSummarySource({
    case_no: "A",
    stage: "서류 접수",
    memo: "",
    tasks: [
      task("여유", "2026-12-01", false, "ok"),
      task("기한없음", null, false, "none"),
      task("임박", "2026-10-31", false, "soon"),
      task("지연-최근", "2026-10-27", false, "overdue"),
      task("지연-오래됨", "2026-10-01", false, "overdue"),
    ],
  });
  const order = src.split("\n").filter((l) => l.startsWith("- 미완료")).map((l) => l.split(" (")[0].replace("- 미완료: ", ""));
  // 이름은 가장 급한 4개까지만 보여 주고, 나머지는 개수로만 알려 준다
  assert.deepEqual(order, ["지연-오래됨", "지연-최근", "임박", "여유"]);
  assert.match(src, /- 그 밖의 미완료 할 일: 1건 \(덜 급한 순, 이름은 생략\)/);
  assert.match(src, /남은 할 일 5건/);
  assert.match(src, /가장 급한 할 일: 지연-오래됨 \(기한 2026-10-01, 지연\)/);
});

test("할 일이 4개 이하면 '그 밖의' 줄이 없음", () => {
  const four = ["a", "b", "c", "d"].map((n) => task(n, "2026-10-01", false, "overdue"));
  assert.ok(!buildSummarySource({ case_no: "B", stage: "서류 접수", memo: "", tasks: four }).includes("그 밖의 미완료"));
  const src = buildSummarySource({ case_no: "B", stage: "서류 접수", memo: "", tasks: [task("a", "2026-10-01", false, "overdue"), task("b", null)] });
  assert.ok(!src.includes("그 밖의 미완료"));
});

test("메모가 없으면 '없음', 할 일이 없으면 0건", () => {
  const src = buildSummarySource({ case_no: "A", stage: "서류 접수", memo: "  ", tasks: [] });
  assert.match(src, /남은 할 일 0건, 완료한 할 일 0건/);
  assert.match(src, /가장 급한 할 일: 없음/);
  assert.match(src, /메모: 없음$/);
});

test("저장소 모양을 요약용으로 바꿈: 기한 상태는 코드가 정함", () => {
  const out = toSummaryCase(
    { case_no: "X", memo: "m", tasks: [{ title: "t", due_on: "2026-10-01", done_at: null }, { title: "u", due_on: null, done_at: "2026-10-02T00:00:00Z" }] },
    "촉탁서 발송",
    (due) => (due ? "overdue" : "none"),
  );
  assert.deepEqual(out.tasks, [
    { title: "t", due_on: "2026-10-01", done: false, level: "overdue" },
    { title: "u", due_on: null, done: true, level: "none" },
  ]);
  assert.equal(out.stage, "촉탁서 발송");
});

test("기록에 있는 날짜·숫자만 쓴 요약은 통과", () => {
  const src = buildSummarySource(base);
  assert.deepEqual(findUnrecordedFacts("보완 요청 단계, 2026-10-22 발송 기한이 지연된 상태입니다.", src), []);
  assert.deepEqual(findUnrecordedFacts("남은 할 일은 3건이며 완료한 일은 1건입니다.", src), []);
  assert.deepEqual(findUnrecordedFacts("10월 22일 기한이 지연되었습니다.", src), []); // 같은 날짜를 풀어 쓴 것
});

test("기록에 없는 날짜·숫자를 지어내면 잡아냄", () => {
  const src = buildSummarySource(base);
  assert.deepEqual(findUnrecordedFacts("2026-11-30까지 처리해야 합니다.", src), ["2026-11-30", "11", "30"]);
  assert.deepEqual(findUnrecordedFacts("기한이 7일 지났습니다.", src), ["7"]);
  assert.deepEqual(findUnrecordedFacts("남은 할 일은 5건입니다.", src), ["5"]);
  // 같은 틀린 값이 여러 번 나와도 한 번만 알림
  assert.deepEqual(findUnrecordedFacts("9건, 또 9건", src), ["9"]);
});

test("기록에 없는 기한 상태를 덧붙이면 잡아냄: 17일 남은 기한을 '임박'이라고 쓰는 경우", () => {
  const ok = buildSummarySource({ case_no: "A", stage: "서류 접수", memo: "", tasks: [task("발송", "2026-11-15", false, "ok")] });
  assert.deepEqual(findUnrecordedFacts("2026-11-15로 임박합니다.", ok), ["임박"]);
  assert.deepEqual(findUnrecordedFacts("2026-11-15까지 처리해야 합니다.", ok), []);
  // 기록에 상태가 적혀 있으면 그대로 써도 통과
  const soon = buildSummarySource({ case_no: "A", stage: "서류 접수", memo: "", tasks: [task("발송", "2026-10-30", false, "soon")] });
  assert.deepEqual(findUnrecordedFacts("2026-10-30로 임박합니다.", soon), []);
  // 지연이 기록에 있어도 임박은 따로 확인한다
  const late = buildSummarySource({ case_no: "A", stage: "서류 접수", memo: "", tasks: [task("발송", "2026-10-01", false, "overdue")] });
  assert.deepEqual(findUnrecordedFacts("2026-10-01 지연, 곧 임박합니다.", late), ["임박"]);
});

test("줄 정리: 빈 줄·글자 아닌 값은 빼고 최대 3줄", () => {
  assert.deepEqual(normalizeLines(["  첫째   줄 ", "", null, "둘째", "셋째", "넷째"]), ["첫째 줄", "둘째", "셋째"]);
  assert.deepEqual(normalizeLines(["", "  "]), []);
});
