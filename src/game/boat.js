import { BOAT_SETTINGS } from '../core/tuning.js';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export class Boat {
  constructor(track, water) {
    this.track = track;
    this.water = water;
    this.settings = { ...BOAT_SETTINGS };
    this.position = [0, 0, 0];
    this.velocity = [0, 0, 0];
    this.heading = 0;
    this.angVel = 0;
    this.speed = 0;
    this.onTrack = true;
    this.wakeTimer = 0;
    this.lastProbe = {
      height: 0,
      normalX: 0,
      normalZ: 0,
    };
    this.reset();
  }

  reset() {
    const points = this.track.getPoints();
    const start = points[0];
    const next = points[1];
    const tangent = [next.x - start.x, next.z - start.z];
    const length = Math.hypot(tangent[0], tangent[1]) || 1;
    const forward = [tangent[0] / length, tangent[1] / length];
    this.heading = Math.atan2(forward[0], forward[1]);
    this.position[0] = start.x - forward[0] * 0.15;
    this.position[2] = start.z - forward[1] * 0.15;
    this.position[1] = this.water.sampleProbe(this.position[0], this.position[2]).height + this.settings.draft * 0.5;
    this.velocity[0] = 0;
    this.velocity[1] = 0;
    this.velocity[2] = 0;
    this.angVel = 0;
    this.wakeTimer = 0;
  }

  getForwardVector() {
    return [Math.sin(this.heading), 0, Math.cos(this.heading)];
  }

  getRightVector() {
    return [Math.cos(this.heading), 0, -Math.sin(this.heading)];
  }

  update(dt, input) {
    const {
      mass,
      draft,
      buoyK,
      buoyDamp,
      linDrag,
      latDrag,
      thrust,
      rudderPower,
      turnDrag,
      wakeStrength,
      wakeRadius,
    } = this.settings;

    const probe = this.water.sampleProbe(this.position[0], this.position[2]);
    this.lastProbe = probe;
    const waterHeight = probe.height;
    const normalX = probe.normalX;
    const normalZ = probe.normalZ;

    const forward = this.getForwardVector();
    const right = this.getRightVector();

    const throttleInput = input.throttle - input.brake;
    const steerInput = clamp(input.steer, -1, 1);

    const forces = [0, -9.81 * mass, 0];

    const submersion = waterHeight - this.position[1] + draft;
    if (submersion > 0) {
      forces[1] += buoyK * submersion - buoyDamp * this.velocity[1];
      forces[0] += normalX * submersion * 4.5;
      forces[2] += normalZ * submersion * 4.5;
    }

    const throttleForce = thrust * throttleInput;
    if (submersion > -draft * 0.5) {
      forces[0] += forward[0] * throttleForce;
      forces[2] += forward[2] * throttleForce;
    }

    forces[0] -= this.velocity[0] * linDrag;
    forces[1] -= this.velocity[1] * (linDrag * 0.6);
    forces[2] -= this.velocity[2] * linDrag;

    const lateralSpeed = this.velocity[0] * right[0] + this.velocity[2] * right[2];
    forces[0] -= right[0] * lateralSpeed * latDrag;
    forces[2] -= right[2] * lateralSpeed * latDrag;

    const accelX = forces[0] / mass;
    const accelY = forces[1] / mass;
    const accelZ = forces[2] / mass;

    this.velocity[0] += accelX * dt;
    this.velocity[1] += accelY * dt;
    this.velocity[2] += accelZ * dt;

    this.position[0] += this.velocity[0] * dt;
    this.position[1] += this.velocity[1] * dt;
    this.position[2] += this.velocity[2] * dt;

    this.speed = Math.hypot(this.velocity[0], this.velocity[2]);

    const torque = rudderPower * steerInput * clamp(this.speed, 0, 6);
    this.angVel += (torque - this.angVel * turnDrag) * dt;
    this.heading += this.angVel * dt;

    this.applyBounds();

    const mask = this.track.sampleMask(this.position[0], this.position[2]);
    this.onTrack = mask > 0.35;
    if (!this.onTrack) {
      this.velocity[0] *= 0.985;
      this.velocity[2] *= 0.985;
    }

    this.wakeTimer += dt * Math.max(0.2, this.speed);
    if (submersion > 0.01 && this.wakeTimer > 0.08 && (Math.abs(throttleInput) > 0.2 || Math.abs(steerInput) > 0.2)) {
      this.water.addDrop(this.position[0], this.position[2], wakeRadius, wakeStrength);
      this.wakeTimer = 0;
    }
  }

  applyBounds() {
    const bound = 0.95;
    for (let i = 0; i < 3; i += 2) {
      const idx = i;
      if (this.position[idx] > bound) {
        this.position[idx] = bound;
        this.velocity[idx] *= -0.3;
      } else if (this.position[idx] < -bound) {
        this.position[idx] = -bound;
        this.velocity[idx] *= -0.3;
      }
    }
    if (this.position[1] < -0.4) {
      this.position[1] = -0.4;
      this.velocity[1] = 0;
    }
  }
}
