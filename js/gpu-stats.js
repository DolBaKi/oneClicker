// gpu-stats.js
// - 스트레스 측정이 모은 시계열에서 요약값을 뽑아내는 파일 (계산만)
// - gpu-stress.js와 나눈 이유: 저쪽은 GPU를 돌리는 일, 이쪽은 숫자를 해석하는 일이라
//   바뀌는 이유가 다르다 (판정 기준은 앞으로 자주 손볼 부분이다)

const TAIL_RATIO = 0.3;      // 뒤쪽 30%를 "안정화된 구간"으로 본다
const THROTTLE_RATIO = 0.85; // 최고치의 85% 아래로 내려가면 성능이 유지되지 못한 것으로 본다

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// 하위 p%에 해당하는 값. 표본이 적을 때도 안전하도록 가장 가까운 순위를 쓴다
function percentile(values, p) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index];
}

/*
  성능이 처음으로 꺾인 시점을 찾는다.
  최고치가 나온 구간보다 "뒤"에서만 찾는 이유:
  측정 시작 직후에는 GPU 클럭이 아직 올라가지 않아 몇 구간은 느리게 나온다.
  그 구간까지 세면 멀쩡한 기기도 "시작하자마자 스로틀링"으로 잘못 잡힌다.
*/
function findThrottleAt(samples, peak, peakIndex) {
  const limit = peak * THROTTLE_RATIO;
  for (let i = peakIndex + 1; i < samples.length; i++) {
    if (samples[i].throughput < limit) return samples[i].t;
  }
  return null; // 끝까지 유지됐다
}

/*
  시계열에서 판단 재료를 뽑는다.
  - peak:       낼 수 있는 최고 성능
  - sustained:  뒤쪽 구간의 중앙값 = 실제로 유지되는 성능
  - retention:  sustained / peak. 1에 가까울수록 끝까지 버틴 것
  - p1Low:      가장 나빴던 순간 (끊김이 얼마나 심한지)
  - cv:         변동계수. 값이 얼마나 출렁였는지 (평균 대비 표준편차)
*/
export function summarize(samples) {
  if (!samples || samples.length === 0) return null;

  const values = samples.map((s) => s.throughput);
  const peak = Math.max(...values);
  const peakIndex = values.indexOf(peak);

  const tailStart = Math.floor(samples.length * (1 - TAIL_RATIO));
  const sustained = median(values.slice(tailStart));

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  const cv = mean > 0 ? Math.sqrt(variance) / mean : null;

  return {
    peak: Number(peak.toFixed(2)),
    sustained: Number(sustained.toFixed(2)),
    retention: peak > 0 ? Number((sustained / peak).toFixed(3)) : null,
    p1Low: Number(percentile(values, 1).toFixed(2)),
    cv: cv === null ? null : Number(cv.toFixed(3)),
    throttleAt: findThrottleAt(samples, peak, peakIndex),
  };
}
