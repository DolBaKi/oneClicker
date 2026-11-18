// supabase.js
// - 측정 결과를 Supabase에 보내는 파일 (REST API를 fetch로 직접 호출)
// - 라이브러리를 안 쓰는 이유: 빌드 도구 없이 브라우저가 바로 읽는 파일만 쓰기로 했기 때문

const TABLE = 'measurements';

/*
  접속 정보(config.js)는 키가 들어 있어서 깃허브에 올리지 않는다.
  그래서 내려받은 직후나 배포 설정이 비어 있을 때는 그 파일이 아예 없을 수 있다.

  이때 맨 위에서 import로 읽으면 파일 하나가 없다는 이유로 이 파일을 부른 화면 전체가
  멈춰 버린다 (측정 버튼도, 화면 이동도 안 먹는다).
  그래서 쓰는 순간에 불러오고, 없으면 '저장'만 포기한다. 측정과 결과 보기는 그대로 된다.
*/
let configPromise = null;

function loadConfig() {
  // 한 번만 읽고 결과를 재사용한다 (측정할 때마다 다시 불러올 이유가 없다)
  if (!configPromise) configPromise = import('./config.js').catch(() => null);
  return configPromise;
}

/*
  저장할 한 줄의 모양을 만든다.
  키 이름은 schema.sql의 컬럼 이름과 하나도 틀리지 않게 맞춰야 한다.
  (JS는 purchaseYear처럼 쓰지만 데이터베이스는 purchase_year처럼 쓰는 관례라 여기서 바꿔준다)
*/
export function toRecord({ device, benchmark, stress, parallel, hardware, scores, interrupted }) {
  return {
    model: device.model,
    // 목록에서 고른 모델의 id (직접 입력했으면 null). 같은 모델끼리 묶어 비교할 때 쓴다
    model_id: device.modelId ?? null,
    purchase_year: Number(device.purchaseYear),
    purchase_month: Number(device.purchaseMonth),
    daily_hours: device.dailyHours,
    usage_type: device.usage,

    compute_ms: benchmark?.compute?.ms ?? null,
    graphics_fps: benchmark?.graphics?.fps ?? null,
    memory_ms: benchmark?.memory?.ms ?? null,
    cores: hardware?.cpu?.cores ?? null,
    memory_gb: hardware?.ram?.value ?? null,

    // 시계열 전체는 보내지 않는다. 행이 너무 커지고, 통계에는 요약값이면 충분하다
    peak_throughput: stress?.peak ?? null,
    sustained_throughput: stress?.sustained ?? null,
    retention: stress?.retention ?? null,
    p1_low: stress?.p1Low ?? null,
    cv: stress?.cv ?? null,
    throttle_at_ms: stress?.throttleAt ?? null,
    parallel_speedup: parallel?.speedup ?? null,
    parallel_efficiency: parallel?.efficiency ?? null,

    // 속도는 점수를 매기지 않으므로 보내지 않는다. 원시값(compute_ms 등)은 위에 그대로 있다
    stability_score: scores.stability,
    spec_score: scores.spec,
    total_score: scores.total,
    interrupted: interrupted === true,
  };
}

// 측정 결과 한 줄을 저장한다. 실패하면 에러를 던지니 부르는 쪽에서 try-catch로 받는다
export async function insertMeasurement(record) {
  const config = await loadConfig();
  if (!config?.SUPABASE_URL || !config?.SUPABASE_KEY) {
    throw new Error('서버 접속 정보가 없어 저장을 건너뜁니다');
  }

  const send = (body) => fetch(`${config.SUPABASE_URL}/rest/v1/${TABLE}`, {
    method: 'POST',
    headers: {
      apikey: config.SUPABASE_KEY,
      Authorization: `Bearer ${config.SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal', // 저장만 하고 저장된 내용을 돌려받지는 않는다
    },
    body: JSON.stringify(body),
  });

  let body = { ...record };
  let response = await send(body);

  /*
    새 칸(예: model_id)을 코드에 먼저 넣고 데이터베이스에는 아직 마이그레이션을 안 돌렸다면
    Supabase가 "그런 칸이 없다(PGRST204)"며 저장 전체를 거부한다.
    칸 하나 때문에 측정 기록을 통째로 잃으면 안 되므로, 없다는 칸만 빼고 다시 보낸다.
    (몇 개가 빠졌는지는 콘솔에 남겨 마이그레이션을 잊은 걸 알아챌 수 있게 한다)
  */
  for (let tries = 0; !response.ok && tries < 3; tries++) {
    const text = await response.text();
    const missing = text.match(/Could not find the '([a-z_]+)' column/)?.[1];
    if (!missing || !(missing in body)) {
      throw new Error(`Supabase 저장 실패 (${response.status}): ${text}`);
    }
    console.warn(`데이터베이스에 '${missing}' 칸이 없어 빼고 저장합니다. db/migration-003.sql을 실행하세요`);
    delete body[missing];
    body = { ...body };
    response = await send(body);
  }

  if (!response.ok) {
    throw new Error(`Supabase 저장 실패 (${response.status}): ${await response.text()}`);
  }
}
