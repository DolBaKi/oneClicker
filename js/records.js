// records.js
// - 측정 기록 화면(records.html)의 화면 조작
// - Supabase에 쌓인 기록을 최근 순으로 표로 그린다. 개인정보 없는 값만 보여준다

import { getRecentMeasurements, getMetricAverages } from './stats.js';

const USAGE = { document: '문서·웹', develop: '개발', video: '영상편집', game: '게임' };

const esc = (t) => String(t ?? '').replace(/[&<>"]/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// 구입 연월 → 사용 기간(년)
function usedYears(year, month) {
  if (!year) return '-';
  const now = new Date();
  const months = Math.max(0, (now.getFullYear() - year) * 12 + (now.getMonth() + 1 - (month || 1)));
  return `${(months / 12).toFixed(1)}년`;
}

function when(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function scoreTag(s) {
  if (s === null || s === undefined) return '<span class="rec-score rec-none">-</span>';
  const tone = s >= 80 ? 'ok' : s > 40 ? 'warn' : 'bad';
  return `<span class="rec-score rec-${tone}">${s}</span>`;
}

function row(r) {
  const retention = r.retention === null ? '-' : `${Math.round(r.retention * 100)}%`;
  const sustained = r.sustainedThroughput === null ? '-' : `${r.sustainedThroughput} Mpixel/s`;
  return `
    <tr>
      <td class="rec-model">${esc(r.model)}</td>
      <td>${r.cores ? `${r.cores}코어` : '-'}</td>
      <td>${usedYears(r.purchaseYear, r.purchaseMonth)}</td>
      <td>${esc(USAGE[r.usageType] || r.usageType || '-')}</td>
      <td>${scoreTag(r.totalScore)}</td>
      <td>${retention}</td>
      <td class="rec-sus">${sustained}</td>
      <td class="rec-date">${when(r.createdAt)}</td>
    </tr>`;
}

async function init() {
  const body = document.getElementById('records-body');
  const summary = document.getElementById('records-summary');

  const [records, averages] = await Promise.all([getRecentMeasurements(100), getMetricAverages()]);

  if (records === null) {
    body.innerHTML = `<p class="notice">측정 기록을 불러오지 못했습니다.
      서버 접속 정보가 없거나, 아직 <code>migration-005</code>를 실행하지 않았을 수 있습니다.</p>`;
    return;
  }

  // 요약: 총 건수 + 평균 점수
  const n = averages?.sampleCount ?? records.length;
  const avgScore = records.length
    ? Math.round(records.reduce((a, r) => a + (r.totalScore ?? 0), 0)
        / records.filter((r) => r.totalScore != null).length || 0) : null;
  summary.innerHTML = `
    <div class="rec-stat"><span class="rec-stat-num">${n}</span><span class="rec-stat-label">전체 측정</span></div>
    <div class="rec-stat"><span class="rec-stat-num">${records.length}</span><span class="rec-stat-label">최근 표시</span></div>
    ${avgScore ? `<div class="rec-stat"><span class="rec-stat-num">${avgScore}</span><span class="rec-stat-label">평균 점수</span></div>` : ''}`;

  if (!records.length) {
    body.innerHTML = '<p class="notice">아직 측정 기록이 없습니다. 첫 측정의 주인공이 되어 보세요.</p>';
    return;
  }

  body.innerHTML = `
    <div class="rec-table-wrap">
      <table class="rec-table">
        <thead><tr>
          <th>모델</th><th>코어</th><th>사용 기간</th><th>용도</th>
          <th>종합</th><th>유지율</th><th>유지 처리량</th><th>측정일</th>
        </tr></thead>
        <tbody>${records.map(row).join('')}</tbody>
      </table>
    </div>`;
}

init();
