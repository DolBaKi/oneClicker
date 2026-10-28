// scoring.js
// - 측정 결과를 점수로 바꾼다. 단, 실제로 잰 값에서만 점수를 낸다
// - 환산 규칙은 stability.js가 맡는다 (이 파일은 무엇을 점수화하고 무엇을 안 할지만 정한다)

import { stabilityScore, specScore, weightedAverage } from './stability.js';

/*
  왜 속도(ms, fps, Mpixel/s)는 점수로 바꾸지 않는가:

  절대 속도를 0~100으로 바꾸려면 "몇 ms가 100점인가"라는 기준이 있어야 하는데,
  그 기준은 여러 기기의 실제 분포에서 나와야 한다. 지금은 그 데이터가 없다.
  개발에 쓴 노트북 한 대의 값을 기준으로 삼으면, 점수가 그 노트북과의 비교일 뿐인데
  마치 객관적인 평가인 것처럼 보인다. 그래서 속도는 잰 숫자 그대로만 보여준다.

  반면 아래 두 가지는 바깥 기준 없이도 점수를 낼 수 있다.
  그 기기 안에서 잰 값끼리의 비율이기 때문이다.
    - 안정성: 유지된 성능 / 최고 성능 (retention). 1에 가까울수록 좋다는 건 정의상 참이다
    - 사양 정합성: 단일 대비 병렬 효율. 코어 수만큼 못 쓰면 낮다는 것도 정의상 참이다
  다만 "retention 0.6이면 몇 점인가" 같은 절단점은 우리가 정한 선이다.
  이것도 데이터가 아니므로 stability.js 주석에 근거를 적어두었다.

  TODO: Supabase에 기록이 충분히 쌓이면 score_percentile로 속도의 백분위를 구해
        여기에 속도 점수를 다시 넣는다. 그때는 지어낸 기준이 아니라 실제 분포가 근거가 된다.
*/
const WEIGHTS = {
  stability: 0.6, // 이 서비스가 가장 보려는 값이라 비중을 크게 둔다
  spec: 0.4,
};

export function scoreAll({ benchmark, stress, parallel, hardware }) {
  const scores = {
    stability: stabilityScore(stress),
    spec: specScore(parallel, hardware),
  };

  const parts = Object.entries(scores).map(([key, value]) => ({ value, weight: WEIGHTS[key] }));

  /*
    coverage = 실제로 측정에 성공한 항목들의 가중치 합.
    못 잰 항목은 가중치에서 빼고 나누는데, 그러다 보면 남은 항목이 좋을 때 점수가 부풀 수 있다.
    총점만 보면 그게 드러나지 않으므로, 얼마나 재고 내린 점수인지를 함께 밝힌다.
  */
  const coverage = parts.reduce(
    (sum, part) => (part.value === null || part.value === undefined ? sum : sum + part.weight), 0,
  );

  return {
    ...scores,
    total: weightedAverage(parts),
    coverage: Number(coverage.toFixed(2)),
    // 속도는 점수를 매기지 않는다. 결과 화면이 이 값을 보고 안내 문구를 띄운다
    speedScored: false,
  };
}
