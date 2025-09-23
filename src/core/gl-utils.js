const FULLSCREEN_VERT = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

export function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${info}\n${source}`);
  }
  return shader;
}

export function createProgram(gl, vertexSrc, fragmentSrc, attribLocations = {}) {
  const program = gl.createProgram();
  const vs = compileShader(gl, gl.VERTEX_SHADER, vertexSrc);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSrc);
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  Object.entries(attribLocations).forEach(([name, location]) => {
    gl.bindAttribLocation(program, location, name);
  });
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    throw new Error(`Program link error: ${info}`);
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  return program;
}

export function createFullscreenProgram(gl, fragmentSrc) {
  return createProgram(gl, FULLSCREEN_VERT, fragmentSrc, { aPosition: 0 });
}

export function createTexture(gl, width, height, {
  internalFormat = gl.RGBA16F,
  format = gl.RGBA,
  type = gl.FLOAT,
  minFilter = gl.LINEAR,
  magFilter = gl.LINEAR,
  wrapS = gl.CLAMP_TO_EDGE,
  wrapT = gl.CLAMP_TO_EDGE,
  data = null,
} = {}) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, magFilter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapS);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapT);
  if (data) {
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, format, type, data);
  } else {
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, format, type, null);
  }
  gl.bindTexture(gl.TEXTURE_2D, null);
  return texture;
}

export function createFramebuffer(gl, texture) {
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (status !== gl.FRAMEBUFFER_COMPLETE) {
    throw new Error(`Framebuffer incomplete: ${status.toString(16)}`);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return fb;
}

export function createFullscreenQuad(gl) {
  const quadBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([
      -1, -1,
      1, -1,
      -1, 1,
      1, 1,
    ]),
    gl.STATIC_DRAW,
  );
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  return {
    buffer: quadBuffer,
    draw() {
      const wasCullEnabled = gl.isEnabled(gl.CULL_FACE);
      if (wasCullEnabled) {
        gl.disable(gl.CULL_FACE);
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.disableVertexAttribArray(0);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
      if (wasCullEnabled) {
        gl.enable(gl.CULL_FACE);
      }
    },
  };
}

export function resizeCanvasToDisplaySize(canvas) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    return true;
  }
  return false;
}

export function assertExtensions(gl) {
  const floatColorBuffer = gl.getExtension('EXT_color_buffer_float');
  if (!floatColorBuffer) {
    throw new Error('Required EXT_color_buffer_float extension not available.');
  }
  gl.getExtension('OES_texture_float_linear');
}
