// store.js
// - 화면과 화면 사이로 기기 정보를 넘겨주는 저장소 (지금은 브라우저 sessionStorage 사용)
// - 6차시에 Supabase로 옮길 때 이 파일만 고치면 다른 파일은 그대로 두어도 된다

// 키 이름을 여기 한 곳에서만 관리한다 (여러 파일에 흩어지면 오타로 값을 못 찾는다)
const STORAGE_KEY = 'oneclicker.device';

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
