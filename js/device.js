// device.js
// - 기기 정보 화면의 화면 조작 담당 (값 읽기, 에러 표시, 다음 화면 이동)
// - 검증은 validate.js에 맡긴다: 화면 코드와 규칙 코드를 섞지 않아야 규칙이 바뀌어도 화면 코드를 안 고친다

import { validateDeviceForm } from './validate.js';
import { saveDeviceInfo } from './store.js';

// 검증 결과의 항목 이름 -> 화면 요소 id 묶음 (에러 표시와 포커스에 같이 쓴다)
const FIELDS = {
  model: { box: 'field-model', msg: 'error-model', focus: 'model' },
  purchase: { box: 'field-purchase', msg: 'error-purchase', focus: 'purchase-year' },
  dailyHours: { box: 'field-hours', msg: 'error-dailyHours', focus: 'daily-hours' },
  usage: { box: 'field-usage', msg: 'error-usage', focus: 'usage-document' },
};

// 화면에 보이는 순서. "첫 번째 실패 칸"을 찾을 때 이 순서를 기준으로 한다
const FIELD_ORDER = ['model', 'purchase', 'dailyHours', 'usage'];

// 연도 select를 올해부터 10년 전까지 채운다 (해가 바뀌어도 코드를 고칠 필요가 없다)
function fillYearOptions() {
  const select = document.getElementById('purchase-year');
  const thisYear = new Date().getFullYear();
  for (let year = thisYear; year >= thisYear - 10; year--) {
    const option = document.createElement('option');
    option.value = String(year);
    option.textContent = `${year}년`;
    select.appendChild(option);
  }
}

// 화면에 입력된 값을 하나의 객체로 모은다
function readForm() {
  const checkedUsage = document.querySelector('input[name="usage"]:checked');
  return {
    model: document.getElementById('model').value,
    purchaseYear: document.getElementById('purchase-year').value,
    purchaseMonth: document.getElementById('purchase-month').value,
    dailyHours: document.getElementById('daily-hours').value,
    usage: checkedUsage ? checkedUsage.value : '',
  };
}

// 특정 칸의 에러 표시를 지운다
function clearFieldError(key) {
  document.getElementById(FIELDS[key].box).classList.remove('is-error');
  document.getElementById(FIELDS[key].msg).textContent = '';
}

// 검증 결과를 화면에 그린다 (실패한 칸은 표시, 통과한 칸은 해제)
function showErrors(errors) {
  FIELD_ORDER.forEach((key) => {
    if (errors[key]) {
      document.getElementById(FIELDS[key].box).classList.add('is-error');
      document.getElementById(FIELDS[key].msg).textContent = errors[key];
    } else {
      clearFieldError(key);
    }
  });
}

// 첫 번째로 실패한 칸까지 스크롤하고 커서를 놓는다
function focusFirstError(errors) {
  const firstKey = FIELD_ORDER.find((key) => errors[key]);
  if (!firstKey) return;
  const target = document.getElementById(FIELDS[firstKey].focus);
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  target.focus({ preventScroll: true }); // 스크롤은 위에서 이미 했으므로 중복 이동을 막는다
}

// 다시 입력을 시작하면 그 칸의 에러를 즉시 없앤다
function bindLiveClear() {
  document.getElementById('model').addEventListener('input', () => clearFieldError('model'));
  document.getElementById('daily-hours').addEventListener('input', () => clearFieldError('dailyHours'));
  ['purchase-year', 'purchase-month'].forEach((id) =>
    document.getElementById(id).addEventListener('change', () => clearFieldError('purchase')));
  document.querySelectorAll('input[name="usage"]').forEach((radio) =>
    radio.addEventListener('change', () => clearFieldError('usage')));
}

// [다음 단계로]를 눌렀을 때: 검증 -> 실패면 표시, 통과면 저장 후 이동
function handleNext(event) {
  event.preventDefault(); // 폼의 기본 동작(새로고침)을 막는다
  const values = readForm();
  const { valid, errors } = validateDeviceForm(values);
  showErrors(errors);
  if (!valid) {
    focusFirstError(errors);
    return;
  }
  values.dailyHours = Number(values.dailyHours); // 저장할 때는 문자열이 아닌 숫자로 통일
  if (saveDeviceInfo(values)) {
    window.location.href = 'collect.html';
  } else {
    alert('기기 정보를 저장하지 못했습니다. 브라우저의 저장 기능이 꺼져 있는지 확인해 주세요');
  }
}

fillYearOptions();
bindLiveClear();
document.getElementById('device-form').addEventListener('submit', handleNext);
