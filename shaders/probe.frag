precision highp float;

varying vec2 vUv;

uniform sampler2D uHeight;
uniform sampler2D uNormal;
uniform vec2 uProbeCenter;

vec2 xzToUv(vec2 xz) {
  return xz * 0.5 + 0.5;
}

void main() {
  vec2 uv = xzToUv(uProbeCenter);
  float h = texture2D(uHeight, uv).r;
  vec3 n = texture2D(uNormal, uv).xyz * 2.0 - 1.0;
  gl_FragColor = vec4(h, n.x * 0.5 + 0.5, n.z * 0.5 + 0.5, 1.0);
}
