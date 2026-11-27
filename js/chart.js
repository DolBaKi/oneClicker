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

/*
  점수 게이지(반원 다이얼). 0~100 점수를 반원 호로 그린다.
  색은 점수대에 따라 바뀐다(양호=teal, 주의=amber, 위험=red).
*/
export function scoreGauge(score) {
  if (score === null || score === undefined) return '';
  const r = 68;
  const cx = 90;
  const cy = 88;
  const s = Math.max(0, Math.min(100, score));
  const tone = score >= 80 ? 'ok' : score > 40 ? 'warn' : 'bad';
  // 왼쪽→오른쪽 반원 호(180도). 배경과 채움이 같은 경로를 쓰고,
  // pathLength=100으로 길이를 100으로 맞춰 dasharray="점수 100"으로 점수만큼만 채운다(호 계산 버그 없음)
  const arc = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  return `
    <svg class="gauge" viewBox="0 0 180 104" role="img" aria-label="종합 점수 ${Math.round(score)}점">
      <path class="gauge-bg" d="${arc}" pathLength="100" />
      <path class="gauge-fg gauge-${tone}" d="${arc}" pathLength="100"
            stroke-dasharray="${s.toFixed(1)} 100" />
      <text class="gauge-score" x="${cx}" y="80" text-anchor="middle">${Math.round(score)}</text>
      <text class="gauge-unit" x="${cx}" y="99" text-anchor="middle">점 / 100</text>
    </svg>`;
}

/*
  백분위 막대. 내 위치를 0~100 가로 막대 위의 점으로 찍는다.
  왼쪽이 하위, 오른쪽이 상위. 중앙값(50) 눈금을 함께 그린다.
*/
export function percentileBar(percentile) {
  const p = Math.max(0, Math.min(100, percentile));
  return `
    <svg class="pbar" viewBox="0 0 300 36" role="img" aria-label="상위 ${100 - Math.round(p)}%">
      <rect class="pbar-track" x="4" y="14" width="292" height="8" rx="4" />
      <line class="pbar-mid" x1="150" y1="10" x2="150" y2="26" />
      <circle class="pbar-dot" cx="${(4 + (p / 100) * 292).toFixed(1)}" cy="18" r="7" />
      <text class="pbar-end" x="4" y="34">하위</text>
      <text class="pbar-end pbar-end-r" x="296" y="34">상위</text>
    </svg>`;
}

/*
  연식별 평균 점수 곡선. 가로=사용 개월, 세로=평균 점수(0~100).
  회색 선은 전체 평균 추세, 내 위치는 큰 점으로 표시한다.
*/
export function ageCurveChart(ageCurve, myMonths, myScore) {
  if (!ageCurve || ageCurve.length < 2) return '';
  const w = 600;
  const h = 200;
  const pad = { l: 34, r: 12, t: 16, b: 26 };
  const iw = w - pad.l - pad.r;
  const ih = h - pad.t - pad.b;
  const maxM = Math.max(...ageCurve.map((p) => p.ageMonths), myMonths || 0, 12);
  const x = (m) => pad.l + (m / maxM) * iw;
  const y = (s) => pad.t + ih - (Math.max(0, Math.min(100, s)) / 100) * ih;
  const pts = ageCurve.map((p) => `${x(p.ageMonths).toFixed(1)},${y(p.avgScore).toFixed(1)}`).join(' ');
  const grid = [0, 25, 50, 75, 100].map((s) => `
    <line class="ac-grid" x1="${pad.l}" y1="${y(s).toFixed(1)}" x2="${w - pad.r}" y2="${y(s).toFixed(1)}" />
    <text class="ac-tick" x="${pad.l - 6}" y="${(y(s) + 3).toFixed(1)}" text-anchor="end">${s}</text>`).join('');
  const dots = ageCurve.map((p) => `<circle class="ac-pt" cx="${x(p.ageMonths).toFixed(1)}" cy="${y(p.avgScore).toFixed(1)}" r="3" />`).join('');
  // 점이 그래프 양 끝에 붙으면 가운데 정렬한 글씨가 잘린다. 가장자리에서는 안쪽으로 정렬한다
  const mx = x(myMonths);
  const anchor = mx > w - pad.r - 40 ? 'end' : mx < pad.l + 40 ? 'start' : 'middle';
  const lx = anchor === 'end' ? mx + 6 : anchor === 'start' ? mx - 6 : mx;
  const me = (myScore === null || myScore === undefined || myMonths === null) ? '' : `
    <circle class="ac-me" cx="${mx.toFixed(1)}" cy="${y(myScore).toFixed(1)}" r="7" />
    <text class="ac-me-label" x="${lx.toFixed(1)}" y="${(y(myScore) - 12).toFixed(1)}" text-anchor="${anchor}">내 노트북</text>`;
  return `
    <svg class="chart ac-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="연식별 평균 점수와 내 위치">
      ${grid}
      <polyline class="ac-line" points="${pts}" />
      ${dots}${me}
      <text class="ac-tick" x="${pad.l}" y="${h - 8}">0개월</text>
      <text class="ac-tick ac-tick-r" x="${w - pad.r}" y="${h - 8}" text-anchor="end">${maxM}개월</text>
    </svg>`;
}
