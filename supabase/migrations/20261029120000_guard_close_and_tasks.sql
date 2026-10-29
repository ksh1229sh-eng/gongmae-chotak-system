-- 종결과 할 일 추가가 동시에 일어나도 "종결된 사건에 미완료 할 일이 남는" 일이 없게 DB가 직접 지킨다.
-- (앱 코드에서 "확인하고 나서 저장"하면 그 사이에 다른 요청이 끼어들 수 있다.)
-- 오류 코드: CL001 = 종결된 사건에 미완료 할 일, CL002 = 미완료 할 일이 남은 사건의 종결

-- 미완료 할 일을 넣거나 미완료로 되돌릴 때: 사건 줄을 잠그고(종결과 서로 기다리게 함) 종결 여부를 확인한다.
create function public.guard_open_task() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_closed timestamptz;
begin
  if new.done_at is null then
    select closed_at into v_closed from public.cases where id = new.case_id for share;
    if v_closed is not null then
      raise exception '종결된 사건에는 미완료 할 일을 둘 수 없습니다.' using errcode = 'CL001';
    end if;
  end if;
  return new;
end;
$$;

create trigger tasks_guard_open
  before insert or update on public.tasks
  for each row execute function public.guard_open_task();

-- 종결할 때: 사건 줄이 잠긴 상태에서 미완료 할 일이 있는지 확인한다.
create function public.guard_close() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.closed_at is null and new.closed_at is not null then
    if exists (select 1 from public.tasks where case_id = new.id and done_at is null) then
      raise exception '미완료 할 일이 남아 있어 종결할 수 없습니다.' using errcode = 'CL002';
    end if;
  end if;
  return new;
end;
$$;

create trigger cases_guard_close
  before update on public.cases
  for each row execute function public.guard_close();
