// lifespan.js
// - 점수와 구입 시기를 합쳐 "지금 어느 정도인지"와 "언제 바꿔야 하는지"를 내는 파일
// - 점수 환산(scoring.js)과 나눈 이유: 저쪽은 측정값을 점수로만 바꾸고, 시간 개념이 없다

const REPLACE_LINE = 40;        // 이 점수 아래면 교체를 권한다
const FALLBACK_DROP = 0.55;     // 데이터가 없을 때 쓸 월간 하락 폭(점/월). 아래 주석 참고

/*
  FALLBACK_DROP은 추정치다. 측정 기록이 쌓이기 전까지만 쓰는 임시 값이고,
  기록이 충분해지면 getAgeCurve()가 준 실제 분포에서 계산한 값으로 대체된다.
  값을 코드 여기저기 흩지 않고 이 파일 맨 위에 모아둔 이유도 나중에 지우기 쉬우라고다.
*/

// 구입 연월부터 지금까지 몇 개월 지났는지
export function usageMonths(year, month) {
  const now = new Date();
  const months = (now.getFullYear() - Number(year)) * 12 + (now.getMonth() + 1 - Number(month));
  return Math.max(0, months);
}

/*
  연식별 평균 점수 곡선에서 "한 달에 몇 점씩 떨어지는지"를 구한다.
  최소제곱법으로 직선을 맞춰 기울기만 가져온다.
  구간이 2개 미만이면 직선을 그릴 수 없으므로 null을 돌려준다.
*/
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
  교체까지 남은 개월 수를 추정한다.
  이미 기준선 아래면 0을 돌려준다(= 지금 교체 권장).
*/
export function monthsToReplace(totalScore, ageCurve) {
  if (totalScore === null || totalScore === undefined) return null;
  if (totalScore <= REPLACE_LINE) return { months: 0, basis: 'now' };

  const measured = dropPerMonth(ageCurve);
  const drop = measured ?? FALLBACK_DROP;
  const months = Math.round((totalScore - REPLACE_LINE) / drop);

  return {
    months: Math.min(months, 120),            // 10년 넘는 예측은 의미가 없어 잘라둔다
    basis: measured ? 'measured' : 'estimate', // 실제 분포인지 임시 추정인지 밝힌다
    dropPerMonth: Number(drop.toFixed(2)),
  };
}

/*
  같은 또래 기기와 비교해 한 줄 판단을 만든다.
  벤치마크 점수만으로는 "원래 느린 신형"과 "낡아서 느린 구형"을 구분할 수 없어서,
  사용 개월 수를 반드시 같이 본다.
*/
export function verdict(totalScore, months, percentile) {
  const years = (months / 12).toFixed(1);

  if (percentile?.enough) {
    const rank = percentile.percentile;
    if (rank >= 70) return `${years}년 사용 기기 치고 빠른 편입니다 (상위 ${100 - rank}%)`;
    if (rank >= 30) return `${years}년 사용 기기로 평균 수준입니다 (상위 ${100 - rank}%)`;
    return `같은 조건의 기기보다 느립니다 (하위 ${rank}%)`;
  }

  // 표본이 모자라면 순위를 말하지 않는다. 5명 중 1등은 1등이 아니다
  const n = percentile?.sampleCount ?? 0;
  return `${years}년 사용 · 비교할 기록이 ${n}건뿐이라 순위는 아직 보여줄 수 없습니다`;
}

export function grade(totalScore) {
  if (totalScore === null || totalScore === undefined) return null;
  if (totalScore >= 80) return '양호';
  if (totalScore >= 60) return '주의';
  if (totalScore > REPLACE_LINE) return '경고';
  return '교체 권장';
}
