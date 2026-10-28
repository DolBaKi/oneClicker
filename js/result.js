// result.js
// - 분석 결과 화면의 화면 조작 담당 (점수 막대, 그래프, 원시값 목록)
// - 점수 계산은 하지 않는다: collect.js에서 환산해 저장해둔 값을 꺼내 쓴다

import { loadResult, clearDeviceInfo, clearResult } from './store.js';
import { renderSummary } from './summary.js';
import { stressChart } from './chart.js';
import { stabilityNote } from './stability.js';
import { renderScores } from './result-scores.js';
import { usageMonths, monthsToReplace } from './lifespan.js';
import { getAgeCurve } from './stats.js';

// 측정값 목록. 값이 없으면 '지원 안 함'으로 둔다
function renderRaw({ benchmark, parallel, stress, hardware }) {
  const rows = [
    ['연산 (단일)', benchmark?.compute?.ms, (v) => `${Math.round(v)} ms`],
    ['병렬 speedup', parallel?.speedup, (v) => `${v}배 (효율 ${parallel.efficiency})`],
    ['그래픽 최고 속도', benchmark?.graphics?.fps, (v) => `${v} fps`],
    ['그래픽 유지 처리량', stress?.sustained, (v) => `${v} Mpixel/s`],
    ['메모리 응답', benchmark?.memory?.ms, (v) => `${Math.round(v)} ms`],
    ['CPU 코어 수', hardware?.cpu?.cores, (v) => `${v}개`],
    ['메모리 용량', hardware?.ram?.value,
      (v) => (hardware.ram.isCapped ? `${v} GB 이상` : `약 ${v} GB`)],
    ['GPU', hardware?.gpu?.renderer, (v) => String(v)],
  ];
  document.getElementById('raw-list').innerHTML = rows.map(([label, value, format]) =>
    `<dt>${label}</dt><dd>${value === null || value === undefined ? '지원 안 함' : format(value)}</dd>`
  ).join('');
}

// 지속 부하 그래프와 설명 문구
function renderStress(result) {
  document.getElementById('stress-chart').innerHTML = stressChart(result.stress);
  document.getElementById('stress-note').textContent = stabilityNote(result.stress);
  if (result.interrupted) {
    document.getElementById('interrupted-note').classList.remove('hidden');
  }
}

/*
  사용 기간과 교체 시기.
  교체 시기는 실제 기록에서 하락 속도를 구할 수 있을 때만 말한다.
  아직 기록이 없으므로 지금은 "예측할 수 없다"가 정상 결과다.
  (ageCurve는 Supabase에 기록이 쌓이면 stats.js의 getAgeCurve()가 채워준다)
*/
function renderLifespan(result, ageCurve) {
  const months = usageMonths(result.device.purchaseYear, result.device.purchaseMonth);
  const used = `${(months / 12).toFixed(1)}년 사용 중`;
  const estimate = monthsToReplace(result.scores.total, ageCurve);

  document.getElementById('lifespan').textContent = estimate.months === null
    ? `${used} · ${estimate.reason}`
    : `${used} · 교체까지 약 ${estimate.months}개월 (측정 기록 ${estimate.dropPerMonth}점/월 기준)`;
}

const result = loadResult();
if (!result) {
  window.location.replace('device.html');
} else {
  renderSummary(result.device);
  renderScores(result.scores);
  renderStress(result);
  renderRaw(result);
  // 실제 기록을 먼저 물어보고, 받아온 분포로만 교체 시기를 계산한다 (못 받아오면 null)
  getAgeCurve().then((ageCurve) => renderLifespan(result, ageCurve));
  document.getElementById('restart-button').addEventListener('click', () => {
    clearDeviceInfo(); // 저장된 값을 비워야 처음부터 다시 입력받는다
    clearResult();
    window.location.assign('../index.html');
  });
}
