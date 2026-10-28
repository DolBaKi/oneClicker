// worker-task.js
// - Worker 하나가 돌릴 작업. 메인 스레드 측정과 똑같은 계산을 한다
// - 별도 파일로 둔 이유: new Worker()는 파일 주소를 받는다. 빌드 도구 없이 쓰려면 이 방법뿐이다

// workloads.js의 runCompute와 같은 계산이어야 단일 대 병렬 비교가 성립한다
function countPrimes(limit) {
  let count = 0;
  for (let n = 2; n < limit; n++) {
    let isPrime = true;
    for (let d = 2; d * d <= n; d++) {
      if (n % d === 0) { isPrime = false; break; }
    }
    if (isPrime) count++;
  }
  return count;
}

self.onmessage = (event) => {
  self.postMessage(countPrimes(event.data.limit));
};
