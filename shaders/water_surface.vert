attribute vec2 aPosition;
attribute vec2 aUV;

uniform mat4 uViewProjection;

varying vec2 vUv;
varying vec3 vWorldPos;

void main() {
  vUv = aUV;
  vec3 worldPos = vec3(aPosition.x, 0.0, aPosition.y);
  vWorldPos = worldPos;
  gl_Position = uViewProjection * vec4(worldPos, 1.0);
}
