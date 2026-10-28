// scoring.js
// - 측정 원시값(ms, fps)을 0~100 점수로 바꾸는 파일 (환산 규칙만)
// - 측정·화면과 떼어놓은 이유: 기준값은 앞으로 자주 손볼 부분이라 한 곳에 모아둔다

/*
  주의: 아래 기준값은 아직 추정치다.
  여러 기기에서 측정한 실제 분포가 아니라, 개발에 쓴 노트북 한 대의 값
  (연산 약 101ms, 메모리 약 48ms)을 기준으로 잡았다.
  Supabase에 기록이 쌓이면 그 분포를 보고 다시 맞춰야 한다.
*/
const ANCHORS = {
  compute: { best: 90, worst: 900 },   // ms (작을수록 좋다)
  memory: { best: 45, worst: 450 },    // ms (작을수록 좋다)
  graphics: { best: 60, worst: 10 },   // fps (클수록 좋다)
};

// 총점 가중치. 노트북이 느리다고 느끼는 데는 연산 속도가 가장 크게 작용한다
const WEIGHTS = { compute: 0.4, graphics: 0.3, memory: 0.3 };

/*
  한 항목을 0~100으로 환산한다.
  로그 눈금을 쓰는 이유: 성능 차이는 "100ms 차이"가 아니라 "2배 느림"처럼 배수로 체감된다.
  100ms와 200ms의 차이가 800ms와 900ms의 차이보다 훨씬 크게 느껴지는 것과 같다.
  best/worst의 대소 관계는 신경 쓰지 않아도 된다 (fps처럼 클수록 좋은 값도 같은 식으로 처리됨).
*/
export function toScore(value, anchor) {
  if (value === null || value === undefined || value <= 0) return null;
  const ratio =
    (Math.log(anchor.worst) - Math.log(value)) /
    (Math.log(anchor.worst) - Math.log(anchor.best));
  return Math.max(0, Math.min(100, Math.round(ratio * 100)));
}

/*
  세 항목을 모두 환산하고 총점을 낸다.
  WebGL 미지원 등으로 빠진 항목이 있으면 그 가중치를 빼고 남은 항목끼리 다시 나눈다.
  (안 그러면 측정하지 못한 항목을 0점으로 깔고 가는 셈이 된다)
*/
export function scoreAll(benchmark) {
  const scores = {
    compute: toScore(benchmark.compute.ms, ANCHORS.compute),
    graphics: toScore(benchmark.graphics.fps, ANCHORS.graphics),
    memory: toScore(benchmark.memory.ms, ANCHORS.memory),
  };

  let weighted = 0;
  let weightSum = 0;
  Object.entries(scores).forEach(([key, score]) => {
    if (score === null) return;
    weighted += score * WEIGHTS[key];
    weightSum += WEIGHTS[key];
  });

  return { ...scores, total: weightSum > 0 ? Math.round(weighted / weightSum) : null };
}

// TODO: 4차시 - 구입 연월·하루 사용 시간·주 용도를 함께 써서 교체 시기(개월 수)를 예측할 예정
