// models.js
// - 노트북 사양 목록(data/models.json)을 불러오고, 모델명을 검색하고, 이 노트북의 실제 사양과 맞춰 본다
// - 화면(DOM)은 건드리지 않는다. 입력 화면(model-search.js)과 결과 화면(spec-compare.js)이 같이 쓴다
//
// 왜 필요한가 (5회차 피드백):
//   "모델명을 직접 입력하기 어렵다", "정확한 모델명으로 표준 사양과 비교해 달라"는 의견이 많았다.
//   그런데 브라우저는 개인정보 보호 때문에 노트북 모델명을 알려 주지 않는다
//   (userAgentData의 model 값은 노트북에서 빈 문자열이다. 직접 확인함).
//   그래서 모델을 "맞히는" 대신, 사양 목록에서 검색하게 하고
//   브라우저가 알려 주는 그래픽 칩·스레드 수로 "이 노트북과 맞는 후보"를 위로 올린다.

/*
  models.json 한 줄의 모양 (scripts/build-models.py가 만든다)
  { id, v: 제조사, m: 모델명, y: 출시 연도, c: [CPU 옵션], t: [스레드 수], g: [그래픽 칩], b: [CPU 제조사] }
  값이 없는 칸은 아예 빠져 있으므로 읽을 때 기본값을 채운다.
*/
let modelsPromise = null;

// 548KB라 첫 화면에서 바로 받지 않고, 모델명 칸을 처음 쓸 때 한 번만 받는다
export function loadModels() {
  if (!modelsPromise) {
    const url = new URL('../data/models.json', import.meta.url);
    modelsPromise = fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`모델 목록을 받지 못함 (${response.status})`);
        return response.json();
      })
      .then((rows) => rows.map(prepare))
      .catch((error) => {
        console.warn(error.message);
        modelsPromise = null; // 다음에 다시 시도할 수 있게 비워 둔다
        return [];
      });
  }
  return modelsPromise;
}

export async function findModel(id) {
  if (!id) return null;
  const models = await loadModels();
  return models.find((model) => model.id === id) ?? null;
}

/* 검색어 정리 --------------------------------------------------------------- */

// 한글로 치는 사람이 많아서 자주 쓰는 이름을 영어 표기로 바꿔 준다.
// 긴 이름부터 바꿔야 "맥북에어"가 "맥북"으로 먼저 잘리지 않는다.
const KOREAN_NAMES = [
  ['갤럭시북', 'galaxy book'], ['맥북에어', 'macbook air'], ['맥북프로', 'macbook pro'],
  ['맥북', 'macbook'], ['그램', 'gram'], ['씽크패드', 'thinkpad'], ['싱크패드', 'thinkpad'],
  ['아이디어패드', 'ideapad'], ['요가', 'yoga'], ['리전', 'legion'], ['비보북', 'vivobook'],
  ['젠북', 'zenbook'], ['스트릭스', 'strix'], ['아스파이어', 'aspire'], ['스위프트', 'swift'],
  ['니트로', 'nitro'], ['프레데터', 'predator'], ['래티튜드', 'latitude'], ['인스피론', 'inspiron'],
  ['파빌리온', 'pavilion'], ['엘리트북', 'elitebook'], ['오멘', 'omen'], ['빅터스', 'victus'],
  ['삼성', 'samsung'], ['엘지', 'lg'], ['레노버', 'lenovo'], ['에이수스', 'asus'], ['아수스', 'asus'],
  ['에이서', 'acer'], ['델', 'dell'], ['애플', 'apple'], ['레이저', 'razer'], ['후지쯔', 'fujitsu'],
];

// 비교할 때는 대소문자·띄어쓰기·기호를 무시한다 ("17Z90R", "17z90 r", "17Z90R-G" 모두 같은 걸 찾게)
const compact = (text) => text.toLowerCase().replace(/[^a-z0-9가-힣]/g, '');

// 한글 이름을 영어 표기로 바꾼다 (갤럭시북 -> galaxy book). 검색어와 모델 이름 양쪽에 같이 쓴다
function romanize(text) {
  let out = text.toLowerCase();
  KOREAN_NAMES.forEach(([ko, en]) => { out = out.split(ko).join(` ${en} `); });
  return out;
}

