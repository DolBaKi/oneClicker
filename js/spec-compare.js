// spec-compare.js
// - 결과 화면에서 "고른 모델의 표준 사양"과 "이 노트북에서 실제로 읽은 값"을 나란히 보여 준다
// - 피드백(이재훈): 정확한 모델명을 받아 표준 사양과 실제 값을 비교해 달라
//
// 무엇을 비교하지 않는가:
//   메모리 용량은 사양 목록에 값이 있는 모델이 7%뿐이라 대부분 비교할 수 없다.
//   그래서 값이 있는 CPU 스레드 수와 그래픽 칩만 비교하고, 없는 항목은 "목록에 정보 없음"으로 둔다.

import { findModel, matchHardware, normalizeGpuName, shortGpuName } from './models.js';

const MARK = {
  true: '<span class="badge badge--ok">일치</span>',
  false: '<span class="badge badge--warn">다름</span>',
  null: '<span class="spec-unknown">목록에 정보 없음</span>',
};

// 예전 버전에서 측정해 기기 정보에 읽은 값이 없으면, 측정 때 읽은 하드웨어 정보로 대신한다
function detectedFrom(result) {
  if (result.device.detected) return result.device.detected;
  const renderer = result.hardware?.gpu?.renderer;
  return {
    threads: result.hardware?.cpu?.cores ?? null,
    gpuNames: renderer ? [normalizeGpuName(renderer)] : [],
  };
}

function row(label, listed, measured, mark) {
  return `<tr><th scope="row">${label}</th><td>${listed}</td><td>${measured}</td><td>${mark}</td></tr>`;
}

function advice(model, hw, detected) {
  if (hw.status === 'match') {
    return '고른 모델의 표준 사양과 이 노트북에서 읽은 값이 맞습니다. 모델을 정확히 고른 것으로 보입니다.';
  }
  const lines = [];
  if (hw.cores === false) {
    lines.push(`코어 수가 다릅니다(목록 ${model.cores.join('·')}코어, 이 노트북 ${detected.threads}). `
      + '같은 이름이라도 CPU 옵션이 다른 모델이거나, 다른 모델을 골랐을 수 있습니다. '
      + '브라우저가 코어 수를 실제와 다르게 알려 주는 경우도 있습니다.');
  }
  if (hw.gpu === false) {
    lines.push('그래픽 칩이 다릅니다. 외장 그래픽이 있는 노트북은 브라우저가 내장 그래픽만 보여 줄 수 있고, '
      + '모델을 잘못 골랐을 수도 있습니다.');
  }
  if (!lines.length) lines.push('목록에 그래픽 정보가 없어 일부만 대조했습니다.');
  return lines.join(' ');
}

export async function renderSpecCompare(result) {
  const box = document.getElementById('spec-compare');
  if (!box) return;

  const model = await findModel(result.device.modelId);
  if (!model) {
    // 모델을 목록에서 고르지 않은 경우. 왜 비교가 없는지 한 줄로 알려 준다
    box.innerHTML = `<p class="chart-help">모델을 목록에서 고르지 않아 표준 사양과 비교하지 않았습니다.
      처음부터 다시 진행하면서 모델명 칸에서 검색해 고르면 이 부분이 채워집니다.</p>`;
    box.hidden = false;
    return;
  }

  const detected = detectedFrom(result);
  const hw = matchHardware(model, detected);
  const measuredGpu = shortGpuName(detected.gpuNames[0]) ?? '읽지 못함';
  const listedGpu = model.gpus.length ? model.gpus.map(shortGpuName).join(', ') : '-';
  const cpus = model.cpus.length > 3 ? `${model.cpus.slice(0, 3).join(', ')} 외` : model.cpus.join(', ');

  const purchase = Number(result.device.purchaseYear);
  const yearNote = model.year && purchase < model.year
    ? `<p class="model-warn">구입 연도(${purchase}년)가 이 모델의 출시 연도(${model.year}년)보다 빠릅니다.
       모델을 다시 확인해 보세요.</p>` : '';

  box.innerHTML = `
    <p class="spec-model">${model.name}${model.year ? ` · ${model.year}년 출시` : ''}</p>
    <table class="spec-table">
      <thead><tr><th></th><th>표준 사양</th><th>이 노트북</th><th></th></tr></thead>
      <tbody>
        ${row('CPU', cpus || '-', '브라우저가 알려 주지 않음', '')}
        ${row('CPU 코어 수', model.cores.length ? `${model.cores.join('·')}코어` : '-',
    detected.threads ? `${detected.threads}` : '읽지 못함', MARK[hw.cores])}
        ${row('그래픽', listedGpu, measuredGpu, MARK[hw.gpu])}
      </tbody>
    </table>
    <p class="chart-help">${advice(model, hw, detected)}</p>
    ${yearNote}`;
  box.hidden = false;
}
