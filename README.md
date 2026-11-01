# 노트북 노후 상태 분석 및 교체 시기 예측 서비스

시스템 데이터를 읽어 부품별 노후 점수를 매기고, 언제 바꿔야 하는지 개월 수로 알려주는 서비스입니다.

## 기술 스택

순수 HTML / CSS / JavaScript (ES Modules). 빌드 도구, 프레임워크 없음.

## 로컬에서 실행하기

`index.html`을 더블클릭해서 `file://`로 여는 방식은 사용하지 않습니다.
브라우저 보안 정책 때문에 `type="module"` 스크립트가 `file://`에서는 CORS 오류로 차단되기 때문입니다.
반드시 로컬 서버를 띄워서 `http://`로 열어야 합니다.

### 방법 1: VSCode Live Server

1. VSCode에 Live Server 확장 설치
2. `index.html`에서 우클릭 → "Open with Live Server"

### 방법 2: Python 내장 서버

```bash
python3 -m http.server 5500
```

이후 브라우저에서 `http://localhost:5500` 접속

## 폴더 구조

```
index.html              랜딩
pages/device.html       기기 정보 입력
pages/collect.html      성능 측정
pages/result.html       분석 결과

js/validate.js          입력값 검증 (화면을 모른다)
js/device.js            기기 정보 화면 조작

js/benchmark.js         측정 순서·반복·중앙값 관리
js/workloads.js         연산 / 메모리 / 그래픽 부하
js/gl-scene.js          그래픽 최고 속도용 WebGL 장면
js/gpu-stress.js        15초 지속 부하 측정
js/gl-stress-scene.js   지속 부하용 WebGL 장면
js/gpu-stats.js         retention / cv / throttleAt 계산
js/cpu-parallel.js      Worker 병렬 효율 측정
js/worker-task.js       Worker가 돌릴 작업
js/hardware.js          CPU·RAM·GPU 정보 조회
js/power.js             배터리 사용 여부 확인

js/scoring.js           무엇을 점수화할지 결정
js/stability.js         안정성·사양 정합성 환산
js/lifespan.js          사용 기간·교체 시기·등급

js/progress.js          측정 진행 표시
js/collect.js           측정 화면 흐름 제어
js/result.js            결과 화면 조작
js/result-scores.js     점수 막대
js/chart.js             SVG 꺾은선 그래프
js/compare.js           다른 기기 기록과 비교
js/summary.js           기기 정보 한 줄 요약
js/store.js             화면 간 값 전달 (sessionStorage)
js/stats.js             Supabase 통계 조회

api/supabase.js         측정 결과 저장 (fetch로 REST 직접 호출)
api/config.js           접속 정보 (gitignore, 직접 만들어야 함)
api/schema.sql          표 생성
api/migration-001.sql   지속 부하·병렬 컬럼 추가
api/migration-002-stats.sql  통계 함수 2개
```

## 처음 받았을 때

1. `api/config.example.js`를 `api/config.js`로 복사하고 Supabase 주소와 키를 채운다
2. Supabase SQL Editor에서 `schema.sql` → `migration-001.sql` → `migration-002-stats.sql` 순서로 실행
3. 로컬 서버를 띄우고 접속 (위 "로컬에서 실행하기" 참고)

## 무엇을 재고, 무엇을 재지 않는가

재는 것
- 연산 속도 (단일 / Worker 병렬)
- 메모리 응답, 그래픽 최고 속도(FPS)
- **그래픽 지속 부하 15초** — 부하가 이어질 때 성능이 유지되는지

점수를 매기는 것 (총점 = 안정성 60% + 사양 정합성 40%)
- 안정성: retention(유지/최고) 50%, 변동계수 25%, 꺾인 시점 25%
- 사양 정합성: 병렬 효율

점수를 매기지 **않는** 것
- 속도(ms·fps·Mpixel/s)는 측정값 그대로만 보여준다.
  "몇 ms가 몇 점인가"를 정하려면 여러 기기의 실제 분포가 필요한데 아직 그 기록이 없다.
  기록이 쌓이면 `score_percentile`로 백분위를 넣을 자리를 만들어 뒀다.
- 배터리 사이클·SSD 기록량·CPU 온도는 브라우저가 보안상 알려주지 않아 아예 다루지 않는다.
- GPU는 이름만 알 수 있고 모델별 성능표가 없어 등급을 매기지 않는다.

## 아직 못 하는 것

- **교체 시기 예측**: 연식별 점수 분포에서 하락 속도를 구해야 하는데, 기록이 모이기 전에는
  계산할 수 없다. 임의의 값으로 개월 수를 지어내지 않고 "아직 알 수 없다"고 표시한다.
- **점수 기준 보정**: 안정성 절단점(retention 0.97/0.65 등)은 측정 데이터가 아니라
  정해둔 선이다. 여러 기기 기록이 쌓이면 실제 분포에 맞춰 다시 잡아야 한다.
