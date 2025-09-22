precision highp float;

varying vec2 vUv;

uniform sampler2D uPrev;
uniform vec2 uTexel;
uniform float uWaveSpeed;
uniform float uDamping;
uniform float uDt;

void main() {
  vec4 prev = texture2D(uPrev, vUv);
  float h = prev.r;
  float v = prev.g;

  float hL = texture2D(uPrev, vUv - vec2(uTexel.x, 0.0)).r;
  float hR = texture2D(uPrev, vUv + vec2(uTexel.x, 0.0)).r;
  float hD = texture2D(uPrev, vUv - vec2(0.0, uTexel.y)).r;
  float hU = texture2D(uPrev, vUv + vec2(0.0, uTexel.y)).r;

  float lap = (hL + hR + hD + hU - 4.0 * h);
  v += (uWaveSpeed * uWaveSpeed * lap - uDamping * v) * uDt;
  h += v * uDt;
  gl_FragColor = vec4(h, v, 0.0, 1.0);
}
