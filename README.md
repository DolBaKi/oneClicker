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
index.html             랜딩 화면
pages/device.html      기기 정보 입력 폼
pages/collect.html     성능 측정 + 체감 평가
css/                   tokens / base / layout / components / measure
js/main.js             랜딩 화면 스크립트
js/validate.js         입력값 검증 (화면을 건드리지 않음)
js/device.js           기기 정보 화면 조작
js/workloads.js        실제 부하 작업 (연산 / 메모리 / 그래픽)
js/gl-scene.js         WebGL 셰이더·버퍼 준비
js/benchmark.js        측정 반복·중앙값·시간 예산 관리
js/collect.js          측정 화면 조작
js/store.js            화면 간 값 전달 (sessionStorage)
api/                   Supabase 연동용 (현재 비어있음)
```

## 진행 상황

- 1차시: 로컬 환경 구성, 화면 2개(랜딩/기기 정보) 뼈대, GitHub 첫 커밋
- 3차시: 기기 정보 입력 폼과 검증, 성능 실측 벤치마크 + 체감 평가
- 4차시(예정): 측정값을 0~100 점수로 환산하고 분석 결과 화면(result.html) 연결
- 이후(예정): Supabase 연동
