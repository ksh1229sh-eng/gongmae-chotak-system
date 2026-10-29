import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  alertLevel,
  alertSummary,
  canClose,
  daysBetween,
  dueLabel,
  isDate,
  isStage,
  nextTask,
  planSendDeadline,
  previewText,
  sendDeadline,
  sortByUrgency,
  sortCasesByUrgency,
  stageLabel,
  todayKST,
} from "../lib/cases.ts";

const task = (title, due_on, done = false) => ({ title, due_on, done_at: done ? "2026-10-01T00:00:00Z" : null });
const TODAY = "2026-10-29";

test("한국 날짜 기준 오늘: UTC로 전날 밤 15시 이후면 한국은 다음 날", () => {
  assert.equal(todayKST(new Date("2026-10-28T14:59:59Z")), "2026-10-28");
  assert.equal(todayKST(new Date("2026-10-28T15:00:00Z")), "2026-10-29");
});

test("날짜 더하기·차이: 월말과 윤년을 넘어도 정확", () => {
  assert.equal(addDays("2026-10-28", 7), "2026-11-04");
  assert.equal(addDays("2028-02-25", 7), "2028-03-03"); // 2028년은 윤년
  assert.equal(addDays("2026-12-28", 7), "2027-01-04");
  assert.equal(daysBetween("2026-10-29", "2026-11-05"), 7);
  assert.equal(daysBetween("2026-10-29", "2026-10-28"), -1);
});

test("촉탁서 발송 기한 = 서류 접수일 + 7일", () => {
  assert.equal(sendDeadline("2026-10-13"), "2026-10-20");
});

test("발송 기한 할 일: 없으면 만들고, 접수일이 바뀌면 기한 갱신, 같으면 그대로, 접수일을 비우면 안 끝낸 자동 할 일만 지움", () => {
  const auto = (due_on, done = false) => ({ id: "t1", title: "촉탁서 발송 기한", due_on, done_at: done ? "x" : null, auto_kind: "send_deadline" });
  const manual = { id: "t2", title: "직접 만든 할 일", due_on: "2026-10-01", done_at: null, auto_kind: null };
  assert.deepEqual(planSendDeadline("2026-10-13", []), { action: "create", due_on: "2026-10-20" });
  assert.deepEqual(planSendDeadline("2026-10-13", [manual]), { action: "create", due_on: "2026-10-20" });
  assert.deepEqual(planSendDeadline("2026-10-13", [auto("2026-10-20")]), { action: "none" });
  assert.deepEqual(planSendDeadline("2026-10-15", [auto("2026-10-20", true)]), { action: "update", id: "t1", due_on: "2026-10-22" });
  assert.deepEqual(planSendDeadline(null, []), { action: "none" });
  assert.deepEqual(planSendDeadline(null, [manual]), { action: "none" }); // 직접 만든 할 일은 건드리지 않음
  // 접수일을 비우면 아직 안 끝낸 자동 할 일만 지우고, 이미 완료한 것은 기록으로 남김
  assert.deepEqual(planSendDeadline(null, [auto("2026-10-20")]), { action: "delete", id: "t1" });
  assert.deepEqual(planSendDeadline(null, [auto("2026-10-20", true)]), { action: "none" });
});

test("알림 경계: 어제 지연, 오늘~7일 뒤 임박, 8일 뒤 여유, 기한 없음", () => {
  assert.equal(alertLevel("2026-10-28", TODAY), "overdue");
  assert.equal(alertLevel("2026-10-29", TODAY), "soon");
  assert.equal(alertLevel("2026-11-05", TODAY), "soon"); // 7일 뒤
  assert.equal(alertLevel("2026-11-06", TODAY), "ok"); // 8일 뒤
  assert.equal(alertLevel(null, TODAY), "none");
});

test("기한 표시: 지남·D-day·D-n", () => {
  assert.equal(dueLabel("2026-10-26", TODAY), "3일 지남");
  assert.equal(dueLabel("2026-10-29", TODAY), "D-day");
  assert.equal(dueLabel("2026-11-01", TODAY), "D-3");
  assert.equal(dueLabel(null, TODAY), "기한 없음");
});

