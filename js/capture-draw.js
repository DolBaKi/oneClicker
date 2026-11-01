// capture-draw.js
// - 캡처 이미지를 canvas에 실제로 그리는 부분 (그리기만)
// - capture.js와 나눈 이유: 저쪽은 크기 계산·내려받기, 이쪽은 붓질이라 하는 일이 다르다

// 색은 tokens.css에 정의된 값을 그대로 읽어 쓴다. 캔버스에는 CSS 변수를 못 넘기기 때문이다
const token = (name) => getComputedStyle(document.documentElement)
  .getPropertyValue(name).trim();

const FONT = "'Pretendard', system-ui, 'Apple SD Gothic Neo', sans-serif";
const font = (size, weight = 400) => `${weight} ${size}px ${FONT}`;

export function drawHeader(ctx, result, x, y, width) {
  ctx.fillStyle = token('--ink');
  ctx.font = font(26, 700);
  ctx.fillText('노트북 성능 측정 결과', x, y + 26);

  ctx.fillStyle = token('--ink-2');
  ctx.font = font(14);
  const { device } = result;
  ctx.fillText(`${device.model} · ${device.purchaseYear}년 ${device.purchaseMonth}월 구입`,
    x, y + 52);

  ctx.strokeStyle = token('--line');
  ctx.beginPath();
  ctx.moveTo(x, y + 68);
  ctx.lineTo(x + width, y + 68);
  ctx.stroke();
  return y + 90;
}

/*
  지속 부하 시계열. 화면의 SVG와 같은 모양으로 그린다.
  y축을 0부터 시작하는 이유도 같다: 중간부터 시작하면 작은 흔들림이 절벽처럼 보인다.
*/
export function drawChart(ctx, stress, x, y, width, height) {
  ctx.fillStyle = token('--ink');
  ctx.font = font(15, 600);
  ctx.fillText('부하를 주는 동안의 성능 변화', x, y + 15);
  const top = y + 30;

  if (!stress?.supported || !stress.samples?.length) {
    ctx.fillStyle = token('--ink-3');
    ctx.font = font(13);
    ctx.fillText(stress?.reason ?? '측정하지 못했습니다', x, top + 20);
    return top + 40;
  }

  const { samples, peak, throttleAt } = stress;
  const lastT = samples[samples.length - 1].t || 1;
  const px = (t) => x + (t / lastT) * width;
  // 화면 그래프(chart.js)와 같은 이유로 위쪽에 여유를 둔다
  const py = (v) => top + height - (v / (peak * 1.1)) * height;

  ctx.strokeStyle = token('--line');
  ctx.strokeRect(x, top, width, height);

  // 최고 성능 기준선 (점선)
  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = token('--ink-3');
  ctx.beginPath();
  ctx.moveTo(x, py(peak));
  ctx.lineTo(x + width, py(peak));
  ctx.stroke();
  ctx.restore();

  // 성능이 꺾인 시점
  if (throttleAt !== null) {
    ctx.save();
    ctx.setLineDash([2, 3]);
    ctx.strokeStyle = token('--amber');
    ctx.beginPath();
    ctx.moveTo(px(throttleAt), top);
    ctx.lineTo(px(throttleAt), top + height);
    ctx.stroke();
    ctx.restore();
  }

  ctx.strokeStyle = token('--teal');
  ctx.lineWidth = 2;
  ctx.beginPath();
  samples.forEach((s, i) => (i ? ctx.lineTo(px(s.t), py(s.throughput))
    : ctx.moveTo(px(s.t), py(s.throughput))));
  ctx.stroke();
  ctx.lineWidth = 1;

  ctx.fillStyle = token('--ink-3');
  ctx.font = font(11);
  ctx.fillText(`최고 ${peak} Mpixel/s`, x + 4, py(peak) - 5);
  ctx.fillText('0초', x, top + height + 14);
  ctx.textAlign = 'right';
  ctx.fillText(`${(lastT / 1000).toFixed(1)}초`, x + width, top + height + 14);
  ctx.textAlign = 'left';
  return top + height + 30;
}
