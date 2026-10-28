-- 사건 사후관리·인수인계(must 2) 저장 표. 설계: DESIGN.md 5장
-- 모든 표는 RLS를 켜고 공개 정책을 만들지 않는다 → 서버의 서버용 키로만 읽고 쓸 수 있다.

-- 사건: 개인정보 없이 관리번호와 물건 요약만 남긴다.
create table public.cases (
  id uuid primary key default gen_random_uuid(),
  case_no text not null unique check (char_length(case_no) between 1 and 50),
  property_summary text not null default '' check (char_length(property_summary) <= 200),
  stage text not null default 'received'
    check (stage in ('received', 'supplement', 'sent', 'registered')), -- 서류 접수 / 보완 요청 / 촉탁서 발송 / 등기 완료
  docs_received_on date,
  memo text not null default '' check (char_length(memo) <= 2000),
  closed_at timestamptz, -- 비어 있으면 진행 중
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 할 일: 사건이 지워지면 함께 지운다.
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  due_on date,
  done_at timestamptz,
  auto_kind text check (auto_kind in ('send_deadline')), -- 자동 생성 종류 (촉탁서 발송 기한)
  created_at timestamptz not null default now()
);

create index tasks_case_id_idx on public.tasks (case_id);
-- 알림 조회(미완료 할 일을 기한순으로)용
create index tasks_open_due_idx on public.tasks (due_on) where done_at is null;
-- 촉탁서 발송 기한 자동 할 일은 사건당 하나만
create unique index tasks_one_send_deadline_idx on public.tasks (case_id) where auto_kind = 'send_deadline';

-- 로그인 실패 기록: IP는 그대로 두지 않고 요약값(해시)만 저장한다.
create table public.login_attempts (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null,
  failed_at timestamptz not null default now()
);

create index login_attempts_ip_time_idx on public.login_attempts (ip_hash, failed_at);

-- 사건을 고칠 때마다 updated_at을 자동으로 갱신한다.
create function public.touch_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger cases_touch_updated_at
  before update on public.cases
  for each row execute function public.touch_updated_at();

alter table public.cases enable row level security;
alter table public.tasks enable row level security;
alter table public.login_attempts enable row level security;

-- 브라우저용 공개 키(anon)나 로그인 사용자 역할로는 아예 접근하지 못하게 한다.
revoke all on public.cases, public.tasks, public.login_attempts from anon, authenticated;
revoke execute on function public.touch_updated_at() from anon, authenticated, public;
