export const WATER_SETTINGS = {
  size: 256,
  damping: 0.015,
  waveSpeed: 0.9,
  impulseStrength: 0.04,
};

export const BOAT_SETTINGS = {
  mass: 1.0,
  draft: 0.035,
  buoyK: 60,
  buoyDamp: 8,
  linDrag: 1.2,
  latDrag: 6.0,
  thrust: 2.2,
  rudderPower: 2.4,
  turnDrag: 1.8,
  wakeStrength: 0.02,
  wakeRadius: 0.02,
};

export const TRACK_SETTINGS = {
  width: 0.12,
  maskResolution: 512,
};

export const CAMERA_SETTINGS = {
  eye: [0.0, 1.5, 1.6],
  target: [0.0, 0.0, 0.0],
  up: [0, 1, 0],
  fov: 45 * (Math.PI / 180),
  near: 0.1,
  far: 10,
};

export const ENVIRONMENT_SETTINGS = {
  sunDirection: [0.3, 0.8, 0.4],
  skyColor: [0.10, 0.18, 0.28],
  waterDeepColor: [0.02, 0.07, 0.12],
  waterShallowColor: [0.08, 0.18, 0.26],
};
