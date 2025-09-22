function formatTime(seconds) {
  if (Number.isNaN(seconds)) {
    return '--:--.---';
  }
  const totalMs = Math.max(0, Math.floor(seconds * 1000));
  const minutes = Math.floor(totalMs / 60000);
  const secondsPart = Math.floor((totalMs % 60000) / 1000);
  const msPart = totalMs % 1000;
  return `${minutes.toString().padStart(2, '0')}:${secondsPart
    .toString()
    .padStart(2, '0')}.${msPart.toString().padStart(3, '0')}`;
}

export class HUD {
  constructor(root) {
    this.root = root;
    this.container = document.createElement('div');
    this.container.style.position = 'absolute';
    this.container.style.top = '1.5rem';
    this.container.style.left = '50%';
    this.container.style.transform = 'translateX(-50%)';
    this.container.style.textAlign = 'center';
    this.container.style.fontSize = '1.1rem';
    this.container.style.textShadow = '0 1px 4px rgba(0,0,0,0.8)';

    this.timerEl = document.createElement('div');
    this.timerEl.style.fontSize = '2rem';
    this.timerEl.style.fontWeight = '600';

    this.deltaEl = document.createElement('div');
    this.deltaEl.style.marginTop = '0.2rem';
    this.deltaEl.style.opacity = '0.85';

    this.statusEl = document.createElement('div');
    this.statusEl.style.marginTop = '0.6rem';
    this.statusEl.style.fontSize = '0.9rem';
    this.statusEl.style.opacity = '0.75';

    this.container.appendChild(this.timerEl);
    this.container.appendChild(this.deltaEl);
    this.container.appendChild(this.statusEl);
    this.root.appendChild(this.container);

    this.sideContainer = document.createElement('div');
    this.sideContainer.style.position = 'absolute';
    this.sideContainer.style.bottom = '1.5rem';
    this.sideContainer.style.left = '1.5rem';
    this.sideContainer.style.fontSize = '1rem';
    this.sideContainer.style.textShadow = '0 1px 4px rgba(0,0,0,0.8)';

    this.speedEl = document.createElement('div');
    this.checkpointEl = document.createElement('div');

    this.sideContainer.appendChild(this.speedEl);
    this.sideContainer.appendChild(this.checkpointEl);
    this.root.appendChild(this.sideContainer);
  }

  update({
    lapTime,
    bestLap,
    lapDelta,
    speed,
    checkpointIndex,
    totalCheckpoints,
    message,
  }) {
    this.timerEl.textContent = formatTime(lapTime ?? 0);
    if (Number.isFinite(lapDelta)) {
      const sign = lapDelta >= 0 ? '+' : '−';
      this.deltaEl.textContent = `${sign}${formatTime(Math.abs(lapDelta))}`;
      this.deltaEl.style.color = lapDelta <= 0 ? '#8bf5b5' : '#f5938b';
    } else if (Number.isFinite(bestLap)) {
      this.deltaEl.textContent = `PB ${formatTime(bestLap)}`;
      this.deltaEl.style.color = '#9fc9ff';
    } else {
      this.deltaEl.textContent = 'Set a lap!';
      this.deltaEl.style.color = '#9fc9ff';
    }
    this.speedEl.textContent = `Speed: ${(speed ?? 0).toFixed(2)} u/s`;
    this.checkpointEl.textContent = `Checkpoint: ${checkpointIndex}/${totalCheckpoints}`;
    this.statusEl.textContent = message ?? '';
  }
}
