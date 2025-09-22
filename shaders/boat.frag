precision highp float;

varying vec3 vWorldPos;
varying vec3 vNormal;

uniform vec3 uCameraPos;
uniform vec3 uLightDir;
uniform vec3 uBaseColor;

void main() {
  vec3 normal = normalize(vNormal);
  vec3 lightDir = normalize(uLightDir);
  vec3 viewDir = normalize(uCameraPos - vWorldPos);

  float diffuse = max(dot(normal, lightDir), 0.0);
  vec3 halfVec = normalize(lightDir + viewDir);
  float spec = pow(max(dot(normal, halfVec), 0.0), 32.0);

  vec3 color = uBaseColor * (0.25 + diffuse * 0.75) + vec3(0.9, 0.9, 0.8) * spec * 0.4;
  gl_FragColor = vec4(color, 1.0);
}
