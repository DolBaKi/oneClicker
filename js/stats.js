// stats.js
// - Supabase에 쌓인 측정 기록의 "요약"만 가져오는 파일
// - 표를 직접 읽지 않고 함수(RPC)를 부르는 이유: 개별 기록은 남의 것이라 보면 안 되기 때문
// - 실패해도 서비스가 멈추면 안 되므로, 여기서 잡아서 null을 돌려준다

import { SUPABASE_URL, SUPABASE_KEY } from '../db/config.js';

// Supabase의 함수 호출 주소는 /rest/v1/rpc/함수이름 이다
async function callRpc(name, params = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    throw new Error(`${name} 실패 (${response.status}): ${await response.text()}`);
  }
  return response.json();
}

/*
  내 점수가 전체에서 어느 위치인지 가져온다.
  표본이 적을 때는 순위를 말해봤자 의미가 없으므로 enough 플래그로 알려준다.
  (5명 중 1등과 500명 중 1등은 전혀 다른 이야기다)
*/
export async function getPercentile(myScore) {
  try {
    const rows = await callRpc('score_percentile', { my_score: myScore });
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row) return null;
    return {
      sampleCount: Number(row.sample_count),
      percentile: Number(row.percentile),
      median: Number(row.median),
      enough: Number(row.sample_count) >= 10,
    };
  } catch (error) {
    console.warn('분포 조회 실패:', error.message);
    return null; // 못 가져와도 결과 화면은 보여야 한다
  }
}

/*
  연식(사용 개월)별 평균 점수를 가져온다.
  "노트북이 오래될수록 점수가 얼마나 떨어지는가"를 재는 재료다.
*/
export async function getAgeCurve() {
  try {
    const rows = await callRpc('score_by_age');
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return rows.map((r) => ({
      ageMonths: Number(r.age_bucket),
      sampleCount: Number(r.sample_count),
      avgScore: Number(r.avg_score),
    }));
  } catch (error) {
    console.warn('연식별 통계 조회 실패:', error.message);
    return null;
  }
}
