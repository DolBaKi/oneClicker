// gl-stress-scene.js
// - GPU 지속 부하 측정에 쓸 장면을 준비한다 (화면 전체를 덮는 사각형 + 무거운 셰이더)
// - gl-scene.js(삼각형 장면)와 따로 둔 이유: 저쪽은 "얼마나 빨리 그리나", 이쪽은
//   "초당 몇 픽셀을 처리하나"를 재야 해서 그려지는 픽셀 수가 정확히 확정돼야 한다

// 캔버스 크기와 아래 셰이더 반복 횟수가 "부하의 세기"를 정한다.
// 세기를 어떻게 잡았는지는 gpu-stress.js 위쪽 주석에 적어뒀다.
const SIZE = 384; // 한 번 그릴 때마다 384*384 = 147,456픽셀. 처리량 계산의 기준이 된다

// 사각형 네 꼭짓점. 클립 공간 전체(-1~1)를 덮어서 모든 픽셀이 셰이더를 통과하게 한다
const QUAD = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);

const VERTEX_SRC = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.0,1.0);}';

/*
  픽셀 하나마다 반복 연산을 돌려 GPU를 실제로 바쁘게 만든다.
  반복 횟수를 상수로 박아둔 이유: GLSL ES 1.0은 반복 횟수가 상수여야 컴파일된다.
  삼각형을 많이 그리는 방식 대신 이렇게 하는 이유는, 덮어 그려진 픽셀 수를
  셀 수 없으면 "초당 몇 픽셀"이라는 숫자를 만들 수 없기 때문이다.
*/
const FRAGMENT_SRC = `precision mediump float;
uniform float t;
void main(){
  vec2 p = gl_FragCoord.xy * 0.01;
  float a = 0.0;
  for (int i = 0; i < 64; i++) {
    float f = float(i);
    a += sin(p.x * f + t) * cos(p.y * f - t);
    p += vec2(a * 0.001, -a * 0.001);
  }
  gl_FragColor = vec4(fract(a), fract(a * 0.5), fract(a * 0.25), 1.0);
}`;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
}

// 준비에 성공하면 그리기 도구 한 벌을, 실패하면 null을 돌려준다
function createStressScene(gl) {
  const vertexShader = compile(gl, gl.VERTEX_SHADER, VERTEX_SRC);
  const fragmentShader = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SRC);
  if (!vertexShader || !fragmentShader) return null;

  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, QUAD, gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'p');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const timeLocation = gl.getUniformLocation(program, 't');
  gl.viewport(0, 0, SIZE, SIZE);
  const onePixel = new Uint8Array(4); // 아래 sync()에서 쓸 임시 버퍼

  return {
    pixelsPerDraw: SIZE * SIZE,

    drawOnce(seed) {
      gl.uniform1f(timeLocation, seed * 0.01);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },

    /*
      GPU가 실제로 다 그릴 때까지 기다린다.
      gl.finish()만으로는 부족하다: 브라우저는 타이밍 공격을 막으려고 finish()를
      flush()처럼 처리해, 명령만 큐에 넣고 곧바로 돌아와 버리는 경우가 있다.
      그러면 "GPU가 걸린 시간"이 아니라 "명령을 쌓는 데 걸린 시간"을 재게 된다.
      readPixels는 결과를 CPU 메모리로 가져와야 하므로 GPU가 끝날 때까지 반드시 기다린다.
      딱 1픽셀만 읽어서 전송 비용은 거의 들지 않는다.
    */
    sync() {
      gl.finish();
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, onePixel);
    },

    // 다 쓴 WebGL 컨텍스트를 놓아준다. 브라우저가 동시에 열 수 있는 개수가 제한돼 있다
    dispose() {
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}

// 숨겨진 캔버스를 만들고 장면까지 준비한다. 어느 단계든 실패하면 null
export function openStressScene() {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
  return gl ? createStressScene(gl) : null;
}
