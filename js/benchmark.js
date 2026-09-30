// benchmark.js
// - 측정을 몇 번 반복하고 어떤 값을 고를지 관리하는 파일 (측정 진행 담당)
// - 화면을 건드리지 않는 이유: 측정 방식이 바뀌어도 화면 코드를 고치지 않아도 되게 하기 위함

/*
  왜 실측 방식으로 바꿨나:
  브라우저는 보안 정책상 배터리 사이클·SSD 기록량·CPU 온도에 접근할 수 없다.
  그래서 사용자가 그 값을 손으로 옮겨 적게 하는 대신,
  브라우저가 직접 잴 수 있는 성능 지표만으로 판단하는 방식으로 바꿨다.
  여기서 나오는 숫자는 기기·환경마다 달라서 절대 평가가 아니라 비교용이다.
*/

import { runCompute, runMemory, runGraphics } from './workloads.js';

const REPEAT = 3; // 반복 횟수. 중앙값을 쓰려고 홀수로 둔다

// await로 잠깐 쉬어 브라우저가 화면을 갱신할 틈을 준다 (안 쉬면 화면이 멈춘 것처럼 보인다)
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 가운데 값. 평균과 달리 한 번 크게 튄 값에 끌려가지 않는다
function median(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

// 기기 정보: 브라우저가 알려주는 값만 읽는다. 미지원이면 null
export function readDeviceInfo() {
  return {
    cores: navigator.hardwareConcurrency ?? null,
    memoryGB: navigator.deviceMemory ?? null, // 사파리·파이어폭스는 지원하지 않는다
  };
}

/*
  같은 측정을 최대 3회 반복해 중앙값을 낸다.
  1회차는 엔진이 코드를 아직 최적화하지 못해(워밍업) 늘 느리고,
  백신 검사나 메모리 정리 때문에 값이 한 번씩 크게 튀기 때문이다.
  누적 시간이 예산을 넘으면 남은 회차를 건너뛴다
  → 예상보다 훨씬 느린 기기에서도 전체 측정이 10초를 넘지 않게 하는 안전장치다.
*/
async function repeatMedian(runOnce, budgetMs) {
  const values = [];
  const start = performance.now();
  for (let i = 0; i < REPEAT; i++) {
    const value = await runOnce();
    if (value === null) return null; // 지원하지 않는 측정은 반복할 필요가 없다
    values.push(value);
    await sleep(30);
    if (performance.now() - start > budgetMs) break;
  }
  return median(values);
}

// 네 가지를 순서대로 측정한다.
// onStep(항목, 상태)으로 진행 상황만 알려주고, 그걸로 무엇을 그릴지는 부르는 쪽이 정한다
export async function runBenchmark(onStep) {
  const step = async (key, run) => {
    onStep(key, 'running');
    await sleep(50); // "측정 중"이 화면에 먼저 그려지도록 한 박자 쉰다
    const value = await run();
    onStep(key, 'done');
    return value;
  };

  const computeMs = await step('compute', () => repeatMedian(async () => runCompute(), 2500));
  const fps = await step('graphics', () => repeatMedian(runGraphics, 2500));
  const memoryMs = await step('memory', () => repeatMedian(async () => runMemory(), 1500));
  const device = await step('device', async () => readDeviceInfo());

  // TODO: 4차시 - score를 0~100 점수로 환산. 지금은 측정 원시값을 그대로 둔다
  return {
    compute: { ms: computeMs, score: computeMs },
    graphics: { fps, score: fps },
    memory: { ms: memoryMs, score: memoryMs },
    device,
  };
}
