// result.js
// - 측정 결과 화면의 화면 조작 담당
// - 점수는 보여주지 않는다. 잰 지표를 그대로 늘어놓고 뜻풀이만 덧붙인다
//   (점수로 바꾸는 기준은 여러 기기의 실제 분포가 쌓여야 정할 수 있다)

import { loadResult, clearDeviceInfo, clearResult } from './store.js';
import { renderSummary } from './summary.js';
import { stressChart } from './chart.js';
import { stabilityNote } from './stability.js';
import { renderMetrics, throttleSummary } from './result-metrics.js';
import { getMetricAverages, getMetricPercentiles } from './stats.js';
import { usageMonths } from './lifespan.js';
import { captureResult, download } from './capture.js';
import { renderSpecCompare } from './spec-compare.js';
import { renderSummary as renderResultSummary } from './result-summary.js';

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

  renderResultSummary(result); // 종합 점수·순위·연식 비교. Supabase를 받아 뒤에서 채운다
  renderSpecCompare(result); // 모델 목록을 받아야 해서 기다리지 않고 따로 채운다
  renderStress(result);
  renderMetrics(result); // 먼저 값만 그린다
  /*
    쌓인 기록과 비교해 지표마다 "상위 X%"(백분위, migration-006)를 덧그린다.
    백분위가 없으면 평균(migration-004)으로, 둘 다 없으면 값만 보여준다.
    속도가 빠른 기기는 발열로 꺾여도 이 순위가 제대로 높게 나와, 종합 점수(안정성)만으로는
    생기던 오해("좋은 GPU인데 지표가 낮다")를 바로잡는다.
  */
  const myMetrics = {
    compute_ms: result.benchmark?.compute?.ms ?? null,
    memory_ms: result.benchmark?.memory?.ms ?? null,
    peak_throughput: result.stress?.peak ?? null,
    sustained_throughput: result.stress?.sustained ?? null,
    retention: result.stress?.retention ?? null,
    parallel_speedup: result.parallel?.supported ? result.parallel.speedup : null,
    parallel_efficiency: result.parallel?.supported ? result.parallel.efficiency : null,
  };
  Promise.all([getMetricAverages(), getMetricPercentiles(myMetrics)]).then(([averages, percentiles]) => {
    if (averages || percentiles) renderMetrics(result, averages, percentiles);
  });

  // 결과를 그림 파일로 저장. 화면을 찍는 게 아니라 측정값으로 새로 그린다
  const captureButton = document.getElementById('capture-button');
  captureButton.addEventListener('click', async () => {
    captureButton.disabled = true;
    captureButton.textContent = '이미지 만드는 중...';
    try {
      const today = new Date().toISOString().slice(0, 10);
      await download(await captureResult(result), `노트북-성능측정-${today}.png`);
    } catch (error) {
      console.error('캡처 실패:', error);
      const box = document.getElementById('capture-error');
      box.textContent = '이미지를 저장하지 못했습니다. 브라우저를 바꿔 다시 시도해 주세요';
      box.classList.remove('hidden');
    } finally {
      captureButton.disabled = false;
      captureButton.textContent = '캡처하기';
    }
  });

  document.getElementById('restart-button').addEventListener('click', () => {
    clearDeviceInfo(); // 저장된 값을 비워야 처음부터 다시 입력받는다
    clearResult();
    window.location.assign('../index.html');
  });
}
