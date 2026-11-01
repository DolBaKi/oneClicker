// lifespan.js
// - 점수와 구입 시기를 합쳐 "지금 어느 정도인지"와 "언제 바꿔야 하는지"를 내는 파일
// - 점수 환산(scoring.js)과 나눈 이유: 저쪽은 측정값을 점수로만 바꾸고, 시간 개념이 없다

/*
  교체를 권할 기준선. 측정에서 나온 값이 아니라 우리가 정한 선이다.
  예전엔 여기에 "월 0.55점씩 떨어진다"는 가정이 있었는데 지웠다. 근거 없는 숫자로
  "교체까지 25개월" 같은 예측을 만들고 있었기 때문이다. 지어내느니 모른다고 하는 게 맞다.
*/
const REPLACE_LINE = 40;

// 구입 연월부터 지금까지 몇 개월 지났는지
export function usageMonths(year, month) {
  const now = new Date();
  const months = (now.getFullYear() - Number(year)) * 12 + (now.getMonth() + 1 - Number(month));
  return Math.max(0, months);
}

// 연식별 평균 점수 곡선에서 "한 달에 몇 점씩 떨어지는지"를 구한다.
// 최소제곱법으로 직선을 맞춰 기울기만 가져온다. 구간이 2개 미만이면 직선을 못 그려 null.
export function dropPerMonth(ageCurve) {
  if (!ageCurve || ageCurve.length < 2) return null;

  const n = ageCurve.length;
  const sumX = ageCurve.reduce((a, p) => a + p.ageMonths, 0);
  const sumY = ageCurve.reduce((a, p) => a + p.avgScore, 0);
  const sumXY = ageCurve.reduce((a, p) => a + p.ageMonths * p.avgScore, 0);
  const sumXX = ageCurve.reduce((a, p) => a + p.ageMonths ** 2, 0);

  const denominator = n * sumXX - sumX ** 2;
  if (denominator === 0) return null;

  const slope = (n * sumXY - sumX * sumY) / denominator;
  // 점수가 오르는 기울기가 나왔다면 표본이 치우친 것이다. 그런 값은 쓰지 않는다
  return slope < 0 ? Math.abs(slope) : null;
}

/*
  교체까지 남은 개월 수를 계산한다.

  실제로 쌓인 기록(ageCurve)에서 "한 달에 몇 점씩 떨어지는가"를 구할 수 있을 때만 답한다.
  구하지 못하면 개월 수를 내놓지 않고 그 이유를 돌려준다.
  임의의 하락 속도를 가정해 숫자를 만들면, 측정이 아니라 지어낸 값을 보여주는 것이 된다.
*/
export function monthsToReplace(totalScore, ageCurve) {
  if (totalScore === null || totalScore === undefined) {
    return { months: null, reason: '총점을 내지 못해 예측할 수 없습니다' };
  }

  const drop = dropPerMonth(ageCurve);
  if (drop === null) {
    return { months: null, reason: '비교할 측정 기록이 아직 부족해 예측할 수 없습니다' };
  }
  // 이름을 perMonth로 둔 이유: dropPerMonth는 위에 있는 함수 이름이라 같은 이름을 쓰면 가려버린다
  const perMonth = Number(drop.toFixed(2));
  // 이미 기준선 아래면 남은 개월을 셀 게 없다. 0개월이라고 쓰면 헷갈리므로 따로 표시한다
  if (totalScore <= REPLACE_LINE) return { months: 0, basis: 'measured', dropPerMonth: perMonth };

  return {
    months: Math.min(Math.round((totalScore - REPLACE_LINE) / drop), 120), // 10년 넘는 예측은 자른다
    basis: 'measured',
    dropPerMonth: perMonth,
  };
}

// 같은 또래 기기와 비교해 한 줄 판단을 만든다.
// 점수만으로는 "원래 느린 신형"과 "낡아서 느린 구형"이 구분되지 않아 사용 개월을 같이 본다.
export function verdict(totalScore, months, percentile) {
  const years = (months / 12).toFixed(1);

  // "빠르다/느리다"가 아니라 "상태"로 말한다. 지금 총점은 속도가 아니라
  // 부하 중 성능이 유지되는 정도를 본 값이라, 속도 표현을 쓰면 다른 뜻이 된다
  if (percentile?.enough) {
    const rank = percentile.percentile;
    if (rank >= 70) return `${years}년 사용 기기 중 상태가 좋은 편입니다 (상위 ${100 - rank}%)`;
    if (rank >= 30) return `${years}년 사용 기기로 평균 수준입니다 (상위 ${100 - rank}%)`;
    return `같은 조건의 기기보다 상태가 나쁩니다 (하위 ${rank}%)`;
  }

  // 표본이 모자라면 순위를 말하지 않는다. 5명 중 1등은 1등이 아니다
  const n = percentile?.sampleCount ?? 0;
  return `${years}년 사용 · 비교할 기록이 ${n}건뿐이라 순위는 아직 보여줄 수 없습니다`;
}

/*
  총점에 붙이는 한 줄 상태.

  "교체 권장" 같은 결론은 쓰지 않는다. 지금 총점은 안정성과 사양 정합성, 즉
  "성능이 유지되는가"만 보고 낸 값이라서 교체 여부를 판단할 근거가 되지 못한다.
  (속도는 비교 기준이 없어 점수에서 빠져 있고, 교체 시기는 monthsToReplace가 따로 답한다)
  경계값 80/60/40도 측정에서 나온 것이 아니라 우리가 정한 선이다.
*/
export function grade(totalScore) {
  if (totalScore === null || totalScore === undefined) return null;
  if (totalScore >= 80) return '성능이 안정적으로 유지됨';
  if (totalScore >= 60) return '가벼운 성능 저하';
  if (totalScore > REPLACE_LINE) return '성능 저하가 뚜렷함';
  return '성능 저하가 심함';
}
