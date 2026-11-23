-- migration-004-metric-averages.sql
-- 결과 화면에서 "내 값 vs 전체 평균"을 보여주려고, 지표별 평균을 돌려주는 함수를 만든다.
-- migration-002-stats.sql과 같은 방식: 개별 기록은 감추고 집계값만 돌려준다(security definer).
-- schema → 001 → 002 → 003 다음에 실행한다. 두 번 실행해도 되게 create or replace를 쓴다.

create or replace function metric_averages()
returns table (
  sample_count          bigint,
  compute_ms            numeric,
  memory_ms             numeric,
  peak_throughput       numeric,
  sustained_throughput  numeric,
  retention             numeric,
  cv                    numeric,
  parallel_speedup      numeric,
  parallel_efficiency   numeric
)
language sql
security definer
set search_path = public
as $$
  select
    count(*)                        as sample_count,
    round(avg(compute_ms), 0)       as compute_ms,
    round(avg(memory_ms), 0)        as memory_ms,
    round(avg(peak_throughput), 1)  as peak_throughput,
    round(avg(sustained_throughput), 1) as sustained_throughput,
    round(avg(retention), 3)        as retention,
    round(avg(cv), 3)               as cv,
    round(avg(parallel_speedup), 2) as parallel_speedup,
    round(avg(parallel_efficiency), 3) as parallel_efficiency
  -- 중간에 그만둔 측정은 정확도가 낮아 평균에서 제외한다
  from measurements
  where coalesce(interrupted, false) = false;
$$;
