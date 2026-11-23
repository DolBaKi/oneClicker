-- migration-005-recent.sql
-- "측정 기록" 페이지에서 쌓인 측정값을 보여주려고, 안전한 컬럼만 돌려주는 함수를 만든다.
-- 개별 행 직접 읽기(select)는 일부러 막아 두었다(남의 기록을 통째로 보지 못하게).
-- 이 함수는 이름·위치 같은 개인정보가 없는 컬럼만, 개수를 제한해 돌려준다(security definer).
-- schema → 001 → 002 → 003 → 004 다음에 실행한다. create or replace라 두 번 실행해도 된다.

create or replace function recent_measurements(lim integer default 50)
returns table (
  created_at      timestamptz,
  model           text,
  cores           int,
  purchase_year   int,
  purchase_month  int,
  usage_type      text,
  total_score     int,
  retention       numeric,
  peak_throughput numeric,
  sustained_throughput numeric
)
language sql
security definer
set search_path = public
as $$
  select
    created_at, model, cores, purchase_year, purchase_month,
    usage_type, total_score, retention, peak_throughput, sustained_throughput
  from measurements
  where coalesce(interrupted, false) = false
    and model is not null
    and model <> '__TEST_DELETE__'          -- 테스트로 넣은 행은 빼고 보여 준다
  order by created_at desc
  limit greatest(1, least(lim, 200));        -- 한 번에 최대 200건
$$;
