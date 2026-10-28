// gpu-stress.js
// - GPU에 약 6초간 부하를 이어 걸며 시간에 따른 성능 변화를 기록한다
// - 화면은 건드리지 않는다. 진행 상황은 onProgress 콜백으로만 알린다

/*
  왜 평균 FPS가 아니라 지속 부하인가:
  낡은 노트북은 서멀 구리스가 굳고 팬 성능이 떨어져 몇 초만 부하를 줘도 스로틀링이 걸린다.
  처음엔 빠르다가 급격히 느려진다. 반대로 새 보급형 기기는 느리지만 끝까지 일정하다.
  평균만 보면 둘이 똑같아 보이지만, 시간에 따른 변화를 보면 확실히 갈린다.
*/

import { openStressScene } from './gl-stress-scene.js';
import { summarize } from './gpu-stats.js';

/*
  부하의 세기와 길이를 일부러 낮춰 잡았다. 스로틀링을 보려면 부하가 "이어지는" 게
  중요하지 매 순간 GPU를 최대로 밀 필요는 없고, 풀로드로 달구면 측정 자체가 기기 상태를
  바꿔 뒤따르는 측정값까지 오염시킨다. 구간 사이에 쉬어 점유율을 약 75%로 낮췄다
  (아주 약한 스로틀링은 놓칠 수 있지만, 심한 경우는 이 정도로도 충분히 드러난다).
*/
const TOTAL_MS = 6000;           // 전체 측정 시간
const CHUNK_TARGET_MS = 120;     // 한 구간에서 GPU를 돌리는 목표 길이
const REST_MS = 40;              // 구간 사이에 쉬는 시간
const MAX_DRAWS_PER_CHUNK = 400; // 보정이 튀어도 이 이상은 그리지 않는다 (폭주 방지)
const MIN_TRUSTED_MS = 5;        // 이보다 짧은 구간은 타이머 오차가 커서 믿지 않는다

const unsupported = (reason) => ({ supported: false, reason, samples: [] });

/*
  "몇 번 그려야 한 구간이 되나"를 먼저 재본다. 기기마다 GPU 속도가 수백 배 차이 나서
  반복 횟수를 고정하면 빠른 기기는 1ms 만에 끝나고 느린 기기는 몇 초씩 걸린다.
  첫 회는 셰이더 컴파일과 클럭 상승이 섞여 있어 버리고 두 번째 값을 쓴다. */
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
      // 쉬는 시간. UI가 얼지 않게 양보하는 동시에 GPU도 잠깐 숨을 돌린다
      await new Promise((resolve) => setTimeout(resolve, REST_MS));
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
