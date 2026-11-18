-- migration-003.sql
-- 기기 정보 화면에서 모델을 목록(data/models.json)으로 고를 수 있게 되면서, 고른 모델의 id를 저장할 칸을 추가한다.
-- migration-002-stats.sql까지 실행한 뒤에 실행한다. if not exists라 두 번 실행해도 괜찮다.
--
-- model(글자)이 이미 있는데 따로 두는 이유:
--   사람이 친 이름은 "그램16", "LG gram 16", "16Z90R"처럼 같은 노트북도 제각각이라 묶을 수 없다.
--   목록에서 고른 id는 하나로 정해져 있어서 "같은 모델끼리의 평균"을 낼 수 있다.
--   직접 입력한 사람은 id가 없으므로(null) 같은 모델 비교에서는 빠진다.

alter table measurements
  add column if not exists model_id text;

-- 같은 모델끼리 모아 볼 때 빨리 찾도록 색인을 건다
create index if not exists measurements_model_id_idx on measurements (model_id);
