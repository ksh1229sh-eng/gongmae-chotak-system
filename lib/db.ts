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

// 사건 종결. 아직 진행 중일 때만 종결하고, 이미 종결됐으면 null을 돌려줍니다 (두 번 눌러도 종결 시각이 바뀌지 않게).
export async function closeCase(id: string): Promise<CaseRow | null> {
  const rows = await rest<CaseRow[]>(`cases?id=eq.${encodeURIComponent(id)}&closed_at=is.null`, {
    method: "PATCH",
    body: { closed_at: new Date().toISOString() },
  });
  return rows[0] ?? null;
}

// ── 할 일 ──

export async function createTask(caseId: string, input: TaskInput): Promise<TaskRow> {
  const rows = await rest<TaskRow[]>("tasks", { method: "POST", body: { ...input, case_id: caseId } });
  return rows[0];
}

// 할 일 하나와 소속 사건의 종결 여부 (종결된 사건의 할 일은 바꾸지 못하게 할 때 씁니다)
export async function getTask(id: string): Promise<(TaskRow & { cases: Pick<CaseRow, "id" | "closed_at"> }) | null> {
  const rows = await rest<(TaskRow & { cases: Pick<CaseRow, "id" | "closed_at"> })[]>(
    `tasks?select=*,cases!inner(id,closed_at)&id=eq.${encodeURIComponent(id)}`,
  );
  return rows[0] ?? null;
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

// ── 로그인 시도 기록 ──
// 비밀번호를 확인하기 전에 시도를 먼저 기록하고 순번으로 판단합니다. 동시에 수십 개를 보내도 순번이 달라서
// 앞의 한도만큼만 비밀번호 확인에 닿습니다. (횟수를 세고 나중에 기록하면 모두 0회로 보고 통과하던 문제)

export async function isLoginLocked(ipHash: string, nowIso: string): Promise<boolean> {
  const rows = await rest<{ id: string }[]>(
    `login_attempts?select=id&ip_hash=eq.${encodeURIComponent(ipHash)}&locked_until=gt.${encodeURIComponent(nowIso)}&limit=1`,
  );
  return rows.length > 0;
}

// 시도를 기록하고, 창 안에서 몇 번째 시도인지 돌려줍니다. (시각이 같으면 id 순)
export async function recordLoginAttempt(ipHash: string, sinceIso: string): Promise<number> {
  const [mine] = await rest<{ id: string; failed_at: string }[]>("login_attempts", {
    method: "POST",
    body: { ip_hash: ipHash },
  });
  const at = encodeURIComponent(mine.failed_at);
  const rows = await rest<{ id: string }[]>(
    `login_attempts?select=id&ip_hash=eq.${encodeURIComponent(ipHash)}&locked_until=is.null&failed_at=gte.${encodeURIComponent(sinceIso)}` +
      `&or=(failed_at.lt.${at},and(failed_at.eq.${at},id.lte.${mine.id}))`,
  );
  return rows.length;
}

export async function lockLogin(ipHash: string, untilIso: string): Promise<void> {
  await rest("login_attempts", { method: "POST", body: { ip_hash: ipHash, locked_until: untilIso } });
}

// 로그인에 성공하면 그 접속지의 시도 기록을 지웁니다.
export async function clearLoginAttempts(ipHash: string): Promise<void> {
  await rest(`login_attempts?ip_hash=eq.${encodeURIComponent(ipHash)}`, { method: "DELETE" });
}

// ── 공개 API 사용 기록 (남용 방지용 횟수 제한) ──

export type UsageKind = "chat" | "registry";

// 먼저 기록한 뒤, 창 안에서 자기보다 앞선 기록 수를 세어 "몇 번째 사용인지"를 돌려줍니다.
// 동시에 여러 요청이 와도 각자 순번이 달라서, 앞의 한도만큼만 통과합니다. (시각이 같으면 id 순)
export async function recordUsageAndCount(ipHash: string, kind: UsageKind, sinceIso: string): Promise<number> {
  const [mine] = await rest<{ id: string; used_at: string }[]>("api_usage", {
    method: "POST",
    body: { ip_hash: ipHash, kind },
  });
  const at = encodeURIComponent(mine.used_at);
  const rows = await rest<{ id: string }[]>(
    `api_usage?select=id&ip_hash=eq.${encodeURIComponent(ipHash)}&kind=eq.${kind}&used_at=gte.${encodeURIComponent(sinceIso)}` +
      `&or=(used_at.lt.${at},and(used_at.eq.${at},id.lte.${mine.id}))`,
  );
  return rows.length;
}

// 오래된 기록은 표가 커지지 않게 지웁니다.
export async function deleteOldUsage(beforeIso: string): Promise<void> {
  await rest(`api_usage?used_at=lt.${encodeURIComponent(beforeIso)}`, { method: "DELETE" });
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