test("정렬: 지연(오래된 것부터) → 임박(가까운 것부터) → 여유 → 기한 없음", () => {
  const sorted = sortByUrgency(
    [
      task("여유", "2026-12-01"),
      task("기한없음", null),
      task("임박-먼", "2026-11-04"),
      task("지연-최근", "2026-10-27"),
      task("임박-가까운", "2026-10-30"),
      task("지연-오래됨", "2026-10-01"),
    ],
    TODAY,
  );
  assert.deepEqual(
    sorted.map((t) => t.title),
    ["지연-오래됨", "지연-최근", "임박-가까운", "임박-먼", "여유", "기한없음"],
  );
});

test("인수인계 정렬: 가장 급한 할 일 기준, 할 일이 없는 사건은 맨 끝", () => {
  const c = (name, tasks) => ({ name, tasks });
  const sorted = sortCasesByUrgency(
    [
      c("할일없음", []),
      c("모두완료", [task("끝", "2026-10-01", true)]),
      c("여유", [task("a", "2026-12-01")]),
      c("기한없는할일", [task("b", null)]),
      c("임박-먼", [task("c", "2026-11-04")]),
      c("지연-최근", [task("d", "2026-10-27")]),
      c("임박-가까운", [task("e", "2026-10-30"), task("f", "2026-10-01", true)]),
      c("지연-오래됨+여유", [task("g", "2026-12-25"), task("h", "2026-10-01")]),
    ],
    TODAY,
  );
  assert.deepEqual(
    sorted.map((x) => x.name),
    ["지연-오래됨+여유", "지연-최근", "임박-가까운", "임박-먼", "여유", "기한없는할일", "할일없음", "모두완료"],
  );
  // 입력 배열은 바꾸지 않는다
  const original = [c("b", []), c("a", [task("x", "2026-10-01")])];
  sortCasesByUrgency(original, TODAY);
  assert.deepEqual(original.map((x) => x.name), ["b", "a"]);
});

test("메모 앞부분: 줄바꿈·겹친 공백을 한 줄로 합치고 길면 …으로 자름", () => {
  assert.equal(previewText("보완서류\n  재접수   확인"), "보완서류 재접수 확인");
  assert.equal(previewText("  "), "");
  assert.equal(previewText("가".repeat(100)), "가".repeat(100));
  assert.equal(previewText("가".repeat(101)), `${"가".repeat(100)}…`);
  assert.equal(previewText("나다라마바사", 3), "나다라…");
});

test("종결: 남은 할 일이 하나라도 있으면 불가, 모두 완료하면 가능", () => {
  assert.deepEqual(canClose([task("a", null, true), task("b", "2026-11-01")]), { ok: false, remaining: 1 });
  assert.deepEqual(canClose([task("a", null, true), task("b", "2026-11-01", true)]), { ok: true, remaining: 0 });
  assert.deepEqual(canClose([]), { ok: true, remaining: 0 });
});

test("다음 할 일: 완료한 것은 빼고 가장 급한 것", () => {
  const tasks = [task("완료된 지연", "2026-10-01", true), task("임박", "2026-11-02"), task("여유", "2026-12-01")];
  assert.equal(nextTask(tasks, TODAY).title, "임박");
  assert.equal(nextTask([task("완료", null, true)], TODAY), null);
});

test("알림 요약: 미완료 지연·임박만 세고, 여유·기한 없음·완료는 제외", () => {
  const s = alertSummary(
    [
      task("지연", "2026-10-20"),
      task("완료된 지연", "2026-10-20", true),
      task("임박", "2026-11-01"),
      task("여유", "2026-12-01"),
      task("없음", null),
    ],
    TODAY,
  );
  assert.deepEqual(s.overdue.map((t) => t.title), ["지연"]);
  assert.deepEqual(s.soon.map((t) => t.title), ["임박"]);
  assert.equal(s.count, 2);
});

test("진행 단계와 날짜 형식 검사", () => {
  assert.equal(isStage("sent"), true);
  assert.equal(isStage("closed"), false);
  assert.equal(stageLabel("supplement"), "보완 요청");
  assert.equal(isDate("2026-10-29"), true);
  assert.equal(isDate("2026-02-30"), false);
  assert.equal(isDate("2026-13-01"), false); // 달력에 없는 월·일은 오류 없이 false
  assert.equal(isDate("2026-00-10"), false);
  assert.equal(isDate("2026-10-32"), false);
  assert.equal(isDate("2028-02-29"), true); // 윤년
  assert.equal(isDate("2026-1-5"), false);
  assert.equal(isDate(20261029), false);
});
