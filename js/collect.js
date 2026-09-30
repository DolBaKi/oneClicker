// collect.js
// - 성능 측정 화면의 화면 조작 담당 (진행 표시, 슬라이더, 버튼 상태)
// - 측정은 benchmark.js에 맡긴다: 화면 코드와 측정 코드를 섞지 않아야 한쪽만 고칠 수 있다

import { loadDeviceInfo, saveResult } from './store.js';
import { runBenchmark } from './benchmark.js';

// 저장된 값은 'document' 같은 영문 코드라서, 화면에 보여줄 한글 이름을 따로 둔다
const USAGE_LABELS = { document: '문서·웹', develop: '개발', video: '영상편집', game: '게임' };

// 진행 목록에 표시할 항목. benchmark.js가 알려주는 key와 이름이 같아야 한다
const STEPS = [
  { key: 'compute', label: '연산 속도' },
  { key: 'graphics', label: '그래픽 성능' },
  { key: 'memory', label: '메모리 응답' },
  { key: 'device', label: '기기 사양 확인' },
];
const SLIDERS = ['heat', 'noise', 'boot', 'launch'];

const startButton = document.getElementById('start-measure');
const analyzeButton = document.getElementById('analyze-button');
const errorBox = document.getElementById('measure-error');
let benchmarkResult = null;

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

// 슬라이더를 움직이면 옆 숫자를 같이 바꾼다
function bindSliders() {
  SLIDERS.forEach((name) => document.getElementById(name).addEventListener('input', (event) => {
    document.getElementById(`${name}-value`).textContent = `${event.target.value}단계`;
  }));
}

// 슬라이더 4개 값을 { heat, noise, boot, launch } 형태로 모은다
function readSubjective() {
  return Object.fromEntries(
    SLIDERS.map((name) => [name, Number(document.getElementById(name).value)]));
}

// [성능 측정 시작]: 측정 중에는 버튼을 잠그고, 끝나면 체감 평가를 연다
async function handleStart() {
  errorBox.classList.add('hidden');
  startButton.disabled = true;
  startButton.textContent = '측정 중...';
  renderSteps(); // 다시 측정할 때를 대비해 진행 목록을 대기 상태로 되돌린다
  try {
    benchmarkResult = await runBenchmark(setStepState);
    document.getElementById('subjective').classList.remove('hidden');
    analyzeButton.disabled = false;
    startButton.textContent = '다시 측정하기';
  } catch (error) {
    console.error('성능 측정 실패:', error);
    errorBox.textContent = '측정에 실패했습니다. 다른 프로그램을 닫고 다시 시도해 주세요';
    errorBox.classList.remove('hidden');
  } finally {
    startButton.disabled = false; // 실패해도 다시 시도할 수 있어야 한다
    startButton.textContent = '다시 측정하기';
  }
}

// [분석하기]: 기기 정보 + 실측 + 체감 평가를 한 덩어리로 저장한다
function handleAnalyze() {
  const saved = saveResult({ device, benchmark: benchmarkResult, subjective: readSubjective() });
  if (!saved) return alert('결과를 저장하지 못했습니다. 브라우저의 저장 기능을 확인해 주세요');
  // TODO: 4차시 - result.html(분석 결과 화면)을 만들고 여기서 이동시킬 예정
  alert('측정 결과를 저장했습니다. 분석 화면은 4차시에 연결됩니다');
}

const device = loadDeviceInfo();
if (!device) {
  // 값 없이 주소로 바로 들어온 경우. replace를 쓰면 뒤로가기로 이 화면에 다시 갇히지 않는다
  window.location.replace('device.html');
} else {
  renderSummary(device);
  renderSteps();
  bindSliders();
  startButton.addEventListener('click', handleStart);
  analyzeButton.addEventListener('click', handleAnalyze);
  document.getElementById('back-button')
    .addEventListener('click', () => window.location.assign('device.html'));
}
