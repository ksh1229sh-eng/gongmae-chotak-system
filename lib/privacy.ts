// 사건 기록에 개인정보가 들어가지 않게 막는 검사입니다. (PRD 7번, DESIGN.md 8장)
// 안내 문구에만 기대지 않고, 저장할 때와 AI로 보내기 전에 서버가 이 검사를 합니다.
// Node가 테스트에서 직접 실행하므로 다른 파일을 불러오지 않고 TypeScript 전용 문법도 쓰지 않습니다.

export type PersonalInfoKind = "주민등록번호" | "전화번호";

// 숫자 덩어리 사이에 올 수 있는 구분 문자: 공백, 여러 종류의 하이픈·줄표, 점, 가운뎃점, 밑줄, 슬래시 (최대 5글자)
const SEP = "[\\s\\-\\u2010-\\u2015\\u2212.·_/]{0,5}";

const PATTERNS: { kind: PersonalInfoKind; re: RegExp }[] = [
  // 800101-1234567, 8001011234567, 800101 . 1234567, 800101-1****** (뒷자리 가림 포함). 외국인등록번호도 같은 모양
  { kind: "주민등록번호", re: new RegExp(`(?<!\\d)\\d{6}${SEP}[1-8](?:\\d{6}|\\*{6})(?!\\d)`) },
  // 휴대전화 010-1234-5678, 01012345678, 010 1234 5678, 010 - 1234 - 5678
  { kind: "전화번호", re: new RegExp(`(?<!\\d)01[016789]${SEP}\\d{3,4}${SEP}\\d{4}(?!\\d)`) },
  // 국가번호 형태 +82 10-1234-5678, 82-10-1234-5678, +82 (0)10 1234 5678
  { kind: "전화번호", re: new RegExp(`(?<!\\d)\\+?82${SEP}(?:\\(0\\)${SEP})?0?1[016789]${SEP}\\d{3,4}${SEP}\\d{4}(?!\\d)`) },
  // 지역번호 전화 02-123-4567, 031-123-4567, 070-1234-5678 (1588-5321 같은 대표번호는 해당 없음)
  { kind: "전화번호", re: new RegExp(`(?<!\\d)0(?:2|[3-6][1-5]|70)${SEP}\\d{3,4}${SEP}\\d{4}(?!\\d)`) },
];

// 검사 전에 글자를 같은 모양으로 맞춥니다. 전각 숫자(８００１０１)·전각 기호를 반각으로 바꾸고(NFKC),
// 보이지 않는 글자(너비 0 공백 등)를 지우고, 한글로 풀어 쓴 긴 숫자(공일공일이삼…)를 숫자로 바꿉니다.
const HANGUL_DIGITS: Record<string, string> = { 영: "0", 공: "0", 일: "1", 이: "2", 삼: "3", 사: "4", 오: "5", 육: "6", 칠: "7", 팔: "8", 구: "9" };

function normalize(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[\u200b-\u200d\u2060\ufeff\u00ad]/g, "")
    // "이사", "일이삼" 같은 보통 낱말을 건드리지 않도록, 숫자 글자가 9개 넘게 이어질 때만 바꿉니다.
    .replace(new RegExp(`[영공일이삼사오육칠팔구](?:[\\s\\-.]?[영공일이삼사오육칠팔구]){8,}`, "g"), (m) =>
      m.replace(/[영공일이삼사오육칠팔구]/g, (c) => HANGUL_DIGITS[c]),
    );
}

// 발견한 개인정보 종류 목록 (없으면 빈 배열)
export function findPersonalInfo(text: string): PersonalInfoKind[] {
  const clean = normalize(text);
  const found = new Set<PersonalInfoKind>();
  for (const { kind, re } of PATTERNS) if (re.test(clean)) found.add(kind);
  return [...found];
}

// 여러 칸 중 개인정보가 든 칸을 찾아 화면에 보여 줄 안내 문장을 만듭니다. 없으면 null
export function personalInfoMessage(fields: Record<string, string | null | undefined>): string | null {
  for (const [label, value] of Object.entries(fields)) {
    if (!value) continue;
    const kinds = findPersonalInfo(value);
    if (kinds.length) return `${label}에 ${kinds.join("·")}로 보이는 내용이 있습니다. 개인정보는 적지 말아 주세요.`;
  }
  return null;
}
