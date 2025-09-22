import { WATER_SETTINGS } from '../core/tuning.js';
import {
  createTexture,
  createFramebuffer,
  createFullscreenProgram,
  createFullscreenQuad,
  assertExtensions,
} from '../core/gl-utils.js';

async function loadText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load shader: ${url}`);
  }
  return response.text();
}

export class WaterSystem {
  static async create(gl, settings = WATER_SETTINGS) {
    assertExtensions(gl);
    const [dropSrc, updateSrc, normalSrc, probeSrc] = await Promise.all([
      loadText('shaders/water_drop.frag'),
      loadText('shaders/water_update.frag'),
      loadText('shaders/water_normal.frag'),
      loadText('shaders/probe.frag'),
    ]);
    return new WaterSystem(gl, settings, {
      dropSrc,
      updateSrc,
      normalSrc,
      probeSrc,
    });
  }

  constructor(gl, settings, shaderSources) {
    this.gl = gl;
    this.settings = settings;
    this.size = settings.size;
    this.texel = [1 / this.size, 1 / this.size];

    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.pixelStorei(gl.PACK_ALIGNMENT, 1);

    this.quad = createFullscreenQuad(gl);

    this.heightTextures = [
      createTexture(gl, this.size, this.size),
      createTexture(gl, this.size, this.size),
    ];
    this.framebuffers = [
      createFramebuffer(gl, this.heightTextures[0]),
      createFramebuffer(gl, this.heightTextures[1]),
    ];
    this.currentIndex = 0;

    this.normalTexture = createTexture(gl, this.size, this.size);
    this.normalFramebuffer = createFramebuffer(gl, this.normalTexture);

    this.probeTexture = createTexture(gl, 1, 1);
    this.probeFramebuffer = createFramebuffer(gl, this.probeTexture);
    this.probeReadBuffer = new Float32Array(4);

    this.dropProgram = createFullscreenProgram(gl, shaderSources.dropSrc);
    this.dropUniforms = {
      prev: gl.getUniformLocation(this.dropProgram, 'uPrev'),
      center: gl.getUniformLocation(this.dropProgram, 'uCenter'),
      radius: gl.getUniformLocation(this.dropProgram, 'uRadius'),
      strength: gl.getUniformLocation(this.dropProgram, 'uStrength'),
    };

    this.updateProgram = createFullscreenProgram(gl, shaderSources.updateSrc);
    this.updateUniforms = {
      prev: gl.getUniformLocation(this.updateProgram, 'uPrev'),
      texel: gl.getUniformLocation(this.updateProgram, 'uTexel'),
      waveSpeed: gl.getUniformLocation(this.updateProgram, 'uWaveSpeed'),
      damping: gl.getUniformLocation(this.updateProgram, 'uDamping'),
      dt: gl.getUniformLocation(this.updateProgram, 'uDt'),
    };

    this.normalProgram = createFullscreenProgram(gl, shaderSources.normalSrc);
    this.normalUniforms = {
      height: gl.getUniformLocation(this.normalProgram, 'uHeight'),
      texel: gl.getUniformLocation(this.normalProgram, 'uTexel'),
    };

    this.probeProgram = createFullscreenProgram(gl, shaderSources.probeSrc);
    this.probeUniforms = {
      height: gl.getUniformLocation(this.probeProgram, 'uHeight'),
      normal: gl.getUniformLocation(this.probeProgram, 'uNormal'),
      center: gl.getUniformLocation(this.probeProgram, 'uProbeCenter'),
    };

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  get heightTexture() {
    return this.heightTextures[this.currentIndex];
  }

  get velocityTexture() {
    return this.heightTextures[this.currentIndex];
  }

  get normalTextureHandle() {
    return this.normalTexture;
  }

  addDrop(x, z, radius, strength) {
    const gl = this.gl;
    const uv = [(x * 0.5) + 0.5, (z * 0.5) + 0.5];
    const radiusUv = radius * 0.5;

    const sourceIndex = this.currentIndex;
    const targetIndex = (this.currentIndex + 1) % 2;

    gl.useProgram(this.dropProgram);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers[targetIndex]);
    gl.viewport(0, 0, this.size, this.size);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.heightTextures[sourceIndex]);
    gl.uniform1i(this.dropUniforms.prev, 0);
    gl.uniform2f(this.dropUniforms.center, uv[0], uv[1]);
    gl.uniform1f(this.dropUniforms.radius, radiusUv);
    gl.uniform1f(this.dropUniforms.strength, strength);

    this.quad.draw();

    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    this.currentIndex = targetIndex;
  }

  step(dt) {
    const gl = this.gl;
    const sourceIndex = this.currentIndex;
    const targetIndex = (this.currentIndex + 1) % 2;

    gl.useProgram(this.updateProgram);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers[targetIndex]);
    gl.viewport(0, 0, this.size, this.size);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.heightTextures[sourceIndex]);
    gl.uniform1i(this.updateUniforms.prev, 0);
    gl.uniform2f(this.updateUniforms.texel, this.texel[0], this.texel[1]);
    gl.uniform1f(this.updateUniforms.waveSpeed, this.settings.waveSpeed);
    gl.uniform1f(this.updateUniforms.damping, this.settings.damping);
    gl.uniform1f(this.updateUniforms.dt, dt);

    this.quad.draw();

    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    this.currentIndex = targetIndex;
  }

  updateNormals() {
    const gl = this.gl;
    gl.useProgram(this.normalProgram);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.normalFramebuffer);
    gl.viewport(0, 0, this.size, this.size);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.heightTextures[this.currentIndex]);
    gl.uniform1i(this.normalUniforms.height, 0);
    gl.uniform2f(this.normalUniforms.texel, this.texel[0], this.texel[1]);

    this.quad.draw();

    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  sampleProbe(x, z) {
    const gl = this.gl;
    gl.useProgram(this.probeProgram);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.probeFramebuffer);
    gl.viewport(0, 0, 1, 1);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.heightTextures[this.currentIndex]);
    gl.uniform1i(this.probeUniforms.height, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.normalTexture);
    gl.uniform1i(this.probeUniforms.normal, 1);

    gl.uniform2f(this.probeUniforms.center, x, z);

    this.quad.draw();

    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, this.probeReadBuffer);

    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    const height = this.probeReadBuffer[0];
    const normalX = this.probeReadBuffer[1] * 2 - 1;
    const normalZ = this.probeReadBuffer[2] * 2 - 1;

    return {
      height,
      normalX,
      normalZ,
    };
  }
}
