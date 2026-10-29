import { test } from "node:test";
import assert from "node:assert/strict";
import { bondAmount, bondRate } from "../lib/fees.ts";
import { LAW_LINES, LAW_TEXT } from "../lib/law.ts";

test("법령 근거 줄은 모두 [법:이름]으로 시작하고, 챗봇에 넘기는 글에 출처가 있음", () => {
  assert.ok(LAW_LINES.length > 0);
  for (const line of LAW_LINES) assert.match(line, /^\[법:주택도시기금법[^\]]+\] \S/);
  assert.match(LAW_TEXT, /^\[법령 출처\] 국가법령정보센터/);
});

// 주택도시기금법 시행령 별표 부표 제15호 가목(소유권의 보존 또는 이전, 유상)의 요율을 원문에서 옮긴 값(‰)과 lib/fees.ts가 같은지 확인한다.
// 형식: [종류, 특별시·광역시 여부, 시가표준액, 요율‰]. 구간 경계의 바로 아래·바로 위를 함께 본다.
const OFFICIAL = [
  ["house", true, 19_999_999, 0], ["house", true, 20_000_000, 13], ["house", false, 49_999_999, 13],
  ["house", true, 50_000_000, 19], ["house", false, 50_000_000, 14],
  ["house", true, 100_000_000, 21], ["house", false, 100_000_000, 16],
  ["house", true, 160_000_000, 23], ["house", false, 160_000_000, 18],
  ["house", true, 260_000_000, 26], ["house", false, 260_000_000, 21],
  ["house", true, 600_000_000, 31], ["house", false, 600_000_000, 26],
  ["land", true, 4_999_999, 0], ["land", true, 5_000_000, 25], ["land", false, 5_000_000, 20],
  ["land", true, 50_000_000, 40], ["land", false, 50_000_000, 35],
  ["land", true, 100_000_000, 50], ["land", false, 100_000_000, 45],
  ["other", true, 9_999_999, 0], ["other", true, 10_000_000, 10], ["other", false, 10_000_000, 8],
  ["other", true, 130_000_000, 16], ["other", false, 130_000_000, 14],
  ["other", true, 250_000_000, 20], ["other", false, 250_000_000, 18],
];

test("lib/fees.ts 요율이 시행령 별표 부표 제15호 가목과 같음", () => {
  for (const [kind, metro, value, permille] of OFFICIAL) {
    assert.equal(bondRate(kind, metro, value), permille, `${kind} ${metro ? "특별시·광역시" : "그 밖"} ${value}`);
  }
});

test("1만원 미만 단수: 5천원 이상은 1만원으로, 5천원 미만은 없는 것으로 (시행령 별표 제4호)", () => {
  // 주택 시가표준액 2천만원 × 13‰ = 260,000원(단수 없음)
  assert.equal(bondAmount("house", true, 20_000_000), 260_000);
  // 토지 5,010,000원 × 25‰ = 125,250원 → 단수 5,250원 → 1만원으로 올림
  assert.equal(bondAmount("land", true, 5_010_000), 130_000);
  // 토지 5,000,000원 × 20‰ = 100,000원(그 밖의 지역), 5,010,000 × 20‰ = 100,200원 → 단수 200원 → 없는 것으로
  assert.equal(bondAmount("land", false, 5_010_000), 100_000);
});
