-- schema.sql
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 한 번만 실행한다.

create table if not exists measurements (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- 기기 정보 (device.html에서 사용자가 입력한 값)
  model text not null,
  purchase_year int,
  purchase_month int,
  daily_hours numeric,
  -- 컬럼 이름을 usage가 아닌 usage_type으로 둔 이유:
  -- usage는 SQL 예약어라서 따옴표 없이 쓰면 문법 오류가 날 수 있다
  usage_type text,

  -- 실측 원시값 (기기마다 환경이 달라 절대 평가가 아니라 비교용이다)
  compute_ms numeric,
  graphics_fps numeric,
  memory_ms numeric,
  cores int,
  memory_gb numeric,

  -- 0~100으로 환산한 점수
  compute_score int,
  graphics_score int,
  memory_score int,
  total_score int
);

-- RLS를 켜면 아래에 적은 정책에 허용된 작업만 할 수 있게 된다.
-- 키가 브라우저에 노출되어도 안전한 이유가 바로 이것이다.
alter table measurements enable row level security;

-- 누구나 자기 측정 결과를 넣을 수는 있다
create policy "anyone can insert measurements"
  on measurements for insert to anon with check (true);

-- 읽기 정책은 일부러 만들지 않는다.
-- 읽기를 열어두면 키만 있으면 남의 측정 기록을 전부 볼 수 있기 때문이다.
-- 나중에 통계를 보여주려면 집계 결과만 돌려주는 함수(RPC)를 따로 만드는 편이 안전하다.
