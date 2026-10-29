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

test("우회 시도: 전각 숫자·전각 하이픈·공백이나 점으로 나눈 번호도 찾음", () => {
  for (const s of ["８００１０１－１２３４５６７", "800101.1234567", "800101 / 1234567", "800101 –  1234567"]) {
    assert.deepEqual(findPersonalInfo(s), ["주민등록번호"], s);
  }
  for (const s of ["010 - 1234 - 5678", "０１０－１２３４－５６７８", "010.1234.5678", "010_1234_5678", "02 - 123 - 4567"]) {
    assert.deepEqual(findPersonalInfo(s), ["전화번호"], s);
  }
});

test("우회 시도: +82 국가번호 형태와 보이지 않는 글자를 끼운 번호", () => {
  for (const s of ["+82 10-1234-5678", "82-10-1234-5678", "+82 (0)10 1234 5678", "+82 010-1234-5678", "0​10-1234-5678", "8001​01-1234567"]) {
    assert.equal(findPersonalInfo(s).length, 1, s);
  }
});

test("우회 시도: 한글로 풀어 쓴 긴 숫자", () => {
  assert.deepEqual(findPersonalInfo("공일공 일이삼사 오육칠팔"), ["전화번호"]);
  assert.deepEqual(findPersonalInfo("공일공일이삼사오육칠팔"), ["전화번호"]);
});

test("넓힌 검사에도 업무 문장은 통과: 이사·일정·날짜 나열·금액·82 들어간 번호", () => {
  for (const s of [
    "이사 일정 공유, 구일 오일 팔일 예정",
    "2026-10-29 / 2026-11-05 두 번 접수",
    "채권 매입액 2,000,000원 82,000원 납부",
    "서류 18,000원 + 4,000원 = 22,000원",
    "농지 82번지 1234-5678",
    "등기 제82010호",
  ]) {
    assert.deepEqual(findPersonalInfo(s), [], s);
  }
});
