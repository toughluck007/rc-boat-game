const KEY_BINDINGS = {
  throttle: new Set(['KeyW', 'ArrowUp']),
  brake: new Set(['KeyS', 'ArrowDown']),
  left: new Set(['KeyA', 'ArrowLeft']),
  right: new Set(['KeyD', 'ArrowRight']),
  reset: new Set(['KeyR']),
};

export class InputState {
  constructor() {
    this.throttle = 0;
    this.brake = 0;
    this.steer = 0;
    this.resetRequested = false;
    this.dropRequests = [];
  }

  consumeReset() {
    const value = this.resetRequested;
    this.resetRequested = false;
    return value;
  }

  consumeDrops() {
    const drops = this.dropRequests.slice();
    this.dropRequests.length = 0;
    return drops;
  }
}

export class Input {
  constructor(targetElement) {
    this.target = targetElement;
    this.keysDown = new Set();
    this.state = new InputState();

    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onMouseDown = this.onMouseDown.bind(this);

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.target.addEventListener('mousedown', this.onMouseDown);
  }

  dispose() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.target.removeEventListener('mousedown', this.onMouseDown);
  }

  onKeyDown(event) {
    this.keysDown.add(event.code);
    event.preventDefault();
  }

  onKeyUp(event) {
    this.keysDown.delete(event.code);
    event.preventDefault();
  }

  onMouseDown(event) {
    const rect = this.target.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    this.state.dropRequests.push({ x, y });
  }

  update() {
    this.state.throttle = this.hasAny(KEY_BINDINGS.throttle) ? 1 : 0;
    this.state.brake = this.hasAny(KEY_BINDINGS.brake) ? 1 : 0;
    const steerLeft = this.hasAny(KEY_BINDINGS.left) ? -1 : 0;
    const steerRight = this.hasAny(KEY_BINDINGS.right) ? 1 : 0;
    this.state.steer = steerLeft + steerRight;
    if (this.hasAny(KEY_BINDINGS.reset)) {
      this.state.resetRequested = true;
    }
    return this.state;
  }

  hasAny(bindingSet) {
    for (const key of bindingSet) {
      if (this.keysDown.has(key)) {
        return true;
      }
    }
    return false;
  }
}
