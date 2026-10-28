// 말소 대상 판단과 비용 계산을 하는 순수 함수 모음입니다.
// AI는 등기부에서 권리 목록만 읽어 오고, 판단·계산은 모두 이 파일이 합니다.
// 금액 기준: docs/guide.pdf 3~4쪽 (말소 건당 7,200원, 수수료 18,000원/4,000원, 국민주택채권 비율표)

export type Entry = {
  section: "갑구" | "을구";
  rank: string; // 순위번호 (예: "3", "3-1")
  purpose: string; // 등기목적 (예: "근저당권설정", "압류")
  receivedAt: string; // 접수일 YYYY-MM-DD
  receiptNo: number | null; // 접수번호 (같은 날 순서 비교용)
  cancelled: boolean; // 이미 말소된 등기인지
  supplementary: boolean; // 부기등기인지
};

export type Judgement = "cancel" | "assume" | "ignore" | "unknown";

export type JudgedEntry = Entry & { judgement: Judgement; reason: string };

export const CANCEL_TAX_PER_ITEM = 7200; // 등록면허세 6,000원 + 지방교육세 1,200원
export const FILING_FEE_PER_PROPERTY = 18000;
export const FILING_FEE_PER_CANCEL = 4000;

// 매각으로 언제나 소멸하는 권리 (말소기준권리가 될 수 있는 권리)
const ALWAYS_EXTINGUISHED = [/저당권/, /가압류/, /압류/, /담보가등기/, /경매개시결정/];
// 말소기준권리보다 뒤면 소멸, 앞이면 매수자가 인수할 수 있는 권리
const DEPENDS_ON_ORDER = [/지상권/, /지역권/, /전세권/, /임차권/, /가처분/, /가등기/, /환매/];

function compact(purpose: string) {
  return purpose.replace(/\s/g, "");
}

function isOwnershipRecord(p: string) {
  return /소유권/.test(p) && /(보존|이전)/.test(p) && !/(가등기|청구권|가처분)/.test(p);
}

// 접수일 → 접수번호 순으로 먼저 접수된 쪽이 음수
function compareOrder(a: Entry, b: Entry) {
  if (a.receivedAt !== b.receivedAt) return a.receivedAt < b.receivedAt ? -1 : 1;
  return (a.receiptNo ?? Number.MAX_SAFE_INTEGER) - (b.receiptNo ?? Number.MAX_SAFE_INTEGER);
}

// "3번근저당권설정등기말소" 같은 말소 기록이 있으면, AI가 놓쳤더라도 그 대상 등기를 말소된 것으로 고칩니다.
export function applyCancellationRecords(entries: Entry[]): Entry[] {
  const targets = new Set<string>();
  for (const e of entries) {
    const m = compact(e.purpose).match(/^(\d+(?:-\d+)?)번.*말소$/);
    if (m) targets.add(`${e.section}:${m[1]}`);
  }
  return entries.map((e) => (targets.has(`${e.section}:${e.rank}`) ? { ...e, cancelled: true } : e));
}

export function judgeEntries(entries: Entry[]): { base: Entry | null; judged: JudgedEntry[] } {
  const alive = entries.filter((e) => !e.cancelled && !e.supplementary);
  const extinguished = alive.filter((e) => {
    const p = compact(e.purpose);
    return !isOwnershipRecord(p) && !/공매공고/.test(p) && ALWAYS_EXTINGUISHED.some((r) => r.test(p));
  });
  const base = [...extinguished].sort(compareOrder)[0] ?? null;

  const judged = entries.map((e): JudgedEntry => {
    const p = compact(e.purpose);
    if (/말소$/.test(p)) return { ...e, judgement: "ignore", reason: "말소 기록" };
    if (e.cancelled) return { ...e, judgement: "ignore", reason: "이미 말소된 등기" };
    if (e.supplementary) return { ...e, judgement: "ignore", reason: "부기등기 (등기소가 직권 말소)" };
    if (/공매공고/.test(p)) return { ...e, judgement: "ignore", reason: "공매공고 등기 (공사가 말소 촉탁)" };
    if (isOwnershipRecord(p)) return { ...e, judgement: "ignore", reason: "소유권 등기" };
    if (/표시변경|경정/.test(p)) return { ...e, judgement: "ignore", reason: "변경·경정 등기" };
    if (extinguished.includes(e)) {
      return { ...e, judgement: "cancel", reason: e === base ? "말소기준권리" : "매각으로 소멸하는 권리" };
    }
    if (DEPENDS_ON_ORDER.some((r) => r.test(p))) {
      if (!base) return { ...e, judgement: "unknown", reason: "말소기준권리를 찾지 못해 판단 불가" };
      return compareOrder(e, base) > 0
        ? { ...e, judgement: "cancel", reason: "말소기준권리보다 뒤에 접수" }
        : { ...e, judgement: "assume", reason: "말소기준권리보다 먼저 접수 — 매수자가 인수할 수 있음" };
    }
    return { ...e, judgement: "unknown", reason: "자동 판단 대상이 아닌 등기" };
  });

  return { base, judged };
}

export function cancelTax(cancelCount: number) {
  return cancelCount * CANCEL_TAX_PER_ITEM;
}

export function filingFee(propertyCount: number, cancelCount: number) {
  return propertyCount * FILING_FEE_PER_PROPERTY + cancelCount * FILING_FEE_PER_CANCEL;
}

export type BondKind = "land" | "house" | "other";

// [이상 금액, 특별시·광역시 ‰, 그 밖의 지역 ‰] — 각 구간은 다음 구간 금액 미만까지
const BOND_TABLE: Record<BondKind, [number, number, number][]> = {
  land: [
    [5_000_000, 25, 20],
    [50_000_000, 40, 35],
    [100_000_000, 50, 45],
  ],
  house: [
    [20_000_000, 13, 13],
    [50_000_000, 19, 14],
    [100_000_000, 21, 16],
    [160_000_000, 23, 18],
    [260_000_000, 26, 21],
    [600_000_000, 31, 26],
  ],
  other: [
    [10_000_000, 10, 8],
    [130_000_000, 16, 14],
    [250_000_000, 20, 18],
  ],
};

export function bondRate(kind: BondKind, metro: boolean, value: number): number {
  let rate = 0;
  for (const [from, metroRate, otherRate] of BOND_TABLE[kind]) {
    if (value >= from) rate = metro ? metroRate : otherRate;
  }
  return rate; // 천분율(‰). 0이면 매입 대상 아님
}

// 시가표준액 × 요율, 1만원 미만 반올림(사사오입). 정수로만 계산해 소수 오차를 없앱니다.
export function bondAmount(kind: BondKind, metro: boolean, value: number): number {
  const rate = bondRate(kind, metro, value);
  if (!rate) return 0;
  const raw = Math.round(value) * rate; // 단위: 1/1000원
  const unit = 10_000 * 1000;
  const q = Math.floor(raw / unit);
  return ((raw % unit) * 2 >= unit ? q + 1 : q) * 10_000;
}

// 특별시·광역시 여부. 확실한 경우만 true/false, 애매하면 null (사용자가 직접 선택)
export function isMetroRegion(sido: string): boolean | null {
  const s = sido.replace(/\s/g, "");
  if (s.startsWith("서울특별시") || /^(부산|대구|인천|광주|대전|울산)광역시/.test(s)) return true;
  if (/특별시/.test(s) && !/특별자치/.test(s)) return null;
  if (s.startsWith("세종")) return null;
  return s ? false : null;
}
