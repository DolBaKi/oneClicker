// workloads.js
// - 실제로 기기에 부하를 주는 측정 작업 3종 (연산 / 메모리 / 그래픽)
// - benchmark.js와 나눈 이유: "무슨 일을 시킬지"와 "몇 번 재서 어떤 값을 고를지"는 바뀌는 이유가 다르다

import { createScene } from './gl-scene.js';

/*
  작업량은 모든 기기에서 똑같이 고정한다.
  기기마다 작업량을 바꾸면 나온 시간(ms)끼리 비교할 수 없기 때문이다.
  대신 10년 전 노트북도 한 번에 끝낼 수 있도록 보수적으로 잡았다.
*/
const PRIME_LIMIT = 600000;   // 연산: 2~60만 소수 세기 (최신 약 95ms, 구형 노트북 약 500ms)
const ARRAY_SIZE = 4000000;   // 메모리: 약 32MB 배열
const RANDOM_READS = 2000000; // 메모리: 띄엄띄엄 접근 횟수 (최신 약 60ms)
const GFX_MS = 500;           // 그래픽: 500ms 동안 그린 프레임 수를 센다
const TRIANGLES = 40000;      // 한 프레임에 그릴 삼각형 수 (아래 runGraphics 주석 참고)

/*
  작업량을 이 크기로 정한 근거:
  너무 작으면(10~20ms) 타이머 오차와 백그라운드 프로그램에 묻혀 기기 차이가 드러나지 않고,
  너무 크면 구형 노트북에서 10초를 넘긴다. 최신 기기에서 100ms 안팎이 나오도록 맞췄다.
*/

let sink = 0; // 계산 결과를 모아두는 곳. 안 쓰면 엔진이 측정용 반복문을 통째로 지워버린다

// (1) 연산 속도: 소수를 세고 걸린 시간(ms)
export function runCompute() {
  const start = performance.now();
  let count = 0;
  for (let n = 2; n < PRIME_LIMIT; n++) {
    let isPrime = true;
    for (let d = 2; d * d <= n; d++) {
      if (n % d === 0) { isPrime = false; break; }
    }
    if (isPrime) count++;
  }
  sink += count;
  return performance.now() - start;
}

// (2) 메모리 응답: 큰 배열을 만들고 순서대로 + 띄엄띄엄 접근하는 데 걸린 시간(ms)
export function runMemory() {
  const start = performance.now();
  const data = new Float64Array(ARRAY_SIZE);
  for (let i = 0; i < ARRAY_SIZE; i++) data[i] = i * 0.5;
  let sum = 0;
  for (let i = 0; i < ARRAY_SIZE; i++) sum += data[i];
  // 7919(소수)씩 건너뛰며 접근해 캐시가 잘 맞지 않는 상황을 만든다
  for (let i = 0; i < RANDOM_READS; i++) sum += data[(i * 7919) % ARRAY_SIZE];
  sink += sum;
  return performance.now() - start;
}

/*
  (3) 그래픽: 정해진 시간 동안 그린 프레임 수로 평균 FPS를 낸다.
  삼각형을 4만 개나 그리는 이유: FPS의 천장은 모니터 주사율(보통 60)이라
  가볍게 그리면 최신 기기든 낡은 기기든 똑같이 60이 나와 구별되지 않는다.
  WebGL을 지원하지 않으면 에러를 내지 않고 null을 돌려준다.
*/
export function runGraphics() {
  return new Promise((resolve) => {
    // 백그라운드 탭에서는 브라우저가 화면 갱신을 초당 1회까지 늦춰 값이 무의미해진다
    if (document.hidden) return resolve(null);

    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 360;
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return resolve(null);

    const drawFrame = createScene(gl, TRIANGLES);
    if (!drawFrame) return resolve(null);

    let frames = 0;
    const start = performance.now();
    const loop = () => {
      const elapsed = performance.now() - start;
      if (elapsed >= GFX_MS) return resolve(Math.round((frames * 1000) / elapsed));
      drawFrame(elapsed / 500);
      frames++;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
}
