-- migration-001.sql
-- 지속 부하 측정과 병렬 연산 측정 결과를 담을 칸을 추가한다.
-- schema.sql(처음 만들 때 쓰는 파일)을 이미 실행한 뒤에 이걸 실행하면 된다.
-- if not exists를 붙여서 두 번 실행해도 오류가 나지 않는다.

alter table measurements
  -- 지속 부하 요약. 시계열 전체는 저장하지 않는다 (행이 너무 커지고 통계에는 요약이면 충분하다)
  add column if not exists peak_throughput numeric,      -- 최고 처리량 (Mpixel/s)
  add column if not exists sustained_throughput numeric, -- 뒤쪽 구간에서 유지된 처리량
  add column if not exists retention numeric,            -- sustained / peak (1에 가까울수록 건강)
  add column if not exists p1_low numeric,               -- 하위 1% 처리량 (최악의 순간)
  add column if not exists cv numeric,                   -- 변동계수 (흔들림 정도)
  add column if not exists throttle_at_ms integer,       -- 성능이 꺾인 시점 (없으면 null)

  -- 병렬 연산
  add column if not exists parallel_speedup numeric,     -- 단일 대비 몇 배
  add column if not exists parallel_efficiency numeric,  -- speedup / 코어수

  -- 점수
  add column if not exists stability_score integer,      -- 안정성 점수 (0~100)

  -- 사용자가 중간에 그만둔 측정인지. 통계를 낼 때 걸러내려고 남긴다
  add column if not exists interrupted boolean default false;
