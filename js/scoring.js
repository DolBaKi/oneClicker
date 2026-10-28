// scoring.js
// - 측정값을 0~100 점수로 바꾸고 가중 평균으로 총점을 낸다 (환산 규칙만)
// - 안정성·사양 정합성 환산은 stability.js가 맡는다 (빠르기가 아니라 상태를 보는 일이라 성격이 다르다)

import { stabilityScore, specScore, weightedAverage } from './stability.js';

/*
  주의: 아래 기준값은 아직 추정치다.
  연산·메모리는 개발에 쓴 노트북 한 대의 실측값(약 101ms, 48ms)에서 잡았고,
  그래픽 처리량과 병렬 speedup은 비교할 데이터가 없어 더 거친 추정이다.
  Supabase에 기록이 쌓이면 실제 분포를 보고 반드시 다시 맞춰야 한다.
*/
const ANCHORS = {
  computeSingle: { best: 90, worst: 900 },    // ms
  computeParallel: { best: 8, worst: 1.5 },   // speedup 배수
  graphics: { best: 1500, worst: 40 },        // Mpixel/s (유지되는 처리량)
  graphicsFps: { best: 60, worst: 10 },       // 스트레스를 못 쟀을 때 쓰는 대체값
  memory: { best: 45, worst: 450 },           // ms
};

/*
  가중치. 실측 70% + 상태·사양 30%.
  상태에 30%나 주는 이유: 이 서비스가 가리려는 건 "원래 느린 신형"과
  "낡아서 느려진 구형"의 차이인데, 그건 절대 속도가 아니라 유지력에서 드러난다.
*/
const WEIGHTS = {
  computeSingle: 0.20,
  computeParallel: 0.15,
  graphics: 0.20,
  memory: 0.15,
  stability: 0.20,
  spec: 0.10,
};

/*
  로그 눈금으로 환산한다.
  성능 차이는 "100ms 차이"가 아니라 "2배 느림"처럼 배수로 체감되기 때문이다.
  best/worst의 대소 관계는 신경 쓰지 않아도 된다 (클수록 좋은 값도 같은 식으로 처리됨).
*/
export function toScore(value, anchor) {
  if (value === null || value === undefined || value <= 0) return null;
  const ratio = (Math.log(anchor.worst) - Math.log(value))
    / (Math.log(anchor.worst) - Math.log(anchor.best));
  return Math.max(0, Math.min(100, Math.round(ratio * 100)));
}

/*
  그래픽 점수는 "유지되는 처리량"을 우선 쓴다.
  스트레스를 못 쟀을 때만 평균 FPS로 대체하는데, FPS는 모니터 주사율이 천장이라
  변별력이 떨어진다. 그래서 이 경우 점수를 그대로 믿기 어렵다는 뜻으로 fallback을 남긴다.
*/
function graphicsScore(stress, fps) {
  if (stress?.supported && stress.sustained > 0) {
    return { value: toScore(stress.sustained, ANCHORS.graphics), fallback: false };
  }
  return { value: toScore(fps, ANCHORS.graphicsFps), fallback: true };
}

/*
  전부 환산해 총점을 낸다.
  측정하지 못한 항목은 0점으로 깔지 않고 가중치에서 빼 남은 항목끼리 다시 나눈다.
  (못 잰 것과 못한 것은 다르다)
*/
export function scoreAll({ benchmark, stress, parallel, hardware }) {
  const graphics = graphicsScore(stress, benchmark?.graphics?.fps);

  const scores = {
    computeSingle: toScore(benchmark?.compute?.ms, ANCHORS.computeSingle),
    computeParallel: parallel?.supported
      ? toScore(parallel.speedup, ANCHORS.computeParallel) : null,
    graphics: graphics.value,
    memory: toScore(benchmark?.memory?.ms, ANCHORS.memory),
    stability: stabilityScore(stress),
    spec: specScore(parallel, hardware),
  };

  const parts = Object.entries(scores).map(([key, value]) => ({ value, weight: WEIGHTS[key] }));

  /*
    coverage = 실제로 측정에 성공한 항목들의 가중치 합.
    이걸 같이 돌려주는 이유: 못 잰 항목은 가중치에서 빼고 나누는데, 그러다 보면
    "안정성을 못 쟀는데 나머지가 좋아서 100점"처럼 점수가 부풀 수 있다.
    총점만 보면 그게 드러나지 않으므로, 얼마나 재고 내린 점수인지를 함께 밝힌다.
  */
  const coverage = parts.reduce(
    (sum, part) => (part.value === null || part.value === undefined ? sum : sum + part.weight), 0,
  );

  return {
    ...scores,
    total: weightedAverage(parts),
    coverage: Number(coverage.toFixed(2)),
    graphicsFromFps: graphics.fallback,
  };
}
