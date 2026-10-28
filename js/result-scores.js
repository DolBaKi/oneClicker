// result-scores.js
// - 결과 화면의 점수 부분만 그린다 (총점, 등급, 항목별 막대, 신뢰도 안내)
// - result.js에서 떼어낸 이유: 한 파일에 점수·그래프·원시값을 다 넣으니 100줄을 넘었다

import { grade } from './lifespan.js';

/*
  점수를 매기는 항목은 둘뿐이다.
  속도(ms, fps, Mpixel/s)는 "몇이 100점인가"를 정할 근거 데이터가 아직 없어서
  점수로 바꾸지 않고 측정값 그대로 아래 표에 보여준다. scoring.js 주석 참고.
*/
const ITEMS = [
  { key: 'stability', label: '성능 안정성', hint: '부하가 이어질 때 성능이 유지되는 정도' },
  { key: 'spec', label: '사양 정합성', hint: '가진 코어·메모리만큼 실제로 쓰고 있는지' },
];

// 점수대에 따라 막대 색을 고른다 (양호 / 주의 / 위험)
const barClass = (score) => (score >= 70 ? '' : score >= 40 ? 'is-warn' : 'is-bad');

/*
  측정이 충분했다고 볼 기준.
  성능 안정성 하나(0.20)만 빠져도 이 선 아래로 떨어지게 잡았다.
  안정성은 이 서비스가 가장 보고 싶어 하는 값이라, 그게 없으면 등급을 매길 수 없다.
*/
const ENOUGH_COVERAGE = 0.85;

/*
  일부 항목을 못 쟀으면 총점을 그대로 믿으면 안 된다는 걸 알린다.
  못 잰 항목은 가중치에서 빠지므로 남은 항목이 좋으면 점수가 부풀어 오른다.
  (예: 안정성을 못 쟀는데 속도만 빨라서 100점이 나오는 경우)
*/
function renderCoverage(scores) {
  if ((scores.coverage ?? 1) >= ENOUGH_COVERAGE) return;
  const box = document.getElementById('coverage-note');
  box.textContent = `측정 항목의 ${Math.round((scores.coverage ?? 0) * 100)}%만 확인됐습니다. `
    + '나머지는 이 기기·브라우저에서 잴 수 없어 총점에서 빠졌고, 그만큼 점수가 실제보다 높게 나옵니다.';
  box.classList.remove('hidden');
}

export function renderScores(scores) {
  const enough = (scores.coverage ?? 1) >= ENOUGH_COVERAGE;
  document.getElementById('total-number').textContent = scores.total ?? '-';
  // 측정이 모자라면 양호/주의 같은 등급을 붙이지 않는다. 붙이면 근거 없는 판정이 된다
  document.getElementById('total-grade').textContent =
    enough ? (grade(scores.total) ?? '') : '판정 보류 (측정 부족)';
  renderCoverage(scores);

  document.getElementById('score-list').innerHTML = ITEMS.map(({ key, label, hint }) => {
    const score = scores[key];
    const bar = (score === null || score === undefined)
      ? '<span class="score-label">측정 불가</span><span class="score-number">-</span>'
      : `<div class="score-bar">
           <div class="score-bar-fill ${barClass(score)}" style="width: ${score}%"></div>
         </div><span class="score-number">${score}</span>`;
    return `<div class="score-row"><span class="score-label">${label}</span>${bar}</div>
      <p class="score-hint">${hint}</p>`;
  }).join('');
}
