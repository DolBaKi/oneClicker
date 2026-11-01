// compare.js
// - Supabase에 쌓인 다른 기기 기록과 견줘 "내 기기가 어느 위치인지"를 화면에 쓴다
// - result.js에서 떼어낸 이유: 이쪽만 네트워크를 쓰고 늦게 도착해서, 흐름이 달라진다

import { getPercentile, getAgeCurve } from './stats.js';
import { usageMonths, monthsToReplace, verdict } from './lifespan.js';

const write = (id, text) => { document.getElementById(id).textContent = text; };

/*
  사용 기간과 교체 시기.
  교체 시기는 실제 기록에서 하락 속도를 구할 수 있을 때만 말한다.
  기록이 없으면 숫자를 지어내지 않고 "아직 알 수 없다"고 쓴다.
*/
function renderLifespan(result, ageCurve) {
  const months = usageMonths(result.device.purchaseYear, result.device.purchaseMonth);
  const used = `${(months / 12).toFixed(1)}년 사용 중`;
  const estimate = monthsToReplace(result.scores.total, ageCurve);

  if (estimate.months === null) write('lifespan', `${used} · ${estimate.reason}`);
  else if (estimate.months === 0) {
    write('lifespan', `${used} · 이미 교체를 고려할 상태입니다 (기록 ${estimate.dropPerMonth}점/월 기준)`);
  } else {
    write('lifespan', `${used} · 교체까지 약 ${estimate.months}개월 (기록 ${estimate.dropPerMonth}점/월 기준)`);
  }
  return months;
}

/*
  같은 조건의 기기들 사이에서 몇 등쯤인지.
  표본이 적으면 순위를 말하지 않는다. 5명 중 1등은 1등이라고 할 수 없다.
  (몇 건부터 의미가 있는지는 stats.js의 enough 플래그가 정한다)
*/
function renderRank(result, months, percentile) {
  if (percentile === null) {
    write('rank-note', '비교 기록을 불러오지 못했습니다. 순위는 다음에 확인해 주세요');
    write('rank-detail', ''); // 실패했는데 이전 숫자가 남아 있으면 잘못 읽힌다
    return;
  }
  write('rank-note', verdict(result.scores.total, months, percentile));

  const detail = document.getElementById('rank-detail');
  detail.textContent = percentile.enough
    ? `비교 기록 ${percentile.sampleCount}건 · 전체 중앙값 ${percentile.median}점`
    : `지금까지 모인 기록 ${percentile.sampleCount}건`;
}

/*
  두 가지를 한꺼번에 물어본다.
  네트워크가 느리거나 실패해도 결과 화면 자체는 이미 떠 있어야 하므로,
  여기서 실패하면 그 자리만 안내 문구로 채우고 끝낸다 (stats.js가 null을 돌려준다).
*/
export async function renderComparison(result) {
  const [ageCurve, percentile] = await Promise.all([
    getAgeCurve(),
    getPercentile(result.scores.total ?? 0),
  ]);
  const months = renderLifespan(result, ageCurve);
  renderRank(result, months, percentile);
}
