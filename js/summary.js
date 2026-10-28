// summary.js
// - 기기 정보를 한 줄 요약 문장으로 만들어 화면에 그린다
// - collect.js와 result.js에 똑같은 코드가 두 벌 있어서 한 곳으로 모았다

// 저장된 값은 'document' 같은 영문 코드라서, 화면에 보여줄 한글 이름을 따로 둔다
const USAGE_LABELS = { document: '문서·웹', develop: '개발', video: '영상편집', game: '게임' };

export function renderSummary(device, elementId = 'device-summary') {
  const target = document.getElementById(elementId);
  if (!target) return;
  target.textContent = `${device.model} · ${device.purchaseYear}년 ${device.purchaseMonth}월 구입`
    + ` · 하루 ${device.dailyHours}시간 · ${USAGE_LABELS[device.usage] || device.usage}`;
}