function queryTokens(query) {
  return romanize(query).split(/\s+/).map(compact).filter(Boolean);
}

// 모델명 괄호 속 코드("LG gram 16 (16Z90R)"의 16Z90R). 바닥 라벨에 적힌 값과 같아서 따로 뽑아 둔다
const CODE_IN_NAME = /\(([^)]+)\)/g;

function prepare(row) {
  const codes = [...row.m.matchAll(CODE_IN_NAME)].map((m) => compact(m[1].split(',')[0]));
  return {
    id: row.id,
    vendor: row.v,
    name: row.m,
    year: row.y ?? null,
    cpus: row.c ?? [],
    threads: row.t ?? [],
    gpus: row.g ?? [],
    brands: row.b ?? [],
    codes: codes.filter((code) => /\d/.test(code)),
    // 한글 이름 모델도 영어 검색어로 찾히도록 원래 이름과 영어 변환본을 함께 색인하고,
    // 출시 연도도 넣는다. 맥북처럼 이름에 연도 대신 칩(M5)만 있는 모델도 "맥북프로 2025"로 찾게 한다.
    haystack: compact(`${row.v} ${row.m} ${romanize(row.m)} ${row.y ?? ''}`),
  };
}

/* 이 노트북과 맞는지 보기 ----------------------------------------------------- */

// 브라우저가 주는 그래픽 이름은 "ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 ...)" 꼴이다.
// 목록 쪽과 똑같이 (R)·(TM)을 지우고 소문자로 맞춰야 "iris xe"가 그 안에서 찾아진다.
export const normalizeGpuName = (text) => String(text ?? '')
  .replace(/\((?:r|tm)\)|®|™/gi, ' ')
  .replace(/\s+/g, ' ')
  .toLowerCase()
  .trim();

const GPU_BRANDS = ['intel', 'amd', 'apple', 'qualcomm'];

/*
  이 노트북에서 읽은 값: { threads, gpuNames: [정리된 그래픽 이름들] }
  돌려주는 값: { status: 'match' | 'mismatch' | 'unknown', threads, gpu }
    - 각 항목은 true(맞음) / false(다름) / null(목록에 정보가 없어 모름)
  하나라도 다르면 mismatch, 확인한 게 모두 맞으면 match, 확인할 게 없으면 unknown
*/
export function matchHardware(model, detected) {
  if (!detected) return { status: 'unknown', threads: null, gpu: null };

  /*
    브라우저의 hardwareConcurrency는 보통 논리 프로세서(스레드) 수지만, 브라우저·OS·개인정보
    설정에 따라 물리 코어 수(스레드의 절반)만 알려주기도 한다. 그래서 6코어 12스레드 노트북이
    6으로 보고되는 일이 흔하다. 읽은 값 그대로거나 그 두 배가 목록 스레드 수와 맞으면 일치로 본다.
  */
  const d = detected.threads;
  const threads = (model.threads.length && d)
    ? (model.threads.includes(d) || model.threads.includes(d * 2)) : null;

  let gpu = null;
  if (model.gpus.length && detected.gpuNames.length) {
    gpu = model.gpus.some((g) => detected.gpuNames.some((name) => name.includes(g)));
  } else if (model.brands.length && detected.gpuNames.length) {
    // 그래픽 칩 이름이 목록에 없으면 내장 그래픽 제조사로 CPU 제조사만 맞춰 본다.
    // 단, 제조사가 같다는 건 근거가 약하다(인텔 노트북이 수백 개). 그래서 "다르다"는 판단에만 쓰고
    // 같을 때는 일치로 치지 않는다. 외장 그래픽(NVIDIA)만 보이면 CPU 제조사를 알 수 없어 건너뛴다
    const seen = GPU_BRANDS.filter((b) => detected.gpuNames.some((name) => name.includes(b)));
    if (seen.length && !seen.some((b) => model.brands.includes(b))) gpu = false;
  }

  /*
    "일치"는 그래픽 칩 이름까지 맞았을 때만 준다. 스레드 수(8, 12 등)는 겹치는 모델이 너무 많아
    그것만으로 일치라고 하면 사용자가 틀린 모델을 맞다고 믿게 된다. (직접 세어 보니
    'Iris Xe + 8스레드'만 해도 55개 모델이 나왔다)
  */
  let status = 'unknown';
  if (threads === false || gpu === false) status = 'mismatch';
  else if (gpu === true) status = 'match';
  return { status, threads, gpu };
}

