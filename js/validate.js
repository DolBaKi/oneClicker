// validate.js
// - 입력값이 규칙에 맞는지만 판단하는 파일 (검증 전용)
// - 화면(DOM)을 전혀 건드리지 않는 이유: 규칙과 화면을 분리해 두면 화면이 바뀌어도 규칙은 그대로 쓸 수 있다

// 모델명: 2자 이상
export function checkModel(model) {
  if (String(model).trim().length < 2) return '모델명을 2자 이상 입력해 주세요';
  return null;
}

// 구입 연월: 둘 다 선택되어야 하고, 오늘보다 미래일 수 없다
export function checkPurchase(year, month) {
  if (!year || !month) return '구입 연도와 월을 모두 선택해 주세요';

  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth() + 1; // getMonth()는 0부터 시작하므로 1을 더한다
  const y = Number(year);
  const m = Number(month);

  if (y > thisYear || (y === thisYear && m > thisMonth)) {
    return '구입 연월을 오늘 이전 날짜로 선택해 주세요';
  }
  return null;
}

// 하루 평균 사용 시간: 0 초과 24 이하
export function checkDailyHours(hours) {
  const n = Number(hours);
  if (String(hours).trim() === '' || Number.isNaN(n)) {
    return '하루 평균 사용 시간을 숫자로 입력해 주세요';
  }
  if (n <= 0 || n > 24) {
    return '하루 평균 사용 시간을 0보다 크고 24 이하로 입력해 주세요';
  }
  return null;
}

// 주 사용 용도: 하나는 반드시 선택
export function checkUsage(usage) {
  if (!usage) return '주 사용 용도를 하나 선택해 주세요';
  return null;
}

/*
  폼 전체를 한 번에 검사한다.
  values: { model, purchaseYear, purchaseMonth, dailyHours, usage }
  반환:   { valid: true/false, errors: { 실패한 항목: 안내 문구 } }
*/
export function validateDeviceForm(values) {
  const errors = {};

  const modelError = checkModel(values.model);
  if (modelError) errors.model = modelError;

  const purchaseError = checkPurchase(values.purchaseYear, values.purchaseMonth);
  if (purchaseError) errors.purchase = purchaseError;

  const hoursError = checkDailyHours(values.dailyHours);
  if (hoursError) errors.dailyHours = hoursError;

  const usageError = checkUsage(values.usage);
  if (usageError) errors.usage = usageError;

  return { valid: Object.keys(errors).length === 0, errors };
}
