// collect.js
// - 성능 측정 화면의 흐름 제어 (측정 → 점수 환산 → 저장 → 결과 화면)
// - 진행 표시는 progress.js, 측정은 benchmark.js, 환산은 scoring.js, 저장은 supabase.js가 맡는다

import { loadDeviceInfo, saveResult } from './store.js';
import { runBenchmark } from './benchmark.js';
import { scoreAll } from './scoring.js';
import { renderSummary } from './summary.js';
import { startProgress, setStepState, setProgressText } from './progress.js';
import { toRecord, insertMeasurement } from '../api/supabase.js';

const startButton = document.getElementById('start-measure');
const resultButton = document.getElementById('result-button');
const errorBox = document.getElementById('measure-error');

function showError(message) {
  errorBox.textContent = message;
  errorBox.classList.remove('hidden');
}

// 버튼을 다시 누를 수 있는 상태로 되돌린다
function resetButton() {
  startButton.disabled = false;
  startButton.textContent = '다시 측정하기';
}

// [성능 측정 시작]: 측정 → 점수 환산 → 저장 → 결과 화면
async function handleStart() {
  errorBox.classList.add('hidden');
  resultButton.classList.add('hidden');
  startButton.disabled = true;
  startButton.textContent = '측정 중...';
  startProgress();

  let benchmark;
  try {
    benchmark = await runBenchmark(setStepState);
  } catch (error) {
    console.error('성능 측정 실패:', error);
    showError('측정에 실패했습니다. 다른 프로그램을 닫고 다시 시도해 주세요');
    setProgressText('측정이 중단되었습니다');
    resetButton();
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
    setProgressText('측정 완료 (서버 저장 실패)');
    resultButton.classList.remove('hidden');
    resetButton();
  }
}

const device = loadDeviceInfo();
if (!device) {
  // 값 없이 주소로 바로 들어온 경우. replace를 쓰면 뒤로가기로 이 화면에 다시 갇히지 않는다
  window.location.replace('device.html');
} else {
  renderSummary(device);
  startButton.addEventListener('click', handleStart);
  resultButton.addEventListener('click', () => window.location.assign('result.html'));
  document.getElementById('back-button')
    .addEventListener('click', () => window.location.assign('device.html'));
}
