import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyCancellationRecords,
  bondAmount,
  bondRate,
  cancelTax,
  filingFee,
  isMetroRegion,
  judgeEntries,
} from "../lib/fees.ts";

const entry = (section, rank, purpose, receivedAt, receiptNo, extra = {}) => ({
  section,
  rank,
  purpose,
  receivedAt,
  receiptNo,
  cancelled: false,
  supplementary: false,
  ...extra,
});

test("안내문 예시: 3통, 말소 5건 → 수수료 74,000원", () => {
  assert.equal(filingFee(3, 5), 74_000);
  assert.equal(cancelTax(5), 36_000);
});

test("말소 판단: 소멸 권리·후순위 용익권은 말소, 선순위 용익권은 인수", () => {
  const { base, judged } = judgeEntries([
    entry("갑구", "1", "소유권보존", "2010-01-05", 100),
    entry("을구", "1", "전세권설정", "2012-03-02", 50),
    entry("을구", "2", "근저당권설정", "2015-06-10", 200),
    entry("을구", "2-1", "근저당권변경", "2016-01-01", 10, { supplementary: true }),
    entry("갑구", "2", "가압류", "2018-02-01", 300),
    entry("을구", "3", "임차권설정", "2019-05-05", 400),
    entry("갑구", "3", "압류", "2020-07-07", 500),
    entry("갑구", "4", "공매공고", "2021-01-01", 600),
    entry("을구", "4", "근저당권설정", "2014-01-01", 1, { cancelled: true }),
    entry("갑구", "5", "가처분", "2011-01-01", 20),
  ]);
  assert.equal(base.purpose, "근저당권설정");
  assert.equal(base.receivedAt, "2015-06-10");
  const by = Object.fromEntries(judged.map((j) => [`${j.section}${j.rank}`, j.judgement]));
  assert.deepEqual(by, {
    갑구1: "ignore",
    을구1: "assume",
    을구2: "cancel",
    "을구2-1": "ignore",
    갑구2: "cancel",
    을구3: "cancel",
    갑구3: "cancel",
    갑구4: "ignore",
    을구4: "ignore",
    갑구5: "assume",
  });
  assert.equal(judged.filter((j) => j.judgement === "cancel").length, 4);
});

test("말소 기록이 가리키는 등기는 말소된 것으로 처리", () => {
  const fixed = applyCancellationRecords([
    entry("을구", "3", "근저당권설정", "2015-01-01", 1),
    entry("을구", "5", "3번근저당권설정등기말소", "2018-01-01", 2),
    entry("갑구", "3", "압류", "2016-01-01", 3),
  ]);
  assert.equal(fixed[0].cancelled, true);
  assert.equal(fixed[2].cancelled, false);
  const { judged } = judgeEntries(fixed);
  assert.equal(judged.filter((j) => j.judgement === "cancel").length, 1);
});

test("같은 날 접수는 접수번호로 순서 비교", () => {
  const { judged } = judgeEntries([
    entry("을구", "1", "지상권설정", "2020-01-01", 5),
    entry("을구", "2", "근저당권설정", "2020-01-01", 6),
  ]);
  assert.equal(judged[0].judgement, "assume");
});

test("말소기준권리가 없으면 용익권은 판단 불가", () => {
  const { base, judged } = judgeEntries([entry("을구", "1", "전세권설정", "2020-01-01", 1)]);
  assert.equal(base, null);
  assert.equal(judged[0].judgement, "unknown");
});

test("소유권이전청구권가등기는 순서에 따라, 담보가등기는 항상 말소", () => {
  const { judged } = judgeEntries([
    entry("갑구", "2", "소유권이전청구권가등기", "2019-01-01", 1),
    entry("갑구", "3", "소유권이전담보가등기", "2020-01-01", 2),
  ]);
  assert.equal(judged[0].judgement, "assume");
  assert.equal(judged[1].judgement, "cancel");
});

test("국민주택채권: 최저 기준 미만은 매입 안 함", () => {
  assert.equal(bondAmount("land", true, 4_999_999), 0);
  assert.equal(bondAmount("house", true, 19_999_999), 0);
  assert.equal(bondAmount("other", false, 9_999_999), 0);
});

test("국민주택채권: 구간 경계와 1만원 미만 사사오입", () => {
  assert.equal(bondRate("house", true, 50_000_000), 19);
  assert.equal(bondRate("house", false, 49_999_999), 13);
  // 1억2천만원 주택, 광역시 2.1% = 2,520,000
  assert.equal(bondAmount("house", true, 120_000_000), 2_520_000);
  // 토지 1,234,5670원 × 2.0% = 246,913.4 → 250,000
  assert.equal(bondAmount("land", false, 12_345_670), 250_000);
  // 정확히 5천원 단수는 올림: 그 밖 부동산 1,050만원 × 0.8% = 84,000 → 80,000 (4천원 버림)
  assert.equal(bondAmount("other", false, 10_500_000), 80_000);
  // 1,062.5만원 × 0.8% = 85,000 → 90,000
  assert.equal(bondAmount("other", false, 10_625_000), 90_000);
});

test("특별시·광역시 판정", () => {
  assert.equal(isMetroRegion("서울특별시 강남구"), true);
  assert.equal(isMetroRegion("부산광역시 남구"), true);
  assert.equal(isMetroRegion("경기도 수원시"), false);
  assert.equal(isMetroRegion("세종특별자치시"), null);
  assert.equal(isMetroRegion("전남광주통합특별시 서구"), null);
});
