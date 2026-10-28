// 등기부 계산 정확도 점검: 폴더 안의 등기부 PDF를 /api/registry에 보내 결과를 정답과 비교합니다.
// 목표(PRD 3번): 테스트 등기부 5건의 말소 건수·금액이 손으로 계산한 값과 100% 일치.
// 사용법: 앱을 띄운 뒤 `npm run check:registry -- <폴더>`
//   폴더에는 이름.pdf 와 이름.expected.json 을 짝으로 둡니다. (가상 자료는 저장소에 커밋하지 않습니다)
//   expected.json 예: { "propertyType": "토지", "metro": true, "base": { "section": "을구", "rank": "2" },
//                       "cancelCount": 4, "assume": ["갑구2"] }
import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3100";
const CANCEL_TAX = 7200;
const FEE_PER_PROPERTY = 18000;
const FEE_PER_CANCEL = 4000;

const dir = process.argv[2];
if (!dir) {
  console.error("등기부 폴더를 지정해 주세요: npm run check:registry -- <폴더>");
  process.exit(2);
}

const cases = readdirSync(dir)
  .filter((f) => f.endsWith(".pdf"))
  .sort()
  .map((f) => {
    const name = basename(f, ".pdf");
    return { name, pdf: join(dir, f), expected: JSON.parse(readFileSync(join(dir, `${name}.expected.json`), "utf8")) };
  });

async function analyze(pdfs) {
  const form = new FormData();
  for (const p of pdfs) form.append("files", new Blob([readFileSync(p)], { type: "application/pdf" }), basename(p));
  const res = await fetch(`${BASE_URL}/api/registry`, { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${data.error}`);
  return data;
}

const key = (e) => `${e.section}${e.rank}`;

// 한 건의 결과를 정답과 비교해 틀린 항목 목록을 돌려줍니다.
function compare(reg, exp) {
  const wrong = [];
  const assume = reg.judged.filter((e) => e.judgement === "assume").map(key).sort();
  const actual = {
    propertyType: reg.propertyType,
    metro: reg.metro,
    base: reg.base ? `${reg.base.section}${reg.base.rank}` : null,
    cancelCount: reg.cancelCount,
    assume: assume.join(","),
  };
  const want = {
    propertyType: exp.propertyType,
    metro: exp.metro,
    base: exp.base ? `${exp.base.section}${exp.base.rank}` : null,
    cancelCount: exp.cancelCount,
    assume: [...exp.assume].sort().join(","),
  };
  for (const k of Object.keys(want)) {
    if (actual[k] !== want[k]) wrong.push(`${k}: 결과 ${JSON.stringify(actual[k])} / 정답 ${JSON.stringify(want[k])}`);
  }
  return wrong;
}

let passed = 0;
for (const c of cases) {
  try {
    const data = await analyze([c.pdf]);
    const reg = data.registries[0];
    const wrong = compare(reg, c.expected);
    const wantTax = c.expected.cancelCount * CANCEL_TAX;
    const wantFee = FEE_PER_PROPERTY + c.expected.cancelCount * FEE_PER_CANCEL;
    if (data.cancelTax !== wantTax) wrong.push(`등록면허세: 결과 ${data.cancelTax} / 정답 ${wantTax}`);
    if (data.filingFee !== wantFee) wrong.push(`수수료: 결과 ${data.filingFee} / 정답 ${wantFee}`);
    if (!wrong.length) passed++;
    console.log(`${wrong.length ? "❌" : "✅"} ${c.name}  말소 ${reg.cancelCount}건 · 등록면허세 ${data.cancelTax.toLocaleString()}원 · 수수료 ${data.filingFee.toLocaleString()}원`);
    for (const w of wrong) console.log(`     ${w}`);
    if (wrong.length) {
      for (const e of reg.judged) console.log(`       ${e.section} ${e.rank} ${e.purpose} ${e.receivedAt} ${e.receiptNo ?? "-"} ${e.cancelled ? "말소됨" : ""} → ${e.judgement}`);
    }
  } catch (error) {
    console.log(`❌ ${c.name}  오류 — ${error.message}`);
  }
}

// 여러 통을 한 번에 첨부했을 때 합계도 맞는지 확인합니다 (최대 5개).
let totalOk = true;
if (cases.length > 1 && cases.length <= 5) {
  try {
    const data = await analyze(cases.map((c) => c.pdf));
    const count = cases.reduce((s, c) => s + c.expected.cancelCount, 0);
    const wantTax = count * CANCEL_TAX;
    const wantFee = cases.length * FEE_PER_PROPERTY + count * FEE_PER_CANCEL;
    totalOk = data.cancelCount === count && data.cancelTax === wantTax && data.filingFee === wantFee;
    console.log(
      `${totalOk ? "✅" : "❌"} 한꺼번에 ${cases.length}통  말소 ${data.cancelCount}건(정답 ${count}) · 등록면허세 ${data.cancelTax.toLocaleString()}원(정답 ${wantTax.toLocaleString()}) · 수수료 ${data.filingFee.toLocaleString()}원(정답 ${wantFee.toLocaleString()})`,
    );
  } catch (error) {
    totalOk = false;
    console.log(`❌ 한꺼번에 ${cases.length}통  오류 — ${error.message}`);
  }
}

const rate = passed / cases.length;
console.log(`\n계산 정확도 ${Math.round(rate * 100)}% (${passed}/${cases.length}) 목표 100% ${rate === 1 && totalOk ? "✅" : "❌"}`);
process.exit(rate === 1 && totalOk ? 0 : 1);
