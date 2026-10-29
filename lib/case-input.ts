// 담당자 API로 들어온 사건 입력값을 검사하고 정리합니다.
// 글자 수·날짜 형식·개인정보 형태를 확인해, 문제가 있으면 화면에 보여 줄 안내 한 줄을 돌려줍니다.
import { STAGES, isDate, isStage } from "@/lib/cases";
import type { CaseInput } from "@/lib/db";
import { personalInfoMessage } from "@/lib/privacy";

export const LIMITS = { case_no: 50, property_summary: 200, memo: 2000 };

type Result = { ok: true; data: CaseInput } | { ok: false; error: string };

const LABELS = { case_no: "관리번호", property_summary: "물건 요약", memo: "메모" } as const;

// mode가 "create"이면 관리번호가 꼭 있어야 하고, "update"이면 보낸 칸만 고칩니다.
export function parseCaseInput(body: unknown, mode: "create" | "update"): Result {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, error: "잘못된 요청입니다." };
  const raw = body as Record<string, unknown>;
  const data: CaseInput = {};

  for (const key of ["case_no", "property_summary", "memo"] as const) {
    if (!(key in raw)) continue;
    const value = raw[key];
    if (typeof value !== "string") return { ok: false, error: `${LABELS[key]}는 글자로 입력해 주세요.` };
    const text = key === "memo" ? value.trim() : value.trim().replace(/\s+/g, " ");
    if (text.length > LIMITS[key]) return { ok: false, error: `${LABELS[key]}는 ${LIMITS[key]}자 이내로 입력해 주세요.` };
    data[key] = text;
  }

  if ("docs_received_on" in raw) {
    const value = raw.docs_received_on;
    if (value === null || value === "") data.docs_received_on = null;
    else if (isDate(value)) data.docs_received_on = value;
    else return { ok: false, error: "서류 접수일은 2026-10-29 같은 형식의 날짜로 입력해 주세요." };
  }

  // 진행 단계는 수정할 때만 바꿀 수 있습니다. 새 사건은 항상 "서류 접수"에서 시작합니다.
  if (mode === "update" && "stage" in raw) {
    if (!isStage(raw.stage)) {
      return { ok: false, error: `진행 단계는 ${STAGES.map((s) => s.label).join("·")} 중 하나여야 합니다.` };
    }
    data.stage = raw.stage;
  }

  if (mode === "create" && !data.case_no) return { ok: false, error: "관리번호를 입력해 주세요." };
  if (mode === "update" && "case_no" in data && !data.case_no) return { ok: false, error: "관리번호는 비워 둘 수 없습니다." };
  if (mode === "update" && !Object.keys(data).length) return { ok: false, error: "고칠 내용이 없습니다." };

  const privacy = personalInfoMessage({
    [LABELS.case_no]: data.case_no,
    [LABELS.property_summary]: data.property_summary,
    [LABELS.memo]: data.memo,
  });
  if (privacy) return { ok: false, error: privacy };

  return { ok: true, data };
}

// 주소의 사건 id가 올바른 모양인지 (잘못된 값으로 저장소에 요청하지 않도록)
export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
