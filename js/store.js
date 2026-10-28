// store.js
// - 화면과 화면 사이로 기기 정보를 넘겨주는 저장소 (지금은 브라우저 sessionStorage 사용)
// - 6차시에 Supabase로 옮길 때 이 파일만 고치면 다른 파일은 그대로 두어도 된다

// 키 이름을 여기 한 곳에서만 관리한다 (여러 파일에 흩어지면 오타로 값을 못 찾는다)
const STORAGE_KEY = 'oneclicker.device';
const RESULT_KEY = 'oneclicker.result';

/*
  기기 정보를 저장한다.
  data: { model, purchaseYear, purchaseMonth, dailyHours, usage }
  반환: 저장 성공 여부(true/false)
*/
export function saveDeviceInfo(data) {
  try {
    // 객체는 그대로 저장할 수 없으므로 JSON 문자열로 바꿔서 넣는다
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (error) {
    // 시크릿 모드 등에서 저장이 막힐 수 있어 오류를 삼키지 않고 기록만 남긴다
    console.error('기기 정보 저장 실패:', error);
    return false;
  }
}

// 저장된 기기 정보를 불러온다. 없거나 깨졌으면 null을 돌려준다.
export function loadDeviceInfo() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    console.error('기기 정보 불러오기 실패:', error);
    return null;
  }
}

// 저장된 기기 정보를 지운다 (처음부터 다시 진단할 때 사용)
export function clearDeviceInfo() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    return true;
  } catch (error) {
    console.error('기기 정보 삭제 실패:', error);
    return false;
  }
}

/*
  기기 정보 + 실측 원시값 + 환산 점수를 한 덩어리로 저장한다.
  result: { device, benchmark, scores }

  원시값(benchmark)과 점수(scores)를 함께 들고 있는 이유:
  점수 환산 기준은 앞으로 바뀔 수 있는데, 원시값을 버리면 다시 계산할 수가 없다.
*/
export function saveResult(result) {
  try {
    const record = { ...result, measuredAt: new Date().toISOString() };
    sessionStorage.setItem(RESULT_KEY, JSON.stringify(record));
    return true;
  } catch (error) {
    console.error('측정 결과 저장 실패:', error);
    return false;
  }
}

// 저장된 측정 결과를 불러온다. 없거나 깨졌으면 null
export function loadResult() {
  try {
    const raw = sessionStorage.getItem(RESULT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    console.error('측정 결과 불러오기 실패:', error);
    return null;
  }
}

// 저장된 측정 결과를 지운다
export function clearResult() {
  try {
    sessionStorage.removeItem(RESULT_KEY);
    return true;
  } catch (error) {
    console.error('측정 결과 삭제 실패:', error);
    return false;
  }
}
