// hardware.js
// - 브라우저가 알려주는 하드웨어 정보를 읽는 파일 (CPU 코어·구조, RAM, GPU)
// - 측정(benchmark.js)과 떼어놓은 이유: 이쪽은 "재는" 게 아니라 "물어보는" 것이다
// - 브라우저마다 주는 정보가 달라서, 못 읽으면 숨기지 말고 '확인 불가'로 남긴다

/* CPU ------------------------------------------------------------------
   이름(i5-1135G7 같은 것)은 브라우저가 알려주지 않는다. 지문 추적에 쓰일 수 있어
   막아뒀기 때문이다. 코어 수와 아키텍처까지가 한계이고, 억지로 추정하지 않는다. */
async function readCpu() {
  const cores = navigator.hardwareConcurrency ?? null;
  let architecture = null;
  let platform = null;

  // userAgentData는 크롬 계열에만 있다. 사파리·파이어폭스는 userAgent로 떨어진다
  if (navigator.userAgentData?.getHighEntropyValues) {
    try {
      const hints = await navigator.userAgentData.getHighEntropyValues([
        'architecture', 'bitness', 'platform', 'platformVersion',
      ]);
      architecture = hints.bitness ? `${hints.architecture} ${hints.bitness}bit` : hints.architecture;
      platform = hints.platformVersion
        ? `${hints.platform} ${hints.platformVersion}` : hints.platform;
    } catch { /* 권한 거부 등. 아래 폴백으로 넘어간다 */ }
  }
  if (!platform) platform = navigator.platform || null;

  return { cores, architecture, platform, name: null, supported: cores !== null };
}

/* RAM ------------------------------------------------------------------
   deviceMemory는 실제 용량이 아니라 2의 거듭제곱으로 반올림한 "대략값"이다.
   지문 추적을 막으려고 뭉뚱그려 주고 브라우저에 따라 상한도 둔다(8에서 자르는 곳도 있다).
   12GB와 16GB처럼 가까운 용량은 구분되지 않는다고 보고 써야 한다.
   사파리처럼 아예 값을 안 주는 브라우저도 많아서 null이 정상 결과 중 하나다. */
function readRam() {
  const value = navigator.deviceMemory;
  if (value === undefined || value === null) {
    return { value: null, approximate: true, supported: false };
  }
  return { value, approximate: true, supported: true };
}

/* GPU (1) WebGPU 우선 --------------------------------------------------
   WebGL보다 정보가 깔끔하고 마스킹이 덜하다. 최신 크롬 계열에서 동작한다. */
async function readGpuViaWebGPU() {
  if (!navigator.gpu) return null;
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) return null;

  // 표준은 adapter.info지만 구현 시기에 따라 requestAdapterInfo()인 경우가 있다
  const info = adapter.info
    ?? (adapter.requestAdapterInfo ? await adapter.requestAdapterInfo() : null);
  if (!info) return null;

  const renderer = [info.device, info.description].filter(Boolean).join(' ').trim();
  return {
    vendor: info.vendor || null,
    renderer: renderer || info.architecture || null,
    architecture: info.architecture || null,
    source: 'webgpu',
  };
}

/* GPU (2) WebGL 폴백 ---------------------------------------------------
   WEBGL_debug_renderer_info가 있어야 진짜 이름이 나온다.
   사파리는 이걸 막고 'Apple GPU' 같은 값만 주므로 아래에서 마스킹 여부를 따로 표시한다. */
function readGpuViaWebGL() {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
  if (!gl) return null;

  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const vendor = gl.getParameter(ext ? ext.UNMASKED_VENDOR_WEBGL : gl.VENDOR);
  const renderer = gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER);
  return { vendor, renderer, architecture: null, source: 'webgl' };
}

// 'Apple GPU'처럼 모델을 알 수 없는 일반적인 문자열인지 본다
const MASKED = /^(apple gpu|webkit|mozilla|google inc\.?|generic|software)/i;

async function readGpu() {
  let gpu = null;
  try { gpu = await readGpuViaWebGPU(); } catch { /* 폴백으로 */ }
  if (!gpu) {
    try { gpu = readGpuViaWebGL(); } catch { /* 둘 다 실패 */ }
  }
  if (!gpu) return { supported: false, reason: 'WebGPU·WebGL 모두 사용할 수 없음' };

  return { ...gpu, isMasked: MASKED.test(gpu.renderer || ''), supported: true };
}

/* 통합 ------------------------------------------------------------------
   한 항목이 실패해도 나머지는 살리려고 각각 따로 감싼다. */
export async function detectHardware() {
  const [cpu, gpu] = await Promise.all([
    readCpu().catch(() => ({ supported: false })),
    readGpu().catch((e) => ({ supported: false, reason: e.message })),
  ]);
  return { cpu, ram: readRam(), gpu, detectedAt: new Date().toISOString() };
}
