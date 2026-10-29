-- 로그인 없이 열려 있는 챗봇·등기부 API의 남용을 막기 위한 사용 기록.
-- IP는 그대로 두지 않고 요약값(해시)만 저장하고, 서버 키로만 접근한다(RLS).
create table public.api_usage (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null,
  kind text not null check (kind in ('chat', 'registry')),
  used_at timestamptz not null default now()
);

create index api_usage_ip_kind_time_idx on public.api_usage (ip_hash, kind, used_at);

alter table public.api_usage enable row level security;
revoke all on public.api_usage from anon, authenticated;
