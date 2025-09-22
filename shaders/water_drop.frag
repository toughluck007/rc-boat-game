precision highp float;

varying vec2 vUv;

uniform sampler2D uPrev;
uniform vec2 uCenter;
uniform float uRadius;
uniform float uStrength;

void main() {
  vec4 prev = texture2D(uPrev, vUv);
  float dist = distance(vUv, uCenter);
  float influence = exp(-pow(dist / max(uRadius, 1e-4), 2.0));
  prev.r += influence * uStrength;
  gl_FragColor = prev;
}
