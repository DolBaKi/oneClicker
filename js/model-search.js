// model-search.js
// - 기기 정보 화면의 "모델명" 칸을 검색 + 자동완성 칸으로 만든다
// - 검색·사양 대조 규칙은 models.js에 있고, 이 파일은 화면 조작만 한다
//
// 피드백 반영:
//   엄기찬 - 직접 입력 대신 자동으로   → 이 노트북의 그래픽 칩·스레드를 읽어 맞는 모델을 위로 올리고 "사양 일치" 표시
//   이재훈 - 정확한 모델명으로 비교    → 목록에서 고르면 그 모델의 표준 사양을 결과 화면에서 대조
//   최세민 - 어디서 확인하는지 도움말  → 물음표 버튼으로 운영체제별 확인 방법과 복사용 명령어
//   우민석 - 사진으로 판단             → 외관은 같은 시리즈끼리 똑같아 구분이 어렵다. 바닥 라벨의 코드를
//                                        쳐도 찾아지게 했다 (라벨 사진 글자 인식은 다음 단계)

import {
  loadModels, searchModels, matchHardware, detectForMatching, describeDetected, shortGpuName,
} from './models.js';

const input = document.getElementById('model');
const list = document.getElementById('model-options');
const detectedLine = document.getElementById('model-detected');
const statusLine = document.getElementById('model-status');

let models = [];
let detected = null;
let results = [];
let activeIndex = -1;
let selected = null; // 목록에서 고른 모델. 직접 친 이름이면 null

/* 목록 열기·닫기 ------------------------------------------------------------- */

function closeList() {
  list.hidden = true;
  input.setAttribute('aria-expanded', 'false');
  input.removeAttribute('aria-activedescendant');
  activeIndex = -1;
}

const BADGES = {
  match: '<span class="badge badge--ok">사양 일치</span>',
  mismatch: '<span class="badge badge--warn">사양 다름</span>',
  unknown: '',
};

