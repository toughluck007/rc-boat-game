import { createProgram } from '../core/gl-utils.js';
import {
  createMat4,
  identity,
  lookAt,
  perspective,
  multiply,
  rotateY,
  translate,
  invert,
  transpose,
} from '../core/math.js';
import {
  CAMERA_SETTINGS,
  ENVIRONMENT_SETTINGS,
} from '../core/tuning.js';

const SHADER_BASE_URL = new URL('../../shaders/', import.meta.url);

async function loadText(name) {
  const response = await fetch(new URL(name, SHADER_BASE_URL));
  if (!response.ok) {
    throw new Error(`Failed to load shader: ${name}`);
  }
  return response.text();
}

function normalizeVec3(v) {
  const len = Math.hypot(v[0], v[1], v[2]);
  if (len === 0) {
    return [0, 0, 0];
  }
  return [v[0] / len, v[1] / len, v[2] / len];
}

function buildBoatMesh() {
  const halfLength = 0.22;
  const halfWidth = 0.06;
  const hullHeight = 0.06;

  const verts = [
    [-halfWidth, 0, -halfLength],
    [halfWidth, 0, -halfLength],
    [0, 0, halfLength],
    [-halfWidth, hullHeight, -halfLength * 0.6],
    [halfWidth, hullHeight, -halfLength * 0.6],
    [0, hullHeight, halfLength],
  ];

  const faces = [
    [0, 1, 2],
    [3, 5, 4],
    [0, 2, 3],
    [3, 2, 5],
    [1, 4, 2],
    [4, 5, 2],
    [0, 3, 1],
    [1, 3, 4],
  ];

  const positions = [];
  const normals = [];

  for (const face of faces) {
    const a = verts[face[0]];
    const b = verts[face[1]];
    const c = verts[face[2]];
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const nx = ab[1] * ac[2] - ab[2] * ac[1];
    const ny = ab[2] * ac[0] - ab[0] * ac[2];
    const nz = ab[0] * ac[1] - ab[1] * ac[0];
    const len = Math.hypot(nx, ny, nz) || 1;
    const normal = [nx / len, ny / len, nz / len];

    for (const index of face) {
      const v = verts[index];
      positions.push(v[0], v[1], v[2]);
      normals.push(normal[0], normal[1], normal[2]);
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    count: positions.length / 3,
  };
}

export class Renderer {
  static async create(gl, track) {
    const [waterVert, waterFrag, boatVert, boatFrag] = await Promise.all([
      loadText('water_surface.vert'),
      loadText('water_surface.frag'),
      loadText('boat.vert'),
      loadText('boat.frag'),
    ]);
    return new Renderer(gl, track, {
      waterVert,
      waterFrag,
      boatVert,
      boatFrag,
    });
  }

  constructor(gl, track, shaderSources) {
    this.gl = gl;
    this.track = track;
    this.canvasWidth = gl.canvas.width;
    this.canvasHeight = gl.canvas.height;

    this.waterProgram = createProgram(gl, shaderSources.waterVert, shaderSources.waterFrag, {
      aPosition: 0,
      aUV: 1,
    });
    this.waterUniforms = {
      viewProjection: gl.getUniformLocation(this.waterProgram, 'uViewProjection'),
      height: gl.getUniformLocation(this.waterProgram, 'uHeight'),
      normal: gl.getUniformLocation(this.waterProgram, 'uNormal'),
      trackMask: gl.getUniformLocation(this.waterProgram, 'uTrackMask'),
      cameraPos: gl.getUniformLocation(this.waterProgram, 'uCameraPos'),
      sunDir: gl.getUniformLocation(this.waterProgram, 'uSunDir'),
      skyColor: gl.getUniformLocation(this.waterProgram, 'uSkyColor'),
      waterDeepColor: gl.getUniformLocation(this.waterProgram, 'uWaterDeepColor'),
      waterShallowColor: gl.getUniformLocation(this.waterProgram, 'uWaterShallowColor'),
    };

    this.waterBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.waterBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -1, -1, 0, 0,
        1, -1, 1, 0,
        -1, 1, 0, 1,
        1, 1, 1, 1,
      ]),
      gl.STATIC_DRAW,
    );
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    const boatMesh = buildBoatMesh();
    this.boatProgram = createProgram(gl, shaderSources.boatVert, shaderSources.boatFrag, {
      aPosition: 0,
      aNormal: 1,
    });
    this.boatUniforms = {
      model: gl.getUniformLocation(this.boatProgram, 'uModel'),
      viewProjection: gl.getUniformLocation(this.boatProgram, 'uViewProjection'),
      normalMatrix: gl.getUniformLocation(this.boatProgram, 'uNormalMatrix'),
      cameraPos: gl.getUniformLocation(this.boatProgram, 'uCameraPos'),
      lightDir: gl.getUniformLocation(this.boatProgram, 'uLightDir'),
      baseColor: gl.getUniformLocation(this.boatProgram, 'uBaseColor'),
    };

    this.boatPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.boatPositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, boatMesh.positions, gl.STATIC_DRAW);
    this.boatNormalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.boatNormalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, boatMesh.normals, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    this.boatVertexCount = boatMesh.count;
    this.boatColor = new Float32Array([0.9, 0.2, 0.3]);

    this.trackMask = track.getMaskTexture();

    this.viewMatrix = createMat4();
    this.projectionMatrix = createMat4();
    this.viewProjectionMatrix = createMat4();
    this.tmpMatA = createMat4();
    this.tmpMatB = createMat4();

    this.normalMatrix3 = new Float32Array(9);

    this.sunDirection = normalizeVec3(ENVIRONMENT_SETTINGS.sunDirection);
    this.skyColor = ENVIRONMENT_SETTINGS.skyColor;
    this.deepColor = ENVIRONMENT_SETTINGS.waterDeepColor;
    this.shallowColor = ENVIRONMENT_SETTINGS.waterShallowColor;

    gl.enable(gl.DEPTH_TEST);
  }

  resize(width, height) {
    this.canvasWidth = width;
    this.canvasHeight = height;
    const aspect = width / height;
    perspective(this.projectionMatrix, CAMERA_SETTINGS.fov, aspect, CAMERA_SETTINGS.near, CAMERA_SETTINGS.far);
  }

  computeCamera(boat) {
    const forward = boat.getForwardVector();
    const eye = [
      boat.position[0] + forward[0] * 0.2 + CAMERA_SETTINGS.eye[0],
      CAMERA_SETTINGS.eye[1],
      boat.position[2] + forward[2] * 0.2 + CAMERA_SETTINGS.eye[2],
    ];
    const target = [
      boat.position[0] + forward[0] * 0.6,
      boat.position[1] * 0.2,
      boat.position[2] + forward[2] * 0.6,
    ];
    lookAt(this.viewMatrix, eye, target, CAMERA_SETTINGS.up);
    multiply(this.viewProjectionMatrix, this.projectionMatrix, this.viewMatrix);
    return { eye, target };
  }

  render(scene) {
    const { gl } = this;
    const { water, boat } = scene;
    const canvas = gl.canvas;
    if (canvas.width !== this.canvasWidth || canvas.height !== this.canvasHeight) {
      this.resize(canvas.width, canvas.height);
    }

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.04, 0.07, 0.1, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const camera = this.computeCamera(boat);

    this.renderWater(water, camera);
    this.renderBoat(boat, camera);
  }

  renderWater(water, camera) {
    const { gl } = this;
    const cullEnabled = gl.isEnabled(gl.CULL_FACE);
    if (cullEnabled) {
      gl.disable(gl.CULL_FACE);
    }
    gl.useProgram(this.waterProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.waterBuffer);
    const stride = 4 * 4;
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 8);

    gl.uniformMatrix4fv(this.waterUniforms.viewProjection, false, this.viewProjectionMatrix);
    gl.uniform3fv(this.waterUniforms.cameraPos, camera.eye);
    gl.uniform3fv(this.waterUniforms.sunDir, this.sunDirection);
    gl.uniform3fv(this.waterUniforms.skyColor, this.skyColor);
    gl.uniform3fv(this.waterUniforms.waterDeepColor, this.deepColor);
    gl.uniform3fv(this.waterUniforms.waterShallowColor, this.shallowColor);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, water.heightTexture);
    gl.uniform1i(this.waterUniforms.height, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, water.normalTextureHandle);
    gl.uniform1i(this.waterUniforms.normal, 1);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.trackMask);
    gl.uniform1i(this.waterUniforms.trackMask, 2);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.disableVertexAttribArray(0);
    gl.disableVertexAttribArray(1);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    if (cullEnabled) {
      gl.enable(gl.CULL_FACE);
    }
  }

  renderBoat(boat, camera) {
    const { gl } = this;
    const cullEnabled = gl.isEnabled(gl.CULL_FACE);
    if (!cullEnabled) {
      gl.enable(gl.CULL_FACE);
    }
    gl.useProgram(this.boatProgram);

    const model = identity(this.tmpMatA);
    rotateY(model, model, boat.heading);
    translate(model, model, boat.position);

    const inverse = invert(this.tmpMatB, model);
    const normalMatrix4 = transpose(this.tmpMatB, inverse);
    this.normalMatrix3[0] = normalMatrix4[0];
    this.normalMatrix3[1] = normalMatrix4[1];
    this.normalMatrix3[2] = normalMatrix4[2];
    this.normalMatrix3[3] = normalMatrix4[4];
    this.normalMatrix3[4] = normalMatrix4[5];
    this.normalMatrix3[5] = normalMatrix4[6];
    this.normalMatrix3[6] = normalMatrix4[8];
    this.normalMatrix3[7] = normalMatrix4[9];
    this.normalMatrix3[8] = normalMatrix4[10];

    gl.uniformMatrix4fv(this.boatUniforms.model, false, model);
    gl.uniformMatrix4fv(this.boatUniforms.viewProjection, false, this.viewProjectionMatrix);
    gl.uniformMatrix3fv(this.boatUniforms.normalMatrix, false, this.normalMatrix3);
    gl.uniform3fv(this.boatUniforms.cameraPos, camera.eye);
    gl.uniform3fv(this.boatUniforms.lightDir, this.sunDirection);
    gl.uniform3fv(this.boatUniforms.baseColor, this.boatColor);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.boatPositionBuffer);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.boatNormalBuffer);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLES, 0, this.boatVertexCount);

    gl.disableVertexAttribArray(0);
    gl.disableVertexAttribArray(1);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    if (!cullEnabled) {
      gl.disable(gl.CULL_FACE);
    }
  }
}
