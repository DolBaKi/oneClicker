-- migration-006-metric-percentiles.sql
-- 결과 화면에서 지표마다 "상위 몇 %"를 실제 분포로 보여주려고, 값들을 받아 각 지표의 백분위를 돌려준다.
-- 안정성(유지율)만으로는 "빠른데 발열로 꺾이는 기기"가 낮게 나와 오해를 준다. 속도 지표의
-- 분포상 위치를 함께 보여주면 "속도는 빠르지만 유지가 약하다"를 읽을 수 있다.
-- schema → 001 → ... → 005 다음에 실행한다. create or replace라 두 번 실행해도 된다.
--
-- 반환하는 pct = "그 값보다 나쁜 기기의 비율"(0~100). pct가 클수록 내가 좋다 → 상위 (100-pct)%.
--   속도·유지율·효율은 클수록 좋고(값이 작은 기기 비율), 응답시간(ms)은 작을수록 좋다(값이 큰 기기 비율).

create or replace function metric_percentiles(
  c_ms numeric, m_ms numeric, g_peak numeric, g_sus numeric,
  g_ret numeric, p_speedup numeric, p_eff numeric
)
returns table (
  sample_count   bigint,
  compute_pct    numeric,
  memory_pct     numeric,
  peak_pct       numeric,
  sustained_pct  numeric,
  retention_pct  numeric,
  speedup_pct    numeric,
  eff_pct        numeric
)
language sql
security definer
set search_path = public
as $$
  with m as (
    select * from measurements
    where coalesce(interrupted, false) = false and coalesce(model, '') <> '__TEST_DELETE__'
  )
  select
    count(*) as sample_count,
    -- ms: 내 값보다 "느린(큰)" 기기의 비율
    round(100.0 * count(*) filter (where compute_ms > c_ms) / nullif(count(*) filter (where compute_ms is not null), 0), 0),
    round(100.0 * count(*) filter (where memory_ms > m_ms) / nullif(count(*) filter (where memory_ms is not null), 0), 0),
    -- 클수록 좋음: 내 값보다 "낮은" 기기의 비율
    round(100.0 * count(*) filter (where peak_throughput < g_peak) / nullif(count(*) filter (where peak_throughput is not null), 0), 0),
    round(100.0 * count(*) filter (where sustained_throughput < g_sus) / nullif(count(*) filter (where sustained_throughput is not null), 0), 0),
    round(100.0 * count(*) filter (where retention < g_ret) / nullif(count(*) filter (where retention is not null), 0), 0),
    round(100.0 * count(*) filter (where parallel_speedup < p_speedup) / nullif(count(*) filter (where parallel_speedup is not null), 0), 0),
    round(100.0 * count(*) filter (where parallel_efficiency < p_eff) / nullif(count(*) filter (where parallel_efficiency is not null), 0), 0)
  from m;
$$;
