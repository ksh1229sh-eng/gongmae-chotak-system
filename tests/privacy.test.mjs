import { test } from "node:test";
import assert from "node:assert/strict";
import { findPersonalInfo, personalInfoMessage } from "../lib/privacy.ts";

test("주민등록번호: 하이픈·붙여 쓰기·뒷자리 가림 모두 찾음", () => {
  for (const s of ["800101-1234567", "8001011234567", "매수자 800101 - 2234567 확인", "800101-1******"]) {
    assert.deepEqual(findPersonalInfo(s), ["주민등록번호"], s);
  }
});

test("전화번호: 휴대전화·지역번호·070 찾음", () => {
  for (const s of ["010-1234-5678", "01012345678", "연락처 010 1234 5678", "02-123-4567", "031-1234-5678", "070-1234-5678"]) {
    assert.deepEqual(findPersonalInfo(s), ["전화번호"], s);
  }
});

test("업무에 흔한 숫자는 통과: 날짜·관리번호·대표번호·금액·접수번호·사건번호", () => {
  for (const s of [
    "2026-10-29까지 촉탁서 발송",
    "관리번호 2026-0012",
    "캠코 1588-5321 문의",
    "채권최고액 금120,000,000원",
    "접수 제12345호",
    "2024타경12345",
    "경기 수원 아파트 1세대",
  ]) {
    assert.deepEqual(findPersonalInfo(s), [], s);
  }
});

test("두 종류가 함께 있으면 둘 다", () => {
  assert.deepEqual(findPersonalInfo("800101-1234567 / 010-1234-5678"), ["주민등록번호", "전화번호"]);
});

test("안내 문장: 어느 칸인지 알려 주고, 없으면 null", () => {
  assert.equal(
    personalInfoMessage({ "물건 요약": "아파트", 메모: "매수자 010-1234-5678" }),
    "메모에 전화번호로 보이는 내용이 있습니다. 개인정보는 적지 말아 주세요.",
  );
  assert.equal(personalInfoMessage({ 메모: "보완서류 재접수 확인", 요약: null }), null);
});
