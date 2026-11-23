// result-summary.js
// - 결과 화면 맨 위의 "종합 요약"을 그린다: 종합 점수, 같은 연식 대비 위치, 연식별 평균 그래프, 교체 시기
// - 숫자 비교는 Supabase에 쌓인 실제 기록에서 나온다. 기록이 적으면 순위를 말하지 않고 그렇게 밝힌다
//   (근거 없는 등급을 지어내지 않는다는 원칙 그대로다)

import { getPercentile, getAgeCurve } from './stats.js';
import { usageMonths, monthsToReplace, verdict, grade } from './lifespan.js';
import { scoreGauge, percentileBar, ageCurveChart } from './chart.js';

const box = (id) => document.getElementById(id);

// 교체 시기 한 줄. 기록이 부족하면 숫자 대신 이유를 말한다
function replaceText(prediction) {
  if (prediction.months === null) return prediction.reason;
  if (prediction.months === 0) return '이미 교체를 고려할 상태입니다';
  const years = Math.floor(prediction.months / 12);
  const rest = prediction.months % 12;
  const span = years ? `약 ${years}년${rest ? ` ${rest}개월` : ''}` : `약 ${rest}개월`;
  return `지금 추세면 ${span} 뒤 교체를 고려할 수준에 닿습니다`;
}

export async function renderSummary(result) {
  const target = box('result-summary');
  if (!target) return;

  const score = result.scores?.total ?? null;
  const months = usageMonths(result.device.purchaseYear, result.device.purchaseMonth);
  const coverage = result.scores?.coverage ?? null;

  // Supabase 통계는 느릴 수 있어 먼저 점수만 그리고, 비교는 받아서 채운다
  target.innerHTML = `
    <div class="summary-top">
      <div class="summary-gauge">${scoreGauge(score)}</div>
      <div class="summary-head">
        <p class="summary-grade" id="summary-grade">${grade(score) ?? '측정값이 부족합니다'}</p>
        <p class="summary-verdict" id="summary-verdict">같은 연식 기기와 비교하는 중…</p>
        ${coverage !== null && coverage < 1
    ? `<p class="summary-cov">일부 항목만 측정돼 ${Math.round(coverage * 100)}% 범위로 낸 점수입니다</p>` : ''}
      </div>
    </div>
    <div id="summary-rank" class="summary-rank hidden"></div>
    <div id="summary-age" class="summary-age hidden"></div>`;

  if (score === null) {
    box('summary-verdict').textContent = '점수를 내지 못해 비교할 수 없습니다';
    return;
  }

  // 백분위와 연식 곡선을 함께 가져온다 (하나 실패해도 나머지는 그린다)
  const [percentile, ageCurve] = await Promise.all([getPercentile(score), getAgeCurve()]);

  box('summary-verdict').textContent = verdict(score, months, percentile);

  if (percentile?.enough) {
    const rank = box('summary-rank');
    rank.innerHTML = `
      <p class="summary-rank-label">같은 ${(months / 12).toFixed(1)}년 사용 기기 중 내 위치
        <span class="summary-rank-n">· 비교 ${percentile.sampleCount}대</span></p>
      ${percentileBar(percentile.percentile)}
      <p class="summary-rank-mid">가운데 선이 중앙값(50%)입니다. 오른쪽일수록 상태가 좋습니다</p>`;
    rank.classList.remove('hidden');
  }

  if (ageCurve && ageCurve.length >= 2) {
    const age = box('summary-age');
    const prediction = monthsToReplace(score, ageCurve);
    age.innerHTML = `
      <h2 class="field-label">연식별 평균 점수와 내 위치</h2>
      ${ageCurveChart(ageCurve, months, score)}
      <p class="chart-help">회색 선은 쌓인 기록의 사용 기간별 평균 점수이고, 파란 점이 내 노트북입니다.
        평균선보다 위면 또래보다 상태가 좋은 것입니다.</p>
      <p class="summary-replace">${replaceText(prediction)}</p>`;
    age.classList.remove('hidden');
  }
}
