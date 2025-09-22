import { resizeCanvasToDisplaySize } from './gl-utils.js';
import { Input } from './input.js';
import { WaterSystem } from '../water/water.js';
import { Renderer } from '../renderer/renderer.js';
import { Track } from '../game/track.js';
import { Boat } from '../game/boat.js';
import { LapManager } from '../game/lap.js';
import { HUD } from '../ui/hud.js';
import { WATER_SETTINGS } from './tuning.js';

const FIXED_DT = 1 / 60;

function showCompatibilityNotice(message) {
  const notice = document.getElementById('compatibility-notice');
  notice.style.display = 'block';
  notice.textContent = message;
}

function hideCompatibilityNotice() {
  const notice = document.getElementById('compatibility-notice');
  notice.style.display = 'none';
}

function mapPointerToWorld({ x, y }) {
  const worldX = x * 2 - 1;
  const worldZ = (1 - y) * 2 - 1;
  return { x: worldX, z: worldZ };
}

async function init() {
  const canvas = document.getElementById('gl-canvas');
  const overlayRoot = document.getElementById('overlay-root');

  const gl = canvas.getContext('webgl2', { antialias: true, alpha: false });
  if (!gl) {
    showCompatibilityNotice('WebGL2 is required. Please use a modern browser with WebGL2 support.');
    return;
  }

  hideCompatibilityNotice();

  resizeCanvasToDisplaySize(canvas);

  const water = await WaterSystem.create(gl, WATER_SETTINGS);
  water.updateNormals();
  const track = new Track(gl);
  const renderer = await Renderer.create(gl, track);
  const boat = new Boat(track, water);
  const lapManager = new LapManager(track);
  const hud = new HUD(overlayRoot);
  const input = new Input(canvas);

  renderer.resize(canvas.width, canvas.height);

  let accumulator = 0;
  let previousTime = performance.now() / 1000;

  function frameLoop(nowMs) {
    const now = nowMs / 1000;
    const frameDt = Math.min(now - previousTime, 0.1);
    previousTime = now;
    accumulator += frameDt;

    if (resizeCanvasToDisplaySize(canvas)) {
      renderer.resize(canvas.width, canvas.height);
    }

    const controls = input.update();
    if (controls.consumeReset()) {
      boat.reset();
      lapManager.reset();
    }

    const drops = controls.consumeDrops();
    for (const drop of drops) {
      const world = mapPointerToWorld(drop);
      if (Math.abs(world.x) <= 1.05 && Math.abs(world.z) <= 1.05) {
        water.addDrop(world.x, world.z, 0.04, WATER_SETTINGS.impulseStrength);
      }
    }

    while (accumulator >= FIXED_DT) {
      water.step(FIXED_DT * 0.5);
      water.step(FIXED_DT * 0.5);
      water.updateNormals();
      boat.update(FIXED_DT, controls);
      lapManager.update(FIXED_DT, boat);
      accumulator -= FIXED_DT;
    }

    renderer.render({ water, boat });
    hud.update(lapManager.getHUDState(boat));

    requestAnimationFrame(frameLoop);
  }

  requestAnimationFrame(frameLoop);
}

init().catch((err) => {
  console.error(err);
  showCompatibilityNotice('Failed to initialize the renderer. Check console for details.');
});
