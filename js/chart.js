// chart.js
// - 지속 부하 시계열을 SVG 꺾은선으로 그린다 (그리기만, 판단은 하지 않는다)
// - 차트 라이브러리를 쓰지 않는 이유: 빌드 도구 없이 브라우저가 바로 읽는 파일만 쓰기로 했다

const W = 600;   // 좌표계 너비. viewBox를 쓰므로 실제 화면 크기와는 무관하다
const H = 180;
const PAD = { left: 8, right: 8, top: 14, bottom: 20 };

const esc = (text) => String(text).replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/*
  시계열을 SVG 문자열로 만든다.
  y축은 0부터 시작한다. 중간부터 시작하면 작은 흔들림이 절벽처럼 보여서,
  멀쩡한 기기도 성능이 폭락한 것처럼 읽히기 때문이다.
*/
export function stressChart(stress) {
  if (!stress?.supported || !stress.samples?.length) return '';

  const { samples, peak, throttleAt } = stress;
  const lastT = samples[samples.length - 1].t || 1;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const x = (t) => PAD.left + (t / lastT) * innerW;
  // peak에 여유(1.1배)를 두는 이유: 그러지 않으면 최고선이 상자 맨 위에 딱 붙어
  // 테두리에 가려지고, 그 위에 쓰는 "최고 ..." 글씨가 그래프 밖으로 삐져나간다
  const y = (value) => PAD.top + innerH - (value / (peak * 1.1)) * innerH;

  const points = samples.map((s) => `${x(s.t).toFixed(1)},${y(s.throughput).toFixed(1)}`).join(' ');
  const peakY = y(peak).toFixed(1);

  // 성능이 꺾인 지점에 세로선을 긋는다
  const throttleMark = throttleAt === null ? '' : `
    <line class="chart-throttle" x1="${x(throttleAt).toFixed(1)}" y1="${PAD.top}"
          x2="${x(throttleAt).toFixed(1)}" y2="${PAD.top + innerH}" />
    <text class="chart-tick" x="${(x(throttleAt) + 4).toFixed(1)}" y="${PAD.top + 10}">
      ${(throttleAt / 1000).toFixed(1)}초</text>`;

  return `
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img"
         aria-label="시간에 따른 그래픽 처리량 변화">
      <line class="chart-peak" x1="${PAD.left}" y1="${peakY}" x2="${W - PAD.right}" y2="${peakY}" />
      <text class="chart-tick" x="${PAD.left}" y="${(Number(peakY) - 4).toFixed(1)}">
        최고 ${esc(peak)} Mpixel/s</text>
      <polyline class="chart-line" points="${points}" />
      ${throttleMark}
      <text class="chart-tick" x="${PAD.left}" y="${H - 6}">0초</text>
      <text class="chart-tick chart-tick-end" x="${W - PAD.right}" y="${H - 6}">
        ${(lastT / 1000).toFixed(1)}초</text>
    </svg>`;
}
