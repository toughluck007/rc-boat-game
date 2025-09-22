precision highp float;

varying vec2 vUv;

uniform sampler2D uHeight;
uniform vec2 uTexel;

void main() {
  float hL = texture2D(uHeight, vUv - vec2(uTexel.x, 0.0)).r;
  float hR = texture2D(uHeight, vUv + vec2(uTexel.x, 0.0)).r;
  float hD = texture2D(uHeight, vUv - vec2(0.0, uTexel.y)).r;
  float hU = texture2D(uHeight, vUv + vec2(0.0, uTexel.y)).r;
  vec3 n = normalize(vec3((hR - hL) * 0.5, 1.0, (hU - hD) * 0.5));
  gl_FragColor = vec4(n * 0.5 + 0.5, 1.0);
}
