// collect.js
// - 데이터 수집 화면(2단계)의 화면 조작 담당
// - 이전 화면에서 저장한 기기 정보를 불러와 요약으로 보여주고, 값이 없으면 되돌려 보낸다

import { loadDeviceInfo } from './store.js';

// 저장된 값은 'document' 같은 영문 코드라서, 화면에 보여줄 한글 이름을 따로 둔다
const USAGE_LABELS = {
  document: '문서·웹',
  develop: '개발',
  video: '영상편집',
  game: '게임',
};

// 기기 정보를 한 줄 요약으로 그린다
function renderSummary(data) {
  const usageLabel = USAGE_LABELS[data.usage] || data.usage;
  document.getElementById('device-summary').textContent =
    `${data.model} · ${data.purchaseYear}년 ${data.purchaseMonth}월 구입 · 하루 ${data.dailyHours}시간 · ${usageLabel}`;
}

const device = loadDeviceInfo();

if (!device) {
  // 값 없이 주소로 바로 들어온 경우. replace를 쓰면 뒤로가기로 이 화면에 다시 갇히지 않는다
  window.location.replace('device.html');
} else {
  renderSummary(device);
}

// TODO: 4차시 - "시스템 수치"와 "체감 평가" 입력칸을 이 화면에 추가할 예정
