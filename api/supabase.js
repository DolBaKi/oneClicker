// supabase.js
// - 측정 결과를 Supabase에 보내는 파일 (REST API를 fetch로 직접 호출)
// - 라이브러리를 안 쓰는 이유: 빌드 도구 없이 브라우저가 바로 읽는 파일만 쓰기로 했기 때문

import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

const TABLE = 'measurements';

/*
  저장할 한 줄의 모양을 만든다.
  키 이름은 schema.sql의 컬럼 이름과 하나도 틀리지 않게 맞춰야 한다.
  (JS는 purchaseYear처럼 쓰지만 데이터베이스는 purchase_year처럼 쓰는 관례라 여기서 바꿔준다)
*/
export function toRecord(device, benchmark, scores) {
  return {
    model: device.model,
    purchase_year: Number(device.purchaseYear),
    purchase_month: Number(device.purchaseMonth),
    daily_hours: device.dailyHours,
    usage_type: device.usage,
    compute_ms: benchmark.compute.ms,
    graphics_fps: benchmark.graphics.fps,
    memory_ms: benchmark.memory.ms,
    cores: benchmark.device.cores,
    memory_gb: benchmark.device.memoryGB,
    compute_score: scores.compute,
    graphics_score: scores.graphics,
    memory_score: scores.memory,
    total_score: scores.total,
  };
}

// 측정 결과 한 줄을 저장한다. 실패하면 에러를 던지니 부르는 쪽에서 try-catch로 받는다
export async function insertMeasurement(record) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal', // 저장만 하고 저장된 내용을 돌려받지는 않는다
    },
    body: JSON.stringify(record),
  });

  if (!response.ok) {
    throw new Error(`Supabase 저장 실패 (${response.status}): ${await response.text()}`);
  }
}
