// stats.js
// - Supabase에 쌓인 측정 기록의 "요약"만 가져오는 파일
// - 표를 직접 읽지 않고 함수(RPC)를 부르는 이유: 개별 기록은 남의 것이라 보면 안 되기 때문
// - 실패해도 서비스가 멈추면 안 되므로, 여기서 잡아서 null을 돌려준다

// 접속 정보는 키 때문에 깃허브에 올리지 않아 파일 자체가 없을 수 있다.
// 맨 위에서 import하면 그때 화면 전체가 멈추므로 쓰는 순간에 불러온다 (supabase.js와 같은 이유)
let configPromise = null;

function loadConfig() {
  if (!configPromise) configPromise = import('../db/config.js').catch(() => null);
  return configPromise;
}

// Supabase의 함수 호출 주소는 /rest/v1/rpc/함수이름 이다
async function callRpc(name, params = {}) {
  const config = await loadConfig();
  if (!config?.SUPABASE_URL || !config?.SUPABASE_KEY) {
    throw new Error('서버 접속 정보가 없습니다');
  }

  const response = await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: config.SUPABASE_KEY,
      Authorization: `Bearer ${config.SUPABASE_KEY}`,
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

/*
  지표별 전체 평균을 가져온다. 결과 화면에서 "내 값 vs 평균"을 보여주는 재료다.
  migration-004를 아직 실행하지 않았으면 함수가 없어 실패하는데, 그때는 null을 돌려주고
  화면은 평균 없이 값만 보여준다(점진적으로 켜진다).
*/
export async function getMetricAverages() {
  try {
    const rows = await callRpc('metric_averages');
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row) return null;
    return {
      sampleCount: Number(row.sample_count),
      compute_ms: row.compute_ms == null ? null : Number(row.compute_ms),
      memory_ms: row.memory_ms == null ? null : Number(row.memory_ms),
      peak_throughput: row.peak_throughput == null ? null : Number(row.peak_throughput),
      sustained_throughput: row.sustained_throughput == null ? null : Number(row.sustained_throughput),
      retention: row.retention == null ? null : Number(row.retention),
      cv: row.cv == null ? null : Number(row.cv),
      parallel_speedup: row.parallel_speedup == null ? null : Number(row.parallel_speedup),
      parallel_efficiency: row.parallel_efficiency == null ? null : Number(row.parallel_efficiency),
    };
  } catch (error) {
    console.warn('지표 평균 조회 실패:', error.message);
    return null;
  }
}

/*
  쌓인 측정 기록을 최근 순으로 가져온다 (개인정보 없는 안전한 컬럼만).
  migration-005를 아직 실행하지 않았으면 함수가 없어 실패하는데, 그때는 null을 돌려준다.
*/
export async function getRecentMeasurements(limit = 50) {
  try {
    const rows = await callRpc('recent_measurements', { lim: limit });
    if (!Array.isArray(rows)) return null;
    return rows.map((r) => ({
      createdAt: r.created_at,
      model: r.model,
      cores: r.cores == null ? null : Number(r.cores),
      purchaseYear: r.purchase_year == null ? null : Number(r.purchase_year),
      purchaseMonth: r.purchase_month == null ? null : Number(r.purchase_month),
      usageType: r.usage_type,
      totalScore: r.total_score == null ? null : Number(r.total_score),
      retention: r.retention == null ? null : Number(r.retention),
      peakThroughput: r.peak_throughput == null ? null : Number(r.peak_throughput),
      sustainedThroughput: r.sustained_throughput == null ? null : Number(r.sustained_throughput),
    }));
  } catch (error) {
    console.warn('측정 기록 조회 실패:', error.message);
    return null;
  }
}

/*
  지표별 백분위를 가져온다. 내 측정값들을 넘기면 각 지표가 전체 분포에서 어디쯤인지 돌려준다.
  반환 pct = "그 값보다 나쁜 기기의 비율" → 상위 (100 - pct)%.
  migration-006 미실행이면 null. 결과 화면은 백분위 없이 평균 비교만 보여준다.
*/
export async function getMetricPercentiles(v) {
  try {
    const rows = await callRpc('metric_percentiles', {
      c_ms: v.compute_ms ?? null,
      m_ms: v.memory_ms ?? null,
      g_peak: v.peak_throughput ?? null,
      g_sus: v.sustained_throughput ?? null,
      g_ret: v.retention ?? null,
      p_speedup: v.parallel_speedup ?? null,
      p_eff: v.parallel_efficiency ?? null,
    });
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row) return null;
    const num = (x) => (x == null ? null : Number(x));
    return {
      sampleCount: Number(row.sample_count),
      compute_ms: num(row.compute_pct),
      memory_ms: num(row.memory_pct),
      peak_throughput: num(row.peak_pct),
      sustained_throughput: num(row.sustained_pct),
      retention: num(row.retention_pct),
      parallel_speedup: num(row.speedup_pct),
      parallel_efficiency: num(row.eff_pct),
    };
  } catch (error) {
    console.warn('지표 백분위 조회 실패:', error.message);
    return null;
  }
}
