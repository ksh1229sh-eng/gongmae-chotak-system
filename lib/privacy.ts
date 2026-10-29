// 사건 기록에 개인정보가 들어가지 않게 막는 검사입니다. (PRD 7번, DESIGN.md 8장)
// 안내 문구에만 기대지 않고, 저장할 때와 AI로 보내기 전에 서버가 이 검사를 합니다.
// Node가 테스트에서 직접 실행하므로 다른 파일을 불러오지 않고 TypeScript 전용 문법도 쓰지 않습니다.

export type PersonalInfoKind = "주민등록번호" | "전화번호";

const PATTERNS: { kind: PersonalInfoKind; re: RegExp }[] = [
  // 800101-1234567, 8001011234567, 800101-1****** (뒷자리 가림 포함). 외국인등록번호도 같은 모양
  { kind: "주민등록번호", re: /(?<!\d)\d{6}\s*[-–]?\s*[1-8](?:\d{6}|\*{6})(?!\d)/ },
  // 휴대전화 010-1234-5678, 01012345678, 010 1234 5678
  { kind: "전화번호", re: /(?<!\d)01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}(?!\d)/ },
  // 지역번호 전화 02-123-4567, 031-123-4567, 070-1234-5678 (1588-5321 같은 대표번호는 해당 없음)
  { kind: "전화번호", re: /(?<!\d)0(?:2|[3-6][1-5]|70)[-.\s]?\d{3,4}[-.\s]?\d{4}(?!\d)/ },
];

// 발견한 개인정보 종류 목록 (없으면 빈 배열)
export function findPersonalInfo(text: string): PersonalInfoKind[] {
  const found = new Set<PersonalInfoKind>();
  for (const { kind, re } of PATTERNS) if (re.test(text)) found.add(kind);
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
