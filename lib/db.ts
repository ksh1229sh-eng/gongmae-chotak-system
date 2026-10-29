// 서버에서만 쓰는 Supabase 접속 도우미입니다. (설계: DESIGN.md 5·8장)
// 서버용 키(SUPABASE_SERVICE_ROLE_KEY)는 .env에서 읽고 브라우저로는 절대 보내지 않습니다.
// 추가 부품 없이 Supabase가 제공하는 REST 주소(/rest/v1)에 fetch로 직접 요청합니다.
import "server-only";

export type Stage = "received" | "supplement" | "sent" | "registered";

export type TaskRow = {
  id: string;
  case_id: string;
  title: string;
  due_on: string | null; // YYYY-MM-DD
  done_at: string | null;
  auto_kind: "send_deadline" | null;
  created_at: string;
};

export type CaseRow = {
  id: string;
  case_no: string;
  property_summary: string;
  stage: Stage;
  docs_received_on: string | null; // YYYY-MM-DD
  memo: string;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CaseWithTasks = CaseRow & { tasks: TaskRow[] };

// 알림 목록용: 할 일에 소속 사건 정보를 붙인 형태
export type OpenTaskRow = TaskRow & {
  cases: Pick<CaseRow, "id" | "case_no" | "property_summary" | "stage">;
};

export type CaseInput = Partial<Pick<CaseRow, "case_no" | "property_summary" | "stage" | "docs_received_on" | "memo">>;
export type TaskInput = Pick<TaskRow, "title"> & Partial<Pick<TaskRow, "due_on" | "auto_kind">>;

export class MissingDbConfigError extends Error {}
// 관리번호 중복, 자동 할 일 중복 등 이미 있는 값과 부딪힐 때
export class DbConflictError extends Error {}
// 글자 수·진행 단계 같은 표의 제약 조건에 맞지 않을 때
export class DbInvalidError extends Error {}

function config() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new MissingDbConfigError("SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 .env에 없습니다.");
  return { url, key };
}

async function rest<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const { url, key } = config();
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method: init.method ?? "GET",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store", // 사건 정보는 항상 최신 값을 읽어야 합니다.
  });
  const text = await res.text();
  if (!res.ok) {
    // 오류 원문은 서버 기록에만 남기고, 화면에는 종류만 알립니다.
    console.error("Supabase 오류", res.status, text);
    const code = (() => {
      try {
        return JSON.parse(text).code as string;
      } catch {
        return "";
      }
    })();
    if (code === "23505") throw new DbConflictError("이미 있는 값입니다.");
    if (code === "23514" || code === "22P02" || code === "23502") throw new DbInvalidError("입력 형식이 맞지 않습니다.");
    throw new Error(`Supabase 요청 실패 (${res.status})`);
  }
  return (text ? JSON.parse(text) : null) as T;
}

const CASE_WITH_TASKS = "select=*,tasks(*)";

// ── 사건 ──

export async function listCases(status: "open" | "closed"): Promise<CaseWithTasks[]> {
  const filter = status === "open" ? "closed_at=is.null" : "closed_at=not.is.null";
  return rest(`cases?${CASE_WITH_TASKS}&${filter}&order=created_at.desc`);
}

export async function getCase(id: string): Promise<CaseWithTasks | null> {
  const rows = await rest<CaseWithTasks[]>(`cases?${CASE_WITH_TASKS}&id=eq.${encodeURIComponent(id)}`);
  return rows[0] ?? null;
}

export async function createCase(input: CaseInput & Pick<CaseRow, "case_no">): Promise<CaseRow> {
  const rows = await rest<CaseRow[]>("cases", { method: "POST", body: input });
  return rows[0];
}

export async function updateCase(id: string, patch: CaseInput & Partial<Pick<CaseRow, "closed_at">>): Promise<CaseRow | null> {
  const rows = await rest<CaseRow[]>(`cases?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: patch });
  return rows[0] ?? null;
}

// ── 할 일 ──

export async function createTask(caseId: string, input: TaskInput): Promise<TaskRow> {
  const rows = await rest<TaskRow[]>("tasks", { method: "POST", body: { ...input, case_id: caseId } });
  return rows[0];
}

export async function updateTask(id: string, patch: Partial<Pick<TaskRow, "title" | "due_on" | "done_at">>): Promise<TaskRow | null> {
  const rows = await rest<TaskRow[]>(`tasks?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: patch });
  return rows[0] ?? null;
}

// 진행 중 사건의 미완료 할 일 전부 (알림·인수인계 화면용). 정렬은 lib/cases.ts가 합니다.
export async function listOpenTasks(): Promise<OpenTaskRow[]> {
  return rest(
    "tasks?select=*,cases!inner(id,case_no,property_summary,stage)&done_at=is.null&cases.closed_at=is.null",
  );
}

// ── 로그인 실패 기록 ──

export async function countLoginFailures(ipHash: string, sinceIso: string): Promise<number> {
  const rows = await rest<{ id: string }[]>(
    `login_attempts?select=id&ip_hash=eq.${encodeURIComponent(ipHash)}&failed_at=gte.${encodeURIComponent(sinceIso)}`,
  );
  return rows.length;
}

export async function recordLoginFailure(ipHash: string): Promise<void> {
  await rest("login_attempts", { method: "POST", body: { ip_hash: ipHash } });
}

// API에서 쓰는 공통 오류 응답 (lib/openai.ts의 errorResponse와 같은 형식)
export function dbErrorResponse(error: unknown) {
  if (error instanceof MissingDbConfigError) {
    return Response.json({ error: "서버에 Supabase 설정이 없습니다. .env를 확인해 주세요." }, { status: 500 });
  }
  if (error instanceof DbConflictError) {
    return Response.json({ error: "이미 등록된 값입니다. (예: 같은 관리번호)" }, { status: 409 });
  }
  if (error instanceof DbInvalidError) {
    return Response.json({ error: "입력 형식이 맞지 않습니다. 글자 수와 날짜를 확인해 주세요." }, { status: 400 });
  }
  return Response.json({ error: "저장소와 통신 중 문제가 생겼습니다. 잠시 후 다시 시도해 주세요." }, { status: 502 });
}
