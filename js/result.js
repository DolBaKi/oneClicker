// result.js
// - 측정 결과 화면의 화면 조작 담당
// - 점수는 보여주지 않는다. 잰 지표를 그대로 늘어놓고 뜻풀이만 덧붙인다
//   (점수로 바꾸는 기준은 여러 기기의 실제 분포가 쌓여야 정할 수 있다)

import { loadResult, clearDeviceInfo, clearResult } from './store.js';
import { renderSummary } from './summary.js';
import { stressChart } from './chart.js';
import { stabilityNote } from './stability.js';
import { renderMetrics, throttleSummary } from './result-metrics.js';
import { usageMonths } from './lifespan.js';

// 지속 부하 그래프와 설명. 그래프를 못 그리면 그 자리에 이유를 적는다
function renderStress(result) {
  const svg = stressChart(result.stress);
  document.getElementById('stress-chart').innerHTML = svg
    || `<p class="metric-none">${result.stress?.reason ?? '그래픽 부하를 측정하지 못했습니다'}</p>`;

  document.getElementById('stress-note').textContent = stabilityNote(result.stress);
  const extra = throttleSummary(result.stress);
  if (extra) document.getElementById('throttle-detail').textContent = extra;

  if (result.interrupted) {
    document.getElementById('interrupted-note').classList.remove('hidden');
  }
}

const result = loadResult();
if (!result) {
  // 측정 없이 주소로 바로 들어온 경우
  window.location.replace('device.html');
} else {
  renderSummary(result.device);
  const months = usageMonths(result.device.purchaseYear, result.device.purchaseMonth);
  document.getElementById('usage-period').textContent =
    `${(months / 12).toFixed(1)}년 사용 중 (${months}개월)`;

  renderStress(result);
  renderMetrics(result);

  document.getElementById('restart-button').addEventListener('click', () => {
    clearDeviceInfo(); // 저장된 값을 비워야 처음부터 다시 입력받는다
    clearResult();
    window.location.assign('../index.html');
  });
}
