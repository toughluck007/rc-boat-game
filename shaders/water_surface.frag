precision highp float;

varying vec2 vUv;
varying vec3 vWorldPos;

uniform sampler2D uHeight;
uniform sampler2D uNormal;
uniform sampler2D uTrackMask;

uniform vec3 uCameraPos;
uniform vec3 uSunDir;
uniform vec3 uSkyColor;
uniform vec3 uWaterDeepColor;
uniform vec3 uWaterShallowColor;

void main() {
  float height = texture2D(uHeight, vUv).r;
  vec3 normal = texture2D(uNormal, vUv).xyz * 2.0 - 1.0;
  vec3 worldPos = vec3(vWorldPos.x, height, vWorldPos.z);

  vec3 viewDir = normalize(uCameraPos - worldPos);
  vec3 lightDir = normalize(uSunDir);

  float fresnel = pow(1.0 - clamp(dot(normal, viewDir), 0.0, 1.0), 3.0);
  float diffuse = max(dot(normal, lightDir), 0.0);
  vec3 halfVec = normalize(lightDir + viewDir);
  float spec = pow(max(dot(normal, halfVec), 0.0), 64.0);

  float depthFactor = clamp((height + 0.1) * 4.0, 0.0, 1.0);
  vec3 baseColor = mix(uWaterDeepColor, uWaterShallowColor, depthFactor);
  float trackMask = texture2D(uTrackMask, vUv).r;
  baseColor = mix(baseColor, baseColor * 0.6, trackMask);

  vec3 reflection = uSkyColor;
  vec3 refraction = baseColor + diffuse * vec3(0.18) + spec * vec3(0.45);
  vec3 color = mix(refraction, reflection, fresnel);
  color = color * 0.9 + vec3(0.03, 0.04, 0.05);

  gl_FragColor = vec4(color, 1.0);
}