/* 검색 --------------------------------------------------------------------- */

/*
  검색어의 모든 낱말이 들어 있는 모델만 남기고 점수 순으로 정렬한다.
    - 바닥 라벨 코드와 정확히 같으면 가장 위 (가장 확실한 단서)
    - 모델명이 검색어로 시작하면 그다음
    - 이 노트북 사양과 맞으면 위로, 다르면 아래로
    - 나머지는 최신 모델 먼저 (지금 쓰는 사람이 많을 가능성이 높다)
*/
export function searchModels(models, query, detected, limit = 8) {
  const tokens = queryTokens(query);
  if (!tokens.length) return [];
  const joined = tokens.join('');

  return models
    .filter((model) => tokens.every((token) => model.haystack.includes(token)))
    .map((model) => {
      const hw = matchHardware(model, detected);
      let score = 0;
      if (model.codes.some((code) => code === joined || joined.includes(code))) score += 100;
      if (compact(model.name).startsWith(joined)) score += 20;
      if (hw.status === 'match') score += 10;
      if (hw.status === 'mismatch') score -= 10;
      score += (model.year ?? 2015) / 10000; // 동점일 때만 영향을 주는 아주 작은 값
      return { model, hw, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/* 이 노트북에서 읽을 수 있는 값 ------------------------------------------------ */

/*
  모델 후보를 고르는 데 쓸 값만 읽는다. 측정용 hardware.js와 따로 둔 이유:
  hardware.js는 WebGPU를 먼저 보는데, 크롬은 WebGPU에서 그래픽 이름을 비워 두고
  구조 이름("gcn-4" 등)만 주는 경우가 있다. 이름 비교에는 WebGL 쪽 이름이 필요하다.
  노트북에 그래픽이 두 개면 WebGL은 내장, WebGPU는 외장을 보여 주기도 해서 둘 다 모은다.
*/
export async function detectForMatching() {
  const gpuNames = [];
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    if (ext) gpuNames.push(normalizeGpuName(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)));
  } catch { /* 못 읽으면 이름 비교만 건너뛴다 */ }

  try {
    const adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
    const info = adapter?.info;
    const name = [info?.vendor, info?.description, info?.device].filter(Boolean).join(' ');
    if (name) gpuNames.push(normalizeGpuName(name));
  } catch { /* WebGPU가 없는 브라우저 */ }

  return {
    threads: navigator.hardwareConcurrency ?? null,
    gpuNames: gpuNames.filter(Boolean),
  };
}

/*
  화면에 "감지한 사양"으로 보여 줄 짧은 이름.
  "angle (intel, angle metal renderer: intel uhd graphics 630, unspecified version)" 처럼
  그래픽 이름이 번역 계층(ANGLE) 정보에 싸여 오므로 가운데 이름만 꺼낸다.
*/
export function shortGpuName(name) {
  if (!name) return null;
  const inner = name.match(/^angle \([^,]+, (.+?)(?:, [^,]+)?\)$/)?.[1] ?? name;
  return inner
    .replace(/^angle metal renderer: /, '')
    .replace(/\s+(direct3d|d3d|opengl|vulkan|vs_).*$/, '')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\b(Uhd|Hd|Rtx|Gtx|Mx|Amd|Rx|Gpu)\b/g, (w) => w.toUpperCase()) // 약어는 대문자로
    .trim();
}

export function describeDetected(detected) {
  if (!detected) return '';
  // 코어 수로 노트북을 판단한다. hardwareConcurrency 값을 코어 수로 보여 준다
  // (하이퍼스레딩이 있으면 실제 스레드는 이 두 배일 수 있다)
  return [shortGpuName(detected.gpuNames[0]), detected.threads ? `${detected.threads}코어` : null]
    .filter(Boolean).join(' · ');
}
