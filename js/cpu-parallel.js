// cpu-parallel.js
// - Worker로 코어를 전부 돌려 "실제" 병렬 성능을 잰다
// - 화면은 건드리지 않는다. 지원하지 않는 환경이면 에러 대신 supported:false

/*
  왜 재는가:
  navigator.hardwareConcurrency가 8이라고 해서 8배 빠른 게 아니다.
  요즘 노트북은 성능 코어와 효율 코어가 섞여 있고, 발열이나 전원 설정 때문에
  실제로는 몇 개만 제대로 도는 경우가 많다. 사양표와 실제의 간격이 노후·제약의 신호다.
*/

const PRIME_LIMIT = 300000; // 코어 하나가 약 150ms 걸리는 크기
const MAX_WORKERS = 16;     // 코어가 아주 많은 기기에서 Worker를 무한정 띄우지 않도록
const TIMEOUT_MS = 20000;

/*
  Worker 하나를 띄워 작업을 시키고 끝날 때까지 기다린다.
  주소를 import.meta.url 기준으로 만드는 이유: new Worker()의 상대 경로는 모듈이 아니라
  "문서" 위치를 기준으로 잡혀서, pages/ 안에서 부르면 엉뚱한 곳을 찾는다.
*/
function runInWorker(limit) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./worker-task.js', import.meta.url));
    const timer = setTimeout(() => {
      worker.terminate();
      reject(new Error('Worker가 시간 안에 끝내지 못함'));
    }, TIMEOUT_MS);

    const finish = (fn, arg) => { clearTimeout(timer); worker.terminate(); fn(arg); };
    worker.onmessage = () => finish(resolve);
    worker.onerror = (event) => finish(reject, new Error(event.message || 'Worker 오류'));
    worker.postMessage({ limit });
  });
}

/*
  단일과 병렬을 각각 재서 비교한다.

  비교 방식: Worker 1개가 작업 W를 하는 시간(T1)과,
  Worker N개가 "각자" 똑같은 작업 W를 하는 시간(Tn)을 잰다. 총 작업량은 N배다.
  코어가 제대로 다 돌면 Tn은 T1과 비슷해야 한다(동시에 하니까).
  그래서 efficiency = T1 / Tn 이 되고, speedup = 코어수 x efficiency 다.
  8코어인데 Tn이 T1의 4배라면 efficiency 0.25, speedup 2배 -> 사양만큼 못 쓰고 있다는 뜻.

  단일 쪽도 메인 스레드가 아니라 Worker로 재는 이유:
  메인 스레드는 화면 그리기와 이벤트 처리를 같이 하고 있어 조건이 달라진다.
  양쪽 모두 Worker로 맞춰야 "코어를 늘린 효과"만 남는다.
*/
export async function runCpuParallel() {
  if (typeof Worker === 'undefined') {
    return { supported: false, reason: 'Web Worker를 지원하지 않는 브라우저' };
  }
  const cores = navigator.hardwareConcurrency ?? null;
  if (!cores || cores < 2) {
    return { supported: false, reason: '코어 수를 알 수 없거나 1코어', cores };
  }

  const workerCount = Math.min(cores, MAX_WORKERS);
  try {
    const singleStart = performance.now();
    await runInWorker(PRIME_LIMIT);
    const singleMs = performance.now() - singleStart;

    const parallelStart = performance.now();
    await Promise.all(Array.from({ length: workerCount }, () => runInWorker(PRIME_LIMIT)));
    const parallelMs = performance.now() - parallelStart;

    const efficiency = parallelMs > 0 ? singleMs / parallelMs : null;
    return {
      supported: true,
      cores,
      workerCount,
      singleMs: Math.round(singleMs),
      parallelMs: Math.round(parallelMs),
      efficiency: efficiency === null ? null : Number(efficiency.toFixed(3)),
      speedup: efficiency === null ? null : Number((efficiency * workerCount).toFixed(2)),
    };
  } catch (error) {
    return { supported: false, reason: error.message, cores };
  }
}
