-- 로그인 잠금: 시도를 먼저 기록해 순번으로 판단하고, 한도를 넘으면 잠금 종료 시각(locked_until)을 따로 저장해
-- 잠금이 정확히 15분 이어지게 한다. 잠금 기록은 locked_until이 채워진 줄이다.
alter table public.login_attempts add column locked_until timestamptz;
