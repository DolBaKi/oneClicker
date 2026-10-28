// progress.js
// - 성능 측정 진행 상황을 화면에 그리는 파일 (진행률 막대, 퍼센트, 항목별 상태)
// - collect.js에서 떼어낸 이유: 흐름 제어와 화면 그리기를 한 파일에 두니 너무 커졌다

/*
  진행 목록에 표시할 항목. benchmark.js가 알려주는 key와 똑같아야 한다.
  예상 시간(seconds)을 미리 보여주는 이유: 전체가 25초 안팎이라 아무 안내 없이 기다리면
  멈춘 줄 알고 창을 닫는다. 어느 단계가 오래 걸리는지 알면 기다릴 수 있다.
*/
export const STEPS = [
  { key: 'compute', label: '연산 속도 (단일)', seconds: 1 },
  { key: 'parallel', label: '연산 속도 (병렬)', seconds: 2 },
  { key: 'graphics', label: '그래픽 최고 속도', seconds: 2 },
  { key: 'memory', label: '메모리 응답', seconds: 1 },
  { key: 'stress', label: '그래픽 지속 부하', seconds: 15 },
  { key: 'hardware', label: '기기 사양 확인', seconds: 1 },
];

let doneCount = 0; // 끝난 항목 수. 진행률 막대를 얼마나 채울지 정하는 데 쓴다

// 막대 길이와 퍼센트 문구를 끝난 항목 수에 맞춰 다시 그린다
function updateProgress() {
  const percent = Math.round((doneCount / STEPS.length) * 100);
  document.getElementById('progress-fill').style.width = `${percent}%`;
  document.getElementById('progress-text').textContent =
    doneCount === STEPS.length ? '측정 완료 · 결과를 저장하는 중...' : `측정 중... ${percent}%`;
}

// 진행 영역을 펼치고 목록을 전부 대기 상태로 되돌린다 (다시 측정할 때도 이걸 부른다)
export function startProgress() {
  doneCount = 0;
  document.getElementById('progress-area').classList.remove('hidden');
  document.getElementById('steplist').innerHTML = STEPS.map((step) =>
    `<li class="steplist-item" id="step-${step.key}">
      <span class="steplist-mark"></span>
      <span class="steplist-label">${step.label}</span>
      <span class="steplist-time">약 ${step.seconds}초</span>
    </li>`).join('');
  updateProgress();
}

// 한 항목의 상태를 바꾼다. state: 'running' | 'done', elapsedMs: 실제로 걸린 시간
export function setStepState(key, state, elapsedMs) {
  const item = document.getElementById(`step-${key}`);
  if (!item) return;
  const step = STEPS.find((s) => s.key === key);
  item.className = `steplist-item ${state === 'done' ? 'is-done' : 'is-running'}`;
  item.querySelector('.steplist-time').textContent =
    state === 'done' ? `${elapsedMs}ms` : `측정 중... (약 ${step.seconds}초)`;
  if (state === 'done') doneCount += 1;
  updateProgress();
}

// 오래 걸리는 단계(지속 부하) 안에서의 세부 진행률을 문구에 덧붙인다
export function setSubProgress(key, ratio) {
  const item = document.getElementById(`step-${key}`);
  if (!item || !item.classList.contains('is-running')) return;
  item.querySelector('.steplist-time').textContent = `측정 중... ${Math.round(ratio * 100)}%`;
}

// 측정이 끝난 뒤 안내 문구만 바꾸고 싶을 때 쓴다
export function setProgressText(text) {
  document.getElementById('progress-text').textContent = text;
}