// 모델명에 들어갈 수 있는 <, & 같은 글자가 태그로 해석되지 않게 바꾼다
const escapeHtml = (text) => String(text).replace(/[&<>"]/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function detailText(model) {
  const cpu = model.cpus.length > 1 ? `${model.cpus[0]} 외 ${model.cpus.length - 1}개` : model.cpus[0];
  const threads = model.threads.length ? `${model.threads.join('·')}스레드` : null;
  return [model.year ? `${model.year}년 출시` : null, cpu, threads].filter(Boolean).join(' · ');
}

function renderList() {
  if (!input.value.trim()) { closeList(); return; }

  if (!results.length) {
    list.innerHTML = `<li class="combo-empty">목록에서 찾지 못했어요.
      입력한 이름 그대로 진행할 수 있어요. (물음표를 누르면 모델명 찾는 법이 나와요)</li>`;
  } else {
    list.innerHTML = results.map(({ model, hw }, i) => `
      <li class="combo-option${i === activeIndex ? ' is-active' : ''}" role="option"
          id="model-option-${i}" data-index="${i}" aria-selected="${i === activeIndex}">
        <span class="combo-name">${escapeHtml(model.name)} ${BADGES[hw.status]}</span>
        <span class="combo-detail">${escapeHtml(detailText(model))}</span>
      </li>`).join('');
  }
  list.hidden = false;
  input.setAttribute('aria-expanded', 'true');
  if (activeIndex >= 0) input.setAttribute('aria-activedescendant', `model-option-${activeIndex}`);
}

/* 선택 결과 안내 ------------------------------------------------------------- */

function showStatus(text, tone) {
  statusLine.textContent = text;
  statusLine.className = `model-note${tone ? ` model-note--${tone}` : ''}`;
  statusLine.hidden = !text;
}

function explainSelection({ model, hw }) {
  if (hw.status === 'match') {
    const gpu = model.gpus.find((g) => detected.gpuNames.some((n) => n.includes(g)));
    showStatus(`이 노트북에서 읽은 그래픽 칩(${shortGpuName(gpu)})이 목록의 사양과 맞습니다.`, 'ok');
  } else if (hw.status === 'mismatch') {
    const reasons = [];
    if (hw.threads === false) {
      reasons.push(`코어/스레드 - 목록 ${model.threads.join('·')}스레드 / 이 노트북 ${detected.threads}코어`);
    }
    if (hw.gpu === false) reasons.push('그래픽 칩 또는 CPU 제조사가 다름');
    showStatus(`이 노트북에서 읽은 사양과 다릅니다 (${reasons.join(', ')}). `
      + '같은 이름의 다른 모델일 수 있으니 물음표를 눌러 정확한 모델명을 확인해 보세요.', 'warn');
  } else {
    showStatus('목록에 그래픽 정보가 없어 이 노트북과 사양을 대조하지 못했습니다. 그대로 진행해도 됩니다.', '');
  }
}

function choose(index) {
  const picked = results[index];
  if (!picked) return;
  selected = picked;
  input.value = picked.model.name;
  closeList();
  explainSelection(picked);
}

/* 입력 처리 ----------------------------------------------------------------- */

function update() {
  selected = null; // 글자를 고치면 고른 모델은 풀린다 (이름과 선택이 어긋나지 않게)
  showStatus('', '');
  // 20개까지 보여 준다. "맥북"처럼 넓게 치면 최신만 몇 개 뜨고 구형이 안 보이던 문제를 줄인다.
  // 목록(.combo-list)은 max-height로 스크롤되므로 개수가 많아도 화면을 넘지 않는다.
  results = searchModels(models, input.value, detected, 20);
  activeIndex = -1;
  renderList();
}

function handleKeys(event) {
  if (list.hidden) return;
  const count = results.length;
  if (event.key === 'ArrowDown' && count) {
    event.preventDefault();
    activeIndex = (activeIndex + 1) % count;
    renderList();
  } else if (event.key === 'ArrowUp' && count) {
    event.preventDefault();
    activeIndex = (activeIndex - 1 + count) % count;
    renderList();
  } else if (event.key === 'Enter' && activeIndex >= 0) {
    event.preventDefault(); // 목록이 열려 있을 때 엔터는 "다음 단계"가 아니라 "선택"이다
    choose(activeIndex);
  } else if (event.key === 'Escape') {
    closeList();
  }
}

// 목록 밖으로 나갔는데 고르지 않았다면, 직접 친 이름으로 진행한다는 걸 알려 준다
function handleBlur() {
  // 목록을 클릭하는 순간에도 blur가 먼저 일어나서, 클릭이 처리될 틈을 준다
  setTimeout(() => {
    closeList();
    if (!selected && input.value.trim().length >= 2) {
      showStatus('목록에서 고르지 않았습니다. 그대로 진행할 수 있지만, 결과 화면에서 '
        + '이 모델의 표준 사양과 비교하는 부분은 빠집니다.', '');
    }
  }, 150);
}

/* 도움말 ------------------------------------------------------------------- */

// 운영체제에 맞는 안내를 먼저 펼쳐 둔다. 못 알아내면 모두 접어 둔다
function openHelpForThisOs() {
  const platform = (navigator.userAgentData?.platform || navigator.userAgent).toLowerCase();
  const os = platform.includes('mac') ? 'mac' : platform.includes('win') ? 'windows' : null;
  if (os) document.querySelector(`[data-os="${os}"]`)?.setAttribute('open', '');
}

function bindHelp() {
  const toggle = document.getElementById('model-help-toggle');
  const panel = document.getElementById('model-help');
  toggle.addEventListener('click', () => {
    const open = panel.hidden;
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
  });

  document.querySelectorAll('[data-copy]').forEach((button) => {
    button.addEventListener('click', async () => {
      const text = document.getElementById(button.dataset.copy).textContent;
      try {
        await navigator.clipboard.writeText(text);
        button.textContent = '복사됨';
      } catch {
        // 클립보드 권한이 없으면 글자를 선택해 두고 직접 복사하게 한다
        window.getSelection().selectAllChildren(document.getElementById(button.dataset.copy));
        button.textContent = 'Ctrl+C로 복사';
      }
      setTimeout(() => { button.textContent = '복사'; }, 2000);
    });
  });
  openHelpForThisOs();
}

/* 시작 --------------------------------------------------------------------- */

// 다음 단계로 넘어갈 때 device.js가 부른다. 직접 친 이름이면 id 없이 이름만 간다
export function selectedModel() {
  return {
    modelId: selected?.model.id ?? null,
    modelMatch: selected?.hw.status ?? null,
    detected,
  };
}

// 이전 화면에서 돌아왔을 때, 전에 고른 모델을 다시 선택된 상태로 만든다
export async function restoreSelection(modelId) {
  if (!modelId) return;
  await ready;
  const model = models.find((m) => m.id === modelId);
  if (!model) return;
  results = [{ model, hw: matchHardware(model, detected) }];
  choose(0);
}

// "감지한 사양" 줄을 현재 detected 값으로 다시 그린다
function renderDetectedLine(measuredNote) {
  const text = describeDetected(detected);
  if (!text) return;
  detectedLine.textContent = `이 노트북에서 읽은 사양: ${text}${measuredNote || ''}. `
    + '이 사양과 맞는 모델에는 "사양 일치"가 붙습니다.';
  detectedLine.hidden = false;
}

async function init() {
  [models, detected] = await Promise.all([loadModels(), detectForMatching()]);
  renderDetectedLine(); // 먼저 브라우저가 준 값으로 바로 보여 준다
  if (!models.length) {
    showStatus('모델 목록을 불러오지 못했습니다. 모델명을 직접 입력해 주세요.', '');
  }
  if (document.activeElement === input && input.value.trim() && !selected) update();
}

input.setAttribute('role', 'combobox');
input.setAttribute('aria-autocomplete', 'list');
input.setAttribute('aria-expanded', 'false');
input.setAttribute('aria-controls', 'model-options');
input.addEventListener('input', update);
input.addEventListener('keydown', handleKeys);
input.addEventListener('blur', handleBlur);
// mousedown을 쓰는 이유: click은 blur보다 늦게 와서 목록이 먼저 닫혀 버릴 수 있다
list.addEventListener('mousedown', (event) => {
  const option = event.target.closest('.combo-option');
  if (!option) return;
  event.preventDefault();
  choose(Number(option.dataset.index));
});
bindHelp();
const ready = init();
