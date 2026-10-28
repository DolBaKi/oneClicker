// stability.js
// - "성능이 유지되는가"(안정성)와 "사양만큼 나오는가"(사양 정합성)를 점수로 바꾼다
// - scoring.js와 나눈 이유: 저쪽은 빠르기를 점수로 바꾸고, 이쪽은 상태를 점수로 바꾼다

const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)));

// zero에서 0점, full에서 100점이 되도록 직선으로 환산한다 (zero > full이어도 된다)
const lerp = (value, zero, full) => clamp(((value - zero) / (full - zero)) * 100);

// 점수가 있는 항목만 모아 가중 평균을 낸다 (측정 못 한 항목을 0점으로 깔지 않기 위해)
export function weightedAverage(parts) {
  let sum = 0;
  let weight = 0;
  parts.forEach((part) => {
    if (part.value === null || part.value === undefined) return;
    sum += part.value * part.weight;
    weight += part.weight;
  });
  return weight > 0 ? Math.round(sum / weight) : null;
}

/*
  안정성 점수.
  retention에 절반을 주는 이유: 이것이 "끝까지 유지된 성능"을 직접 재는 값이다.
  cv와 throttleAt은 OS가 잠깐 딴짓만 해도 흔들리는 보조 지표라 비중을 낮췄다.

  기준값:
  - retention 0.95 이상이면 만점, 0.60 이하면 0점
  - cv 0.05 이하면 만점, 0.30 이상이면 0점 (출렁임이 클수록 감점)
  - throttleAt 없으면(끝까지 버팀) 만점, 늦게 꺾일수록 높고 1.5초 안에 꺾이면 0점
    측정이 6초라서 5초 이후에 꺾인 것은 사실상 버틴 것으로 본다
*/
export function stabilityScore(stress) {
  if (!stress?.supported) return null;

  const retention = stress.retention === null ? null : lerp(stress.retention, 0.60, 0.95);
  const cv = stress.cv === null ? null : lerp(stress.cv, 0.30, 0.05);
  const throttle = stress.throttleAt === null ? 100 : lerp(stress.throttleAt, 1500, 5000);

  return weightedAverage([
    { value: retention, weight: 0.5 },
    { value: cv, weight: 0.25 },
    { value: throttle, weight: 0.25 },
  ]);
}

/*
  사양 정합성 점수 = "가진 사양만큼 실제로 나오는가".

  GPU는 일부러 점수에 넣지 않았다. 이름(예: Iris Xe)으로 등급을 매기려면
  모델별 성능표가 있어야 하는데 그런 데이터가 없고, 사파리처럼 이름을 가리는
  브라우저도 많아서 근거 없는 추측이 된다.

  RAM의 한계를 반드시 알고 봐야 한다:
  navigator.deviceMemory는 최댓값이 8이다. 32GB 기기도 8을 돌려준다.
  그래서 "메모리가 넉넉해서 좋다"는 판정은 원천적으로 불가능하고,
  4GB 미만일 때 감점하는 용도로만 쓴다 (비중도 작게 뒀다).
*/
export function specScore(parallel, hardware) {
  // 8코어인데 speedup이 2배(효율 0.25)면 사양을 못 쓰고 있다는 뜻이다
  const parallelPart = parallel?.supported && parallel.efficiency !== null
    ? lerp(parallel.efficiency, 0.25, 0.80) : null;

  const ram = hardware?.ram;
  const ramPart = ram?.supported
    ? (ram.value >= 4 ? 100 : lerp(ram.value, 1, 4)) : null;

  return weightedAverage([
    { value: parallelPart, weight: 0.75 },
    { value: ramPart, weight: 0.25 },
  ]);
}

/*
  결과 화면에 띄울 한 줄 설명.
  스로틀링이 잡혔다고 "노후"라고 단정하지 않는다. 백그라운드 프로그램, 먼지,
  배터리 절전 모드 등 원인이 여러 가지라 측정값만으로는 가릴 수 없기 때문이다.
*/
export function stabilityNote(stress) {
  if (!stress?.supported) return stress?.reason ?? '안정성을 측정하지 못했습니다';
  if (stress.throttleAt === null) return '부하를 주는 동안 성능이 끝까지 유지됐습니다';

  const seconds = (stress.throttleAt / 1000).toFixed(1);
  const dropPercent = Math.round((1 - stress.retention) * 100);
  return `측정 ${seconds}초 후 성능이 ${dropPercent}% 떨어졌습니다. `
    + '발열이나 백그라운드 작업을 확인해 보세요';
}
