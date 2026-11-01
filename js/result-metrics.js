// result-metrics.js
// - 측정한 지표를 그대로 표로 보여준다 (점수로 바꾸지 않는다)
// - 값마다 "무슨 뜻인지" 한 줄을 붙인다. 숫자만 있으면 좋은 건지 나쁜 건지 알 수 없다

const pct = (v) => `${Math.round(v * 100)}%`;
const sec = (v) => `${(v / 1000).toFixed(1)}초`;

/*
  표에 넣을 줄 정의. [제목, 값, 값을 문자열로 바꾸는 함수, 설명]
  값이 null이거나 undefined면 '측정 못 함'으로 적는다. 0도 의미 있는 값이라 따로 가른다.
*/
function rows({ benchmark, parallel, stress, hardware }) {
  return {
    '연산·메모리': [
      ['연산 속도 (단일)', benchmark?.compute?.ms, (v) => `${Math.round(v)} ms`,
        '소수 60만 개를 세는 데 걸린 시간. 낮을수록 빠릅니다'],
      ['연산 속도 (병렬)', parallel?.supported ? parallel.speedup : null,
        (v) => `${v}배`,
        `코어를 모두 썼을 때 몇 배 빨라지는지. 코어 수에 가까울수록 좋습니다`],
      ['코어 활용 효율', parallel?.supported ? parallel.efficiency : null, pct,
        '100%에 가까울수록 가진 코어를 제대로 쓰고 있다는 뜻입니다'],
      ['메모리 응답', benchmark?.memory?.ms, (v) => `${Math.round(v)} ms`,
        '32MB 배열을 만들고 훑는 데 걸린 시간. 낮을수록 빠릅니다'],
    ],
    '그래픽 지속 부하 (15초)': [
      ['최고 속도 (순간)', benchmark?.graphics?.fps, (v) => `${v} fps`,
        '가볍게 그릴 때의 초당 화면 수. 모니터 주사율이 천장이라 보통 60에서 멈춥니다'],
      ['최고 처리량', stress?.peak, (v) => `${v} Mpixel/s`,
        '부하를 주는 동안 낸 가장 빠른 속도입니다'],
      ['유지 처리량', stress?.sustained, (v) => `${v} Mpixel/s`,
        '뒤쪽 구간에서 실제로 버틴 속도. 오래 쓸 때 체감하는 성능입니다'],
      ['성능 유지율', stress?.retention, pct,
        '유지 처리량 ÷ 최고 처리량. 100%에 가까울수록 끝까지 버틴 것입니다'],
      ['흔들림 (변동계수)', stress?.cv, (v) => v.toFixed(3),
        '측정값이 얼마나 출렁였는지. 0에 가까울수록 일정합니다'],
      ['성능이 꺾인 시점', stress?.supported ? stress.throttleAt : null, sec,
        '최고 속도의 85% 아래로 처음 떨어진 때입니다'],
      ['측정 시간', stress?.durationMs, sec, '실제로 부하를 준 시간입니다'],
    ],
    '기기 정보': [
      ['CPU 코어 수', hardware?.cpu?.cores, (v) => `${v}개`, '브라우저가 알려주는 논리 코어 수입니다'],
      ['CPU 구조', hardware?.cpu?.architecture, String, '브라우저가 알려주는 범위까지만 나옵니다'],
      ['메모리', hardware?.ram?.value, (v) => `약 ${v} GB`,
        '2의 거듭제곱으로 반올림한 대략값이라 정확한 용량은 알 수 없습니다'],
      ['GPU', hardware?.gpu?.renderer, String,
        '브라우저가 이름을 가리는 경우가 있어 비어 있을 수 있습니다'],
    ],
  };
}

const cell = (value, format) => (value === null || value === undefined
  ? '<dd class="metric-none">측정 못 함</dd>'
  : `<dd>${format(value)}</dd>`);

export function renderMetrics(result) {
  const groups = rows(result);
  document.getElementById('metric-list').innerHTML = Object.entries(groups).map(
    ([title, list]) => `
      <section class="metric-group">
        <h2 class="field-label">${title}</h2>
        <dl class="metrics">
          ${list.map(([label, value, format, hint]) => `
            <dt>${label}<span class="metric-hint">${hint}</span></dt>
            ${cell(value, format)}`).join('')}
        </dl>
      </section>`).join('');
}

// 성능이 꺾였을 때만 쓰는 보충 설명. 꺾이지 않았으면 null
export function throttleSummary(stress) {
  if (!stress?.supported || stress.throttleAt === null) return null;
  return `측정 ${sec(stress.throttleAt)} 지점부터 느려지기 시작해, `
    + `끝에는 최고 속도의 ${pct(stress.retention)}까지 내려갔습니다`;
}
