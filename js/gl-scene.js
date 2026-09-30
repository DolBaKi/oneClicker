// gl-scene.js
// - 그래픽 측정에 쓸 WebGL 장면을 준비하는 파일 (셰이더 컴파일과 버퍼 설정만)
// - workloads.js에서 떼어낸 이유: WebGL 준비 코드가 길어 측정 흐름을 읽기 어렵게 만들기 때문

// 삼각형을 회전시키기만 하는 아주 단순한 셰이더
const VERTEX_SRC = 'attribute vec2 p;uniform float t;void main(){gl_Position=vec4(p.x*cos(t)-p.y*sin(t),p.x*sin(t)+p.y*cos(t),0.0,1.0);}';
const FRAGMENT_SRC = 'precision mediump float;uniform float t;void main(){gl_FragColor=vec4(fract(t),0.4,0.6,1.0);}';

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
}

// 성공하면 "한 프레임 그리는 함수"를, 준비에 실패하면 null을 돌려준다
export function createScene(gl, triangleCount) {
  const vertexShader = compile(gl, gl.VERTEX_SHADER, VERTEX_SRC);
  const fragmentShader = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SRC);
  if (!vertexShader || !fragmentShader) return null;

  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);

  // 무작위 위치의 삼각형을 미리 한 번 올려두고, 매 프레임 통째로 다시 그린다
  const vertices = new Float32Array(triangleCount * 6);
  for (let i = 0; i < vertices.length; i++) vertices[i] = Math.random() * 2 - 1;
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

  const position = gl.getAttribLocation(program, 'p');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const timeLocation = gl.getUniformLocation(program, 't');

  return (seconds) => {
    gl.uniform1f(timeLocation, seconds);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, triangleCount * 3);
  };
}
