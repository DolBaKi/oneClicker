// result.js
// - 분석 결과 화면의 화면 조작 담당 (점수 막대, 그래프, 원시값 목록)
// - 점수 계산은 하지 않는다: collect.js에서 환산해 저장해둔 값을 꺼내 쓴다

import { loadResult, clearDeviceInfo, clearResult } from './store.js';
import { renderSummary } from './summary.js';
import { stressChart } from './chart.js';
import { stabilityNote } from './stability.js';
import { renderScores } from './result-scores.js';
import { renderComparison } from './compare.js';

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

const result = loadResult();
if (!result) {
  window.location.replace('device.html');
} else {
  renderSummary(result.device);
  renderScores(result.scores);
  renderStress(result);
  renderRaw(result);
  // 다른 기기 기록과의 비교는 네트워크를 타므로 화면을 먼저 띄우고 나중에 채운다
  renderComparison(result);
  document.getElementById('restart-button').addEventListener('click', () => {
    clearDeviceInfo(); // 저장된 값을 비워야 처음부터 다시 입력받는다
    clearResult();
    window.location.assign('../index.html');
  });
}
