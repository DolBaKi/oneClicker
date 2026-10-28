// result.js
// - 분석 결과 화면의 화면 조작 담당 (점수 막대, 그래프, 원시값 목록)
// - 점수 계산은 하지 않는다: collect.js에서 환산해 저장해둔 값을 꺼내 쓴다

import { loadResult, clearDeviceInfo, clearResult } from './store.js';
import { renderSummary } from './summary.js';
import { stressChart } from './chart.js';
import { stabilityNote } from './stability.js';
import { renderScores } from './result-scores.js';
import { usageMonths, monthsToReplace } from './lifespan.js';

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

// 교체 시기. 비교할 기록이 아직 없으므로 추정값임을 분명히 밝힌다
function renderLifespan(result) {
  const months = usageMonths(result.device.purchaseYear, result.device.purchaseMonth);
  const estimate = monthsToReplace(result.scores.total, null);
  const basis = estimate?.basis === 'measured' ? '실제 기록 기반' : '임시 추정값';
  document.getElementById('lifespan').textContent = estimate === null
    ? `${(months / 12).toFixed(1)}년 사용 중`
    : `${(months / 12).toFixed(1)}년 사용 중 · 교체까지 약 ${estimate.months}개월 (${basis})`;
}

const result = loadResult();
if (!result) {
  window.location.replace('device.html');
} else {
  renderSummary(result.device);
  renderScores(result.scores);
  renderStress(result);
  renderRaw(result);
  renderLifespan(result);
  document.getElementById('restart-button').addEventListener('click', () => {
    clearDeviceInfo(); // 저장된 값을 비워야 처음부터 다시 입력받는다
    clearResult();
    window.location.assign('../index.html');
  });
}
