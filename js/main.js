// main.js
// - 랜딩 화면(index.html) 전용 스크립트
// - 지금은 [진단 시작하기] 버튼을 누르면 device.html로 이동시키는 기능만 있음

const startButton = document.getElementById('start-button');

startButton.addEventListener('click', () => {
  window.location.href = 'pages/device.html';
});
