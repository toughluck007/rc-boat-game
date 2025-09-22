import { TRACK_SETTINGS } from '../core/tuning.js';

function segmentDistance(px, pz, ax, az, bx, bz) {
  const abx = bx - ax;
  const abz = bz - az;
  const apx = px - ax;
  const apz = pz - az;
  const abLenSq = abx * abx + abz * abz;
  let t = 0;
  if (abLenSq > 0) {
    t = (apx * abx + apz * abz) / abLenSq;
  }
  t = Math.max(0, Math.min(1, t));
  const cx = ax + abx * t;
  const cz = az + abz * t;
  const dx = px - cx;
  const dz = pz - cz;
  return Math.hypot(dx, dz);
}

function polylineDistance(points, x, z) {
  let minDist = Infinity;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const dist = segmentDistance(x, z, a.x, a.z, b.x, b.z);
    if (dist < minDist) {
      minDist = dist;
    }
  }
  return minDist;
}

function normalize2(vx, vz) {
  const len = Math.hypot(vx, vz);
  if (len === 0) {
    return [0, 0];
  }
  return [vx / len, vz / len];
}

export class Track {
  constructor(gl, settings = TRACK_SETTINGS) {
    this.settings = settings;
    this.points = this.createOvalCourse();
    this.maskSize = settings.maskResolution;
    this.maskData = new Uint8Array(this.maskSize * this.maskSize);
    this.maskTexture = this.createMaskTexture(gl);
    this.checkpoints = this.createCheckpoints();
    this.startAreaRadius = settings.width * 1.4;

    const start = this.points[0];
    const next = this.points[1];
    const tangent = [next.x - start.x, next.z - start.z];
    const normal = normalize2(tangent[1], -tangent[0]);
    this.startLine = {
      point: { x: start.x, z: start.z },
      normal: { x: normal[0], z: normal[1] },
    };
  }

  createOvalCourse() {
    const points = [];
    const radiusX = 0.72;
    const radiusZ = 0.42;
    const segments = 48;
    for (let i = 0; i < segments; i += 1) {
      const t = (i / segments) * Math.PI * 2;
      const wobble = 0.05 * Math.sin(t * 3.0);
      const x = Math.cos(t) * (radiusX + wobble);
      const z = Math.sin(t) * (radiusZ + wobble * 0.6);
      points.push({ x, z });
    }
    return points;
  }

  createMaskTexture(gl) {
    const size = this.maskSize;
    const width = this.settings.width;
    const falloff = width * 0.5;
    const data = this.maskData;
    for (let y = 0; y < size; y += 1) {
      const v = y / (size - 1);
      const z = v * 2 - 1;
      for (let x = 0; x < size; x += 1) {
        const u = x / (size - 1);
        const wx = u * 2 - 1;
        const dist = polylineDistance(this.points, wx, z);
        let value = 0;
        if (dist <= width) {
          value = 1;
        } else if (dist <= width + falloff) {
          const t = 1 - (dist - width) / falloff;
          value = t * t;
        }
        data[y * size + x] = Math.max(0, Math.min(255, Math.floor(value * 255)));
      }
    }
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R8,
      size,
      size,
      0,
      gl.RED,
      gl.UNSIGNED_BYTE,
      data,
    );
    gl.bindTexture(gl.TEXTURE_2D, null);
    return texture;
  }

  createCheckpoints() {
    const checkpoints = [];
    const total = this.points.length;
    const step = Math.floor(total / 4);
    for (let i = step; i < total; i += step) {
      const point = this.points[i % total];
      checkpoints.push({
        index: checkpoints.length + 1,
        position: { x: point.x, z: point.z },
        radius: this.settings.width * 1.1,
      });
    }
    return checkpoints;
  }

  getMaskTexture() {
    return this.maskTexture;
  }

  getPoints() {
    return this.points;
  }

  getCheckpoints() {
    return this.checkpoints;
  }

  getStartLine() {
    return this.startLine;
  }

  sampleMask(x, z) {
    const size = this.maskSize;
    const u = (x * 0.5 + 0.5) * (size - 1);
    const v = (z * 0.5 + 0.5) * (size - 1);
    const ix = Math.max(0, Math.min(size - 1, Math.floor(u)));
    const iy = Math.max(0, Math.min(size - 1, Math.floor(v)));
    const fx = Math.min(1, Math.max(0, u - ix));
    const fy = Math.min(1, Math.max(0, v - iy));

    const idx = iy * size + ix;
    const ix1 = Math.min(size - 1, ix + 1);
    const iy1 = Math.min(size - 1, iy + 1);
    const idxRight = iy * size + ix1;
    const idxDown = iy1 * size + ix;
    const idxDownRight = iy1 * size + ix1;

    const top = this.maskData[idx] * (1 - fx) + this.maskData[idxRight] * fx;
    const bottom = this.maskData[idxDown] * (1 - fx) + this.maskData[idxDownRight] * fx;
    const value = top * (1 - fy) + bottom * fy;
    return value / 255;
  }

  distanceToTrack(x, z) {
    return polylineDistance(this.points, x, z);
  }

  signedDistanceToStartLine(x, z) {
    const { point, normal } = this.startLine;
    const dx = x - point.x;
    const dz = z - point.z;
    return dx * normal.x + dz * normal.z;
  }
}
