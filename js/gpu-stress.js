// gpu-stress.js
// - GPU에 약 15초간 부하를 이어 걸며 시간에 따른 성능 변화를 기록한다
// - 화면은 건드리지 않는다. 진행 상황은 onProgress 콜백으로만 알린다

/*
  왜 평균 FPS가 아니라 지속 부하인가:
  낡은 노트북은 서멀 구리스가 굳고 팬 성능이 떨어져 부하를 주면 스로틀링이 걸린다.
  처음엔 빠르다가 급격히 느려진다. 반대로 새 보급형은 느리지만 끝까지 일정하다.
  평균만 보면 둘이 같아 보이지만, 시간에 따른 변화를 보면 갈린다.
*/

import { openStressScene } from './gl-stress-scene.js';
import { summarize } from './gpu-stats.js';

/*
  부하의 세기와 길이를 정한 근거:

  발열 제한(스로틀링)은 보통 부하를 준 지 10~30초쯤 걸린다. 열이 쌓일 시간이 필요해서다.
  처음엔 6초만 돌렸는데 그때는 아직 뜨거워지지 않아 멀쩡한 기기든 낡은 기기든 똑같이
  "끝까지 유지됨"이 나왔다. 그래서 15초로 늘리고 쉬는 시간도 거의 없앴다.
  대신 한 번에 그리는 양은 중간쯤(384x384, 픽셀당 64회)으로 뒀다. 더 올리면 측정하는
  동안 기기가 과하게 달아올라 측정 자체가 기기 상태를 바꾼다. */
const TOTAL_MS = 15000;          // 전체 측정 시간. 열이 쌓여 스로틀링이 드러날 만큼은 돌린다
const CHUNK_TARGET_MS = 150;     // 한 구간에서 GPU를 돌리는 목표 길이
const REST_MS = 10;              // 구간 사이 양보 시간. UI를 갱신할 최소한만 남긴다
const MAX_DRAWS_PER_CHUNK = 600; // 보정이 튀어도 이 이상은 그리지 않는다 (폭주 방지)
const MIN_TRUSTED_MS = 5;        // 이보다 짧은 구간은 타이머 오차가 커서 믿지 않는다

const unsupported = (reason) => ({ supported: false, reason, samples: [] });

// "몇 번 그려야 한 구간이 되나"를 먼저 재본다. 기기마다 GPU 속도가 수백 배 차이 나서
// 횟수를 고정하면 빠른 기기는 1ms에 끝나고 느린 기기는 몇 초씩 걸린다.
// 첫 회는 셰이더 컴파일과 클럭 상승이 섞여 있어 버리고 두 번째 값을 쓴다.
function calibrate(scene) {
  scene.drawOnce(0);
  scene.sync();
  const start = performance.now();
  scene.drawOnce(1);
  scene.sync();
  const oneDrawMs = Math.max(performance.now() - start, 0.05);
  return Math.max(1, Math.min(MAX_DRAWS_PER_CHUNK, Math.round(CHUNK_TARGET_MS / oneDrawMs)));
}

export async function runGpuStress({ onProgress, signal } = {}) {
  if (document.hidden) return unsupported('측정을 시작할 때 창이 활성 상태가 아님');

  const scene = openStressScene();
  if (!scene) return unsupported('WebGL을 사용할 수 없거나 셰이더를 준비하지 못함');

  // 탭이 백그라운드로 가면 브라우저가 GPU 작업을 늦춰 측정이 통째로 왜곡된다
  let switchedAway = false;
  const watchVisibility = () => { if (document.hidden) switchedAway = true; };
  document.addEventListener('visibilitychange', watchVisibility);

  try {
    let drawsPerChunk = calibrate(scene);
    const samples = [];
    const started = performance.now();
    let aborted = false;
    let seed = 2;

    for (;;) {
      if (switchedAway) return unsupported('측정 중 다른 창으로 전환됨');
      if (signal?.aborted) { aborted = true; break; }

      const chunkStart = performance.now();
      for (let i = 0; i < drawsPerChunk; i++) scene.drawOnce(seed++);
      scene.sync();
      const chunkMs = performance.now() - chunkStart;
      const elapsed = performance.now() - started;

      if (chunkMs < MIN_TRUSTED_MS) {
        // 타이머 해상도보다 짧게 끝난 구간은 믿을 수 없다. 0.3ms를 0.1ms로 잘못 재면
        // 처리량이 3배로 부풀고, 그 점이 peak가 되는 순간 retention이 통째로 망가진다.
        // 버리는 대신 다음 구간에서 더 많이 그리게 해 측정 가능한 길이로 끌어올린다.
        drawsPerChunk = Math.min(MAX_DRAWS_PER_CHUNK, drawsPerChunk * 2);
      } else {
        // Mpixel/s = 그린 픽셀 수 / (걸린 ms * 1000)
        const throughput = (scene.pixelsPerDraw * drawsPerChunk) / (chunkMs * 1000);
        samples.push({ t: Math.round(elapsed), throughput: Number(throughput.toFixed(2)) });
      }

      onProgress?.(Math.min(1, elapsed / TOTAL_MS));
      if (elapsed >= TOTAL_MS) break;
      await new Promise((resolve) => setTimeout(resolve, REST_MS)); // UI가 얼지 않게 양보
    }

    if (samples.length === 0) return unsupported('표본을 모으지 못함');
    return {
      supported: true,
      aborted,
      samples,
      durationMs: samples[samples.length - 1].t,
      ...summarize(samples),
    };
  } finally {
    document.removeEventListener('visibilitychange', watchVisibility);
    scene.dispose();
  }
}
