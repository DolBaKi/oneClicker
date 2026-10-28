// result.js
// - 분석 결과 화면의 화면 조작 담당 (점수 막대, 원시값 목록 그리기)
// - 점수 계산은 하지 않는다: 이미 collect.js에서 환산해 저장해둔 값을 꺼내 쓴다

import { loadResult, clearDeviceInfo, clearResult } from './store.js';

const USAGE_LABELS = { document: '문서·웹', develop: '개발', video: '영상편집', game: '게임' };

const ITEMS = [
  { key: 'compute', label: '연산 속도' },
  { key: 'graphics', label: '그래픽 성능' },
  { key: 'memory', label: '메모리 응답' },
];

// 점수대에 따라 막대 색을 고른다 (양호 / 주의 / 위험)
function barClass(score) {
  if (score >= 70) return '';
  return score >= 40 ? 'is-warn' : 'is-bad';
}

function renderSummary(device) {
  document.getElementById('device-summary').textContent = `${device.model} · ${device.purchaseYear}년 `
    + `${device.purchaseMonth}월 구입 · 하루 ${device.dailyHours}시간 · ${USAGE_LABELS[device.usage] || device.usage}`;
}

// 항목별 점수 막대. 측정하지 못한 항목은 '측정 불가'로 표시한다
function renderScores(scores) {
  document.getElementById('total-number').textContent = scores.total ?? '-';
  document.getElementById('score-list').innerHTML = ITEMS.map(({ key, label }) => {
    const score = scores[key];
    if (score === null || score === undefined) {
      return `<div class="score-row"><span class="score-label">${label}</span>
        <span class="score-label">측정 불가</span><span class="score-number">-</span></div>`;
    }
    return `<div class="score-row">
      <span class="score-label">${label}</span>
      <div class="score-bar">
        <div class="score-bar-fill ${barClass(score)}" style="width: ${score}%"></div>
      </div>
      <span class="score-number">${score}</span>
    </div>`;
  }).join('');
}

// 실제로 측정된 숫자. 값이 없으면 '지원 안 함'으로 둔다
function renderRaw(benchmark) {
  const rows = [
    ['연산 속도', benchmark.compute.ms, (v) => `${Math.round(v)} ms`],
    ['그래픽', benchmark.graphics.fps, (v) => `${v} fps`],
    ['메모리 응답', benchmark.memory.ms, (v) => `${Math.round(v)} ms`],
    ['CPU 코어 수', benchmark.device.cores, (v) => `${v}개`],
    ['메모리 용량', benchmark.device.memoryGB, (v) => `약 ${v} GB`],
  ];
  document.getElementById('raw-list').innerHTML = rows.map(([label, value, format]) =>
    `<dt>${label}</dt><dd>${value === null || value === undefined ? '지원 안 함' : format(value)}</dd>`
  ).join('');
}

const result = loadResult();
if (!result) {
  // 측정 없이 주소로 바로 들어온 경우
  window.location.replace('device.html');
} else {
  renderSummary(result.device);
  renderScores(result.scores);
  renderRaw(result.benchmark);
  document.getElementById('restart-button').addEventListener('click', () => {
    clearDeviceInfo(); // 저장된 값을 비워야 처음부터 다시 입력받는다
    clearResult();
    window.location.assign('../index.html');
  });
}
