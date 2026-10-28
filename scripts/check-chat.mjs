// 챗봇 품질 점검: tests/chat-questions.json의 질문을 /api/chat에 보내 정답률·근거 표시율·응답 시간을 잽니다.
// 목표(PRD 3·5번): 정답률 90% 이상, 근거 있는 답변의 쪽 번호 표시 100%, 응답 10초 이내,
// 답변 500자 이내 100%, 근거 없음 답변의 공사 문의처 안내 100%.
// 사용법: 앱을 띄운 뒤 `npm run check:chat` (주소를 바꾸려면 BASE_URL=http://localhost:3000)
import { readFileSync } from "node:fs";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3100";
const TARGET = { accuracy: 0.9, citation: 1, seconds: 10, maxChars: 500, length: 1, contact: 1 };
// 근거가 없다고 답할 때 공사 문의처를 함께 안내했는지 확인하는 표현
const CONTACT = ["1588-5321", "한국자산관리공사"];

const { questions } = JSON.parse(readFileSync(new URL("../tests/chat-questions.json", import.meta.url), "utf8"));

// 띄어쓰기 차이로 오답 처리되지 않도록 공백을 지우고 비교합니다.
const norm = (s) => s.replace(/\s/g, "");

// "(안내문 p.2, p.3)" "(안내문 p.2~3)" 같은 표기에서 쪽 번호를 모두 뽑습니다.
function citedPages(answer) {
  const pages = new Set();
  for (const [group] of answer.matchAll(/\(안내문[^)]*\)/g)) {
    for (const [, from, to] of group.matchAll(/p\.\s*(\d+)(?:\s*[~-]\s*(\d+))?/g)) {
      for (let p = Number(from); p <= Number(to ?? from); p++) pages.add(p);
    }
  }
  return [...pages];
}

async function ask(question) {
  const started = performance.now();
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  const answer = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${answer.slice(0, 200)}`);
  return { answer, seconds: (performance.now() - started) / 1000 };
}

function grade(q, answer) {
  const text = norm(answer);
  const missing = q.mustInclude.filter((group) => !group.some((w) => text.includes(norm(w))));
  const forbidden = q.mustNotInclude.filter((w) => text.includes(norm(w)));
  const pages = citedPages(answer);
  const cited = q.type !== "answer" || pages.some((p) => q.pages.includes(p));
  const short = answer.trim().length <= TARGET.maxChars;
  const contact = q.type !== "no_info" || CONTACT.some((w) => text.includes(norm(w)));
  return { correct: !missing.length && !forbidden.length, cited, short, contact, missing, forbidden, pages };
}

const results = [];
for (const q of questions) {
  try {
    const { answer, seconds } = await ask(q.question);
    const g = grade(q, answer);
    results.push({ q, answer, seconds, ...g });
    const mark = g.correct ? "✅" : "❌";
    const cite = q.type === "answer" ? (g.cited ? "근거✅" : "근거❌") : "근거-";
    const len = g.short ? "" : ` 길이❌(${answer.trim().length}자)`;
    const call = g.contact ? "" : " 문의처❌";
    console.log(`${mark} ${cite} ${seconds.toFixed(1)}초${len}${call}  ${q.id}. ${q.question}`);
    if (!g.correct || !g.cited || !g.short || !g.contact) {
      if (g.missing.length) console.log(`     빠진 내용: ${JSON.stringify(g.missing)}`);
      if (g.forbidden.length) console.log(`     들어가면 안 되는 내용: ${JSON.stringify(g.forbidden)}`);
      if (!g.cited) console.log(`     표시한 쪽: ${JSON.stringify(g.pages)} / 기대한 쪽: ${JSON.stringify(q.pages)}`);
      console.log(`     답변: ${answer.replace(/\s+/g, " ").slice(0, 300)}`);
    }
  } catch (error) {
    results.push({ q, answer: "", seconds: Infinity, correct: false, cited: false, short: false, contact: false });
    console.log(`❌ 오류 ${q.id}. ${q.question} — ${error.message}`);
  }
}

const answerType = results.filter((r) => r.q.type === "answer");
const accuracy = results.filter((r) => r.correct).length / results.length;
const citation = answerType.filter((r) => r.cited).length / answerType.length;
const slowest = Math.max(...results.map((r) => r.seconds));
const noInfo = results.filter((r) => r.q.type === "no_info");
const length = results.filter((r) => r.short).length / results.length;
const contact = noInfo.filter((r) => r.contact).length / noInfo.length;
const pct = (x) => `${Math.round(x * 100)}%`;

console.log("\n─── 결과 ───");
console.log(`정답률      ${pct(accuracy)} (${results.filter((r) => r.correct).length}/${results.length}) 목표 ${pct(TARGET.accuracy)} ${accuracy >= TARGET.accuracy ? "✅" : "❌"}`);
console.log(`근거 표시율 ${pct(citation)} (${answerType.filter((r) => r.cited).length}/${answerType.length}) 목표 ${pct(TARGET.citation)} ${citation >= TARGET.citation ? "✅" : "❌"}`);
console.log(`최장 응답   ${slowest.toFixed(1)}초 목표 ${TARGET.seconds}초 이내 ${slowest <= TARGET.seconds ? "✅" : "❌"}`);
console.log(`500자 이내  ${pct(length)} (${results.filter((r) => r.short).length}/${results.length}) 목표 ${pct(TARGET.length)} ${length >= TARGET.length ? "✅" : "❌"}`);
console.log(`문의처 안내 ${pct(contact)} (${noInfo.filter((r) => r.contact).length}/${noInfo.length}, 근거 없음 질문) 목표 ${pct(TARGET.contact)} ${contact >= TARGET.contact ? "✅" : "❌"}`);

const passed =
  accuracy >= TARGET.accuracy &&
  citation >= TARGET.citation &&
  slowest <= TARGET.seconds &&
  length >= TARGET.length &&
  contact >= TARGET.contact;
process.exit(passed ? 0 : 1);
