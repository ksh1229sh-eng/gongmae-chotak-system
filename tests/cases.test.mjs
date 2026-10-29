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
  sendDeadline,
  sortByUrgency,
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
  assert.equal(isDate("2026-1-5"), false);
  assert.equal(isDate(20261029), false);
});
