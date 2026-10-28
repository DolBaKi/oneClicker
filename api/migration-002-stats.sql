-- migration-002-stats.sql
-- js/stats.js가 부르는 통계 함수 두 개를 만든다.
--
-- 표(measurements)를 직접 읽게 열어주지 않고 함수로 감싸는 이유:
-- 읽기를 열면 키만 있으면 남의 측정 기록을 통째로 볼 수 있다.
-- 함수는 "집계한 숫자"만 돌려주므로 개별 기록은 밖으로 나가지 않는다.
-- security definer = 함수를 만든 사람 권한으로 도는 설정. 이게 있어야 RLS를 넘어 집계할 수 있다.

-- 중간에 그만둔 측정은 통계에서 제외한다 (정확도가 낮기 때문)
create or replace function score_percentile(my_score integer)
returns table (sample_count bigint, percentile numeric, median numeric)
language sql
security definer
set search_path = public
as $$
  select
    count(*)                                              as sample_count,
    coalesce(round(100.0 * count(*) filter (where total_score < my_score)
                   / nullif(count(*), 0), 1), 0)          as percentile,
    coalesce(percentile_cont(0.5) within group (order by total_score), 0) as median
  from measurements
  where total_score is not null and coalesce(interrupted, false) = false;
$$;

-- 연식(사용 개월)을 6개월 단위로 묶어 평균 점수를 낸다.
-- "오래될수록 점수가 얼마나 떨어지는가"를 재는 재료이고, lifespan.js가 이걸로 기울기를 구한다.
create or replace function score_by_age()
returns table (age_bucket integer, sample_count bigint, avg_score numeric)
language sql
security definer
set search_path = public
as $$
  select
    (floor(months / 6.0) * 6)::integer as age_bucket,
    count(*)                           as sample_count,
    round(avg(total_score), 1)         as avg_score
  from (
    select
      total_score,
      (extract(year from age(make_date(purchase_year, purchase_month, 1))) * 12
       + extract(month from age(make_date(purchase_year, purchase_month, 1)))) as months
    from measurements
    where total_score is not null
      and purchase_year is not null and purchase_month is not null
      and coalesce(interrupted, false) = false
  ) t
  where months between 0 and 180
  group by age_bucket
  having count(*) >= 3          -- 표본이 2건 이하인 구간은 평균이 의미 없어 버린다
  order by age_bucket;
$$;

-- 브라우저(anon 키)가 이 함수들만 부를 수 있게 허용한다
grant execute on function score_percentile(integer) to anon;
grant execute on function score_by_age() to anon;
