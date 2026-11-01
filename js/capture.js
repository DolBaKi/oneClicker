// capture.js
// - 측정 결과를 PNG 그림 파일로 내려받게 한다 (높이 계산 → 그리기 지시 → 저장)
// - 화면을 그대로 찍는 라이브러리를 쓰지 않고 canvas에 직접 그리는 이유:
//   빌드 도구 없이 쓰기로 했고, 화면 캡처 라이브러리는 글꼴·CSS 때문에 자주 깨진다

import { metricRows } from './result-metrics.js';
import { drawHeader, drawChart } from './capture-draw.js';

const W = 760;
const PAD = 32;
const CHART_H = 170;
const ROW_H = 24;
const GROUP_GAP = 34;

const token = (name) => getComputedStyle(document.documentElement)
  .getPropertyValue(name).trim();
const FONT = "'Pretendard', system-ui, 'Apple SD Gothic Neo', sans-serif";

// 지표를 [이름, 표시값] 쌍으로 평평하게 편다. 화면과 같은 목록을 쓴다
function flatten(result) {
  return Object.entries(metricRows(result)).map(([title, list]) => [title, list.map(
    ([label, value, format]) => [label,
      value === null || value === undefined ? '측정 못 함' : format(value)])]);
}

function drawMetrics(ctx, groups, x, y, width) {
  let cursor = y;
  groups.forEach(([title, list]) => {
    ctx.fillStyle = token('--ink');
    ctx.font = `600 15px ${FONT}`;
    ctx.fillText(title, x, cursor);
    cursor += 22;

    list.forEach(([label, text]) => {
      ctx.font = `400 13px ${FONT}`;
      ctx.fillStyle = token('--ink-2');
      ctx.fillText(label, x, cursor);
      ctx.textAlign = 'right';
      ctx.fillStyle = text === '측정 못 함' ? token('--ink-3') : token('--ink');
      ctx.font = `600 13px ${FONT}`;
      ctx.fillText(text, x + width, cursor);
      ctx.textAlign = 'left';
      cursor += ROW_H;
    });
    cursor += GROUP_GAP - ROW_H + 10;
  });
  return cursor;
}

export async function captureResult(result) {
  // 글꼴이 아직 안 받아졌으면 기본 글꼴로 그려져 모양이 달라진다. 받아질 때까지 기다린다
  if (document.fonts?.ready) await document.fonts.ready;

  const groups = flatten(result);
  const rowCount = groups.reduce((n, [, list]) => n + list.length, 0);
  const height = PAD + 90 + CHART_H + 60
    + rowCount * ROW_H + groups.length * GROUP_GAP + PAD + 26;

  const canvas = document.createElement('canvas');
  const scale = 2; // 고해상도 화면에서도 글자가 뭉개지지 않게 2배로 그린다
  canvas.width = W * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = token('--paper');
  ctx.fillRect(0, 0, W, height);

  let y = drawHeader(ctx, result, PAD, PAD, W - PAD * 2);
  y = drawChart(ctx, result.stress, PAD, y, W - PAD * 2, CHART_H);
  y = drawMetrics(ctx, groups, PAD, y + 10, W - PAD * 2);

  ctx.fillStyle = token('--ink-3');
  ctx.font = `400 11px ${FONT}`;
  ctx.fillText(`측정 시각 ${new Date().toLocaleString('ko-KR')} · 기기와 실행 환경에 따라 달라집니다`,
    PAD, height - PAD + 8);

  return canvas;
}

// 캔버스를 파일로 내려받는다. 브라우저가 toBlob을 못 하면 알려주고 끝낸다
export function download(canvas, filename) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error('이미지를 만들지 못했습니다'));
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      // 바로 지우면 내려받기가 끊길 수 있어 한 박자 뒤에 치운다
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      resolve();
    }, 'image/png');
  });
}
