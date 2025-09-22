export class LapManager {
  constructor(track) {
    this.track = track;
    this.checkpoints = track.getCheckpoints();
    this.reset();
    this.bestLap = null;
    this.lastLapTime = null;
    this.lastLapDelta = null;
  }

  reset() {
    this.currentLapTime = 0;
    this.active = false;
    this.awaitingStart = true;
    this.checkpointHits = 0;
    this.wasInStartArea = true;
  }

  update(dt, boat) {
    const start = this.track.getStartLine().point;
    const radius = this.track.startAreaRadius;
    const dx = boat.position[0] - start.x;
    const dz = boat.position[2] - start.z;
    const distToStart = Math.hypot(dx, dz);
    const inStartArea = distToStart <= radius;

    if (!this.active && this.awaitingStart && !inStartArea && this.wasInStartArea && boat.onTrack) {
      this.startLap();
    }

    if (this.active) {
      this.currentLapTime += dt;
      this.checkCheckpoint(boat);
      const totalCheckpoints = this.checkpoints.length;
      if (
        inStartArea &&
        !this.wasInStartArea &&
        this.currentLapTime > 1.0 &&
        this.checkpointHits >= totalCheckpoints
      ) {
        this.finishLap();
      }
    }

    this.wasInStartArea = inStartArea;
  }

  startLap() {
    this.active = true;
    this.awaitingStart = false;
    this.currentLapTime = 0;
    this.checkpointHits = 0;
    this.lastLapDelta = null;
  }

  finishLap() {
    this.active = false;
    this.awaitingStart = true;
    this.lastLapTime = this.currentLapTime;
    if (this.bestLap == null || this.currentLapTime < this.bestLap) {
      if (this.bestLap != null) {
        this.lastLapDelta = this.currentLapTime - this.bestLap;
      } else {
        this.lastLapDelta = 0;
      }
      this.bestLap = this.currentLapTime;
    } else {
      this.lastLapDelta = this.currentLapTime - this.bestLap;
    }
    this.currentLapTime = 0;
    this.checkpointHits = 0;
  }

  checkCheckpoint(boat) {
    const checkpoint = this.checkpoints[this.checkpointHits];
    if (!checkpoint) {
      return;
    }
    const dx = boat.position[0] - checkpoint.position.x;
    const dz = boat.position[2] - checkpoint.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist <= checkpoint.radius) {
      this.checkpointHits += 1;
    }
  }

  getHUDState(boat) {
    const totalCheckpoints = this.checkpoints.length;
    const lapTime = this.active ? this.currentLapTime : (this.lastLapTime ?? 0);
    const lapDelta = this.active && this.bestLap != null ? this.currentLapTime - this.bestLap : this.lastLapDelta;
    const message = this.active
      ? 'Lap in progress'
      : this.bestLap
        ? 'Leave the gate to start next lap'
        : 'Throttle across the gate to start';

    return {
      lapTime,
      bestLap: this.bestLap,
      lapDelta,
      speed: boat.speed,
      checkpointIndex: Math.min(this.checkpointHits, totalCheckpoints),
      totalCheckpoints,
      message,
    };
  }
}
