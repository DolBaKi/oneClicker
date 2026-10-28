// collect.js
// - 성능 측정 화면의 화면 조작 담당 (진행 표시, 버튼 상태, 다음 화면 이동)
// - 측정은 benchmark.js, 환산은 scoring.js, 서버 저장은 supabase.js에 맡긴다

import { loadDeviceInfo, saveResult } from './store.js';
import { runBenchmark } from './benchmark.js';
import { scoreAll } from './scoring.js';
import { toRecord, insertMeasurement } from '../api/supabase.js';

// 저장된 값은 'document' 같은 영문 코드라서, 화면에 보여줄 한글 이름을 따로 둔다
const USAGE_LABELS = { document: '문서·웹', develop: '개발', video: '영상편집', game: '게임' };

// 진행 목록에 표시할 항목. benchmark.js가 알려주는 key와 이름이 같아야 한다
const STEPS = [
  { key: 'compute', label: '연산 속도' },
  { key: 'graphics', label: '그래픽 성능' },
  { key: 'memory', label: '메모리 응답' },
  { key: 'device', label: '기기 사양 확인' },
];

const startButton = document.getElementById('start-measure');
const resultButton = document.getElementById('result-button');
const errorBox = document.getElementById('measure-error');

// 기기 정보를 한 줄 요약으로 그린다
function renderSummary(data) {
  document.getElementById('device-summary').textContent = `${data.model} · ${data.purchaseYear}년 `
    + `${data.purchaseMonth}월 구입 · 하루 ${data.dailyHours}시간 · ${USAGE_LABELS[data.usage] || data.usage}`;
}

// 진행 목록을 처음 그린다 (전부 대기 상태)
function renderSteps() {
  document.getElementById('steplist').innerHTML = STEPS.map(
    (step) => `<li class="steplist-item" id="step-${step.key}">${step.label}</li>`).join('');
}

// 한 항목의 상태를 바꾼다. state: 'running' | 'done'
function setStepState(key, state) {
  const item = document.getElementById(`step-${key}`);
  if (!item) return;
  const { label } = STEPS.find((step) => step.key === key);
  item.className = `steplist-item ${state === 'done' ? 'is-done' : 'is-running'}`;
  item.textContent = state === 'done' ? `${label} 완료` : `${label} 측정 중...`;
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.classList.remove('hidden');
}

// [성능 측정 시작]: 측정 → 점수 환산 → 저장 → 결과 화면
async function handleStart() {
  errorBox.classList.add('hidden');
  resultButton.classList.add('hidden');
  startButton.disabled = true;
  startButton.textContent = '측정 중...';
  renderSteps(); // 다시 측정할 때를 대비해 진행 목록을 대기 상태로 되돌린다

  let benchmark;
  try {
    benchmark = await runBenchmark(setStepState);
  } catch (error) {
    console.error('성능 측정 실패:', error);
    showError('측정에 실패했습니다. 다른 프로그램을 닫고 다시 시도해 주세요');
    startButton.disabled = false;
    startButton.textContent = '다시 측정하기';
    return;
  }

  const scores = scoreAll(benchmark);
  saveResult({ device, benchmark, scores }); // 먼저 브라우저에 저장해 결과 화면을 볼 수 있게 한다

  try {
    await insertMeasurement(toRecord(device, benchmark, scores));
    window.location.href = 'result.html';
  } catch (error) {
    // 서버에 못 보내도 측정값 자체는 살아있으므로 결과는 볼 수 있게 해준다
    console.error(error);
    showError('측정은 끝났지만 서버에 저장하지 못했습니다. 인터넷 연결을 확인해 주세요');
    resultButton.classList.remove('hidden');
    startButton.disabled = false;
    startButton.textContent = '다시 측정하기';
  }
}

const device = loadDeviceInfo();
if (!device) {
  // 값 없이 주소로 바로 들어온 경우. replace를 쓰면 뒤로가기로 이 화면에 다시 갇히지 않는다
  window.location.replace('device.html');
} else {
  renderSummary(device);
  renderSteps();
  startButton.addEventListener('click', handleStart);
  resultButton.addEventListener('click', () => window.location.assign('result.html'));
  document.getElementById('back-button')
    .addEventListener('click', () => window.location.assign('device.html'));
}
