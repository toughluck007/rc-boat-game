# RC Boat Trials — Game Design Document (WebGL/GLSL Water)

> A lightweight, top‑down/isometric time‑trial racer built on Evan Wallace–style WebGL water (height‑field + raytraced visuals). Minimal art, code‑driven feel, and crunchy water‑boat interaction.

---

## 1) Vision & Pillars

**Vision:** “Micro‑Machines meets a shimmering pool.” The water isn’t just pretty; it’s the track surface and the control surface.

**Pillars**

- **Readable Beauty:** Caustics, reflections, and soft shadows make the pool pop, but gameplay stays high‑contrast and readable.
- **Tactile Water:** Ripples push you. Your wake matters. Boat feel is arcade‑tight, not sim‑fussy.
- **Short Sessions:** 30–90s runs, leaderboard‑worthy.
- **Low Art Footprint:** Code‑generated water, track ribbon, simple boat mesh.

---

## 2) Core Loop

1. Spawn at start gate → countdown.
2. Drive through a small set of checkpoints in order (on‑track).
3. Finish line stops the clock → show time, PB delta, and ghost option.

**Secondary Loop:** unlock harder seeds (procedural tracks), switch boat handling presets.

---

## 3) Game Mode(s)

- **Time Trial (MVP):** single lap, fixed seed or daily seed.
- **Hot‑Lap:** rolling laps, best of N.
- **Ghost Race (stretch):** replay best lap or a downloaded record.

---

## 4) Controls (Keyboard first)

- **Throttle:** W / Up Arrow (1.0) | **Brake/Reverse:** S / Down (−1.0)
- **Steer:** A/D or Left/Right (−1…+1)
- **Drop/Impulse (optional):** Left Click to add a ripple (limited charges) for advanced lines.
- **Reset Boat:** R

Gamepad: RT/LT throttle/brake, left stick steer.

---

## 5) Camera & Presentation

- **Angle:** Top‑down with slight tilt (isometric vibe). Smooth follow + forward look‑ahead.
- **Track Ribbon:** A tinted/darkened band over water, width 6–10% of pool span.
- **HUD:** Timer (ms precision), checkpoint index, speed, off‑track indicator, PB delta.

---

## 6) Technical Overview

- **Platform:** WebGL1/2 (auto‑feature detect). Desktop and modern mobile.
- **Water Sim:** Height‑field (256×256 float) with ping‑pong FBOs; normals precomputed each step.
- **Visuals:** Raytraced pool walls/sphere (optional), refractive water, screen‑space caustics.
- **Boat Physics:** 2D rigid body (x,z) + vertical buoyancy; steering torque, lateral drag, wake‑induced ripples.
- **Track Mask:** 512×512 luminance texture from a polyline ribbon; sampled in gameplay and water shader.
- **Fixed Timestep:** Simulation @ 60 Hz; render variable.

---

## 7) Engine Modules & Responsibilities

- ``: simulation (drop, update, normals), probe FBO for height/normal sampling.
- ``: water surface shader, pool/objects, caustics pass, post.
- ``: boat controller, track generation + mask, checkpoints, lap logic, ghost.
- ``: HUD overlays, settings, seed picker.
- ``: main loop, input, feature checks.

---

## 8) Fixed‑Timestep Loop (authoritative)

**Goal:** consistent feel regardless of refresh rate.

```
// pseudo
acc += clamp(now-prev, 0, 0.1)
while acc >= 1/60 and steps < 5:
  simStep(1/60)
  acc -= 1/60
render()
```

`simStep(dt)` order:

1. `water.step()` ×2
2. `water.updateNormals()`
3. `renderer.updateCaustics(water)` *(toggleable for perf)*
4. `boat.update(dt, water, trackMask)`
5. `lap.update(dt, boat, trackMask)`

---

## 9) Water Simulation (for Codex)

**Data**

- Two RGBA floating‑point textures `A/B` (ping‑pong). R = height; G = velocity (or divergence). B/A can store spare data if needed.
- Normal map texture `N` (RGB packed 0–1 → −1…1).

**Passes**

1. **Drop/Impulse:** add Gaussian impulse to R (height) and/or G (velocity) at mouse/boat wake.
2. **Update:** wave equation via finite differences:
   - `h' = h + v*dt`
   - `v' = v + (c^2 * ∇²h - damping*v) * dt`
   - 5‑point Laplacian; edge clamps for pool walls.
3. **Normals:** `n = normalize(vec3(dH/dx, 1, dH/dz))` via central differences; pack to 0–1.

**Extensions Required**

- WebGL1: `OES_texture_float` (or `OES_texture_half_float`), `OES_texture_float_linear` optional; `OES_standard_derivatives` helps; FBO float attach via `WEBGL_color_buffer_float`.
- WebGL2: prefer `RGBA16F` + `EXT_color_buffer_float`.

**Key Uniforms**

- `uTexel = 1.0 / vec2(simSize)` for derivatives.
- `uDamping`, `uWaveSpeed`, `uImpulseStrength`.

**Edge Handling**

- Clamp or attenuate at borders to avoid reflecting waves too hard (soft wall option).

---

## 10) Water Rendering (for Codex)

**Inputs**: height `h` (R), normals `N`, environment color/sky, light dir.

**Steps**

1. Compute world position from pool plane + height.
2. **Reflection**: sample env or raytrace walls.
3. **Refraction**: offset into pool interior based on normal.
4. **Fresnel** blend between reflection/refraction.
5. **Caustics** (prepass): render water surface as a grid; refract light dir, intersect floor → accumulate intensity in a texture.
6. **Soft shadows**: trace to light against room geometry; cheap hard shadow OK.

**Track Tint**

- Sample `uTrackMask` at water UV and darken albedo slightly for ribbon.

---

## 11) Water Probe (GPU → CPU 1×1)

**Purpose:** let gameplay sample height/normal cheaply.

- 1×1 FBO + fragment shader that samples `heightTex` + `normalTex` at world (x,z) → write packed RGBA.
- `gl.readPixels(1×1)` per frame (two reads max including track check). Modern GPUs handle this fine; stagger to every other frame if needed.

**Probe Packing**

- `R = height` (0–1 normalized to scene scale)
- `G = (nx*0.5+0.5)`
- `B = (nz*0.5+0.5)`
- `A = unused`

---

## 12) Boat Physics (Arcade)

State: `pos(x,y,z)`, `vel(x,y,z)`, `heading`, `angVel`.

**Forces**

- Gravity: `Fy = m*g` (scaled).
- Buoyancy spring: `Fy = K * submersion - D * vy` if `submersion>0`, where `submersion = (waterH - y + draft)`.
- Thrust: `F = thrust * throttle * forward` (y=0 when submerged).
- Linear drag: `F = -c * v`.
- Lateral drag: project velocity on side vector; resist strongly.
- Wave push: scale horizontal normal `(nx,nz)` to give ripple “kick.”
- Yaw torque: `τ = rudderPower * steer * speed` with angular damping.

**Tunable Defaults (starting)**

- `mass=1.0`, `draft=0.03`, `buoyK=60`, `buoyDamp=8`, `linDrag=1.2`, `latDrag=6`, `thrust=1.8`, `rudderPower=2.2`, `turnDrag=1.6`.

**Wake Impulses**

- On strong accel/turn while submerged → `water.addDrop(x,z,radius≈0.015,strength≈0.02)`.

---

## 13) Track System

**Representation:** polyline in pool space (x,z ∈ [−1,1]); width `w`.

**Mask Rendering:** render full‑screen SDF to a 512×512 luminance texture; mark pixels within distance `≤ w` as 1.0.

**Shader SDF Core (pseudo‑GLSL):**

```
float segDist(vec2 p, vec2 a, vec2 b){
  vec2 ap=p-a, ab=b-a;
  float t=clamp(dot(ap,ab)/dot(ab,ab),0.,1.);
  vec2 c=a+t*ab; return length(p-c);
}
```

**Uses**

- Visual tint in water shader: `mix(albedo, darker, mask)`.
- Gameplay: off‑track slowdown if `mask<0.5` at boat position.
- Checkpoint placement at polyline indices; draw rings (GPU circles) for readability.

---

## 14) Procedural Tracks (MVP)

**Pieces**

- `STRAIGHT(L)`, `ARC(R, ±θ)` with θ in 30° increments.

**Rules**

- Maintain heading; sample centerline at fixed spacing (e.g., 0.08 world units).
- Avoid self‑overlap via coarse AABB + fine SDF tests.
- Force closure after N pieces: steer back toward start with gentle arcs.

**Difficulty Knobs**

- Max curvature per piece, straight variance, ribbon width.

**Seeding**

- `seed` → deterministic RNG for piece picks; expose daily seed for leaderboards.

---

## 15) Lap & Checkpoint Logic

- Start/Finish: oriented line; detect crossing by sign change (side‑of‑line test) while `onTrack`.
- Checkpoints: ordered circles; require pass‑through.
- Timing: ms precision; store best per seed.
- Ghost: record `{t, pos, heading}` at 20 Hz; replay with interpolation.

---

## 16) Performance Targets

- 60 FPS desktop @ 256² water, caustics ON.
- 30–60 FPS mobile @ 256² water, caustics OFF/LOW.

**Switches**

- Water resolution (128/256/512)
- Caustics quality (Off/Low/High)
- Track antialias (FXAA toggle)

**Readback Budget**

- ≤ 2× `gl.readPixels(1×1)` per frame (water probe + track probe).

---

## 17) Accessibility & UX

- Colorblind‑safe HUD, high‑contrast track tint.
- Toggle camera shake and specular intensity.
- Rebind controls.

---

## 18) Asset List

- **Boat Mesh:** simple wedge or box with colored top.
- **Textures:** tiny skybox or solid gradient; optional foam sprite.
- **Audio:** light motor loop, splash, checkpoint ping, finish fanfare.

---

## 19) Milestones

**M1 — Feel First (2–3 days)**

- Fixed timestep; water probe; hardcoded oval track; boat driving; HUD timer.

**M2 — Time Trial (2–3 days)**

- Start/finish; checkpoints; off‑track slowdown; basic UI.

**M3 — Procedural (3–4 days)**

- Piece generator; seed picker; best‑lap save; ghost.

**M4 — Polish (open)**

- Caustics toggle; mobile tuning; sounds; camera look‑ahead; leaderboard hook.

---

## 20) Implementation Notes for Codex

**Folder Skeleton**

```
src/
  core/main.js          // loop, input, feature checks
  water/water.js        // sim passes, normals, addDrop, sampleProbe
  renderer/renderer.js  // water surface, pool, caustics, track tint
  game/boat.js          // Boat class (forces)
  game/track.js         // ribbon SDF mask + sampling
  game/lap.js           // checkpoints & timing
  ui/hud.js             // DOM overlay
shaders/
  water_drop.frag
  water_update.frag
  water_normal.frag
  water_surface.frag
  caustics.frag
  probe.frag
  track_sdf.frag
```

**Critical APIs to Expose**

- `water.addDrop(x,z,radius,strength)`
- `water.sampleProbe(x,z) -> {h, nx, ny, nz}` *(1×1 FBO readback)*
- `track.sample01(uv01) -> [0..1]` *(optional readback)*
- `renderer.setTrackMask(tex)`

**Feature Detection**

- Prefer WebGL2; fallback to WebGL1 with: `OES_texture_float`, `OES_standard_derivatives`, and `EXT_color_buffer_float` (or vendor equivalents). Provide clear error if absent.

**Constants/Tuning** Place all key numbers in a single `tuning.js` or `Settings` panel (sliders):

- Boat: `mass, draft, buoyK, buoyDamp, linDrag, latDrag, thrust, rudderPower, turnDrag`
- Water: `waveSpeed, damping, impulseStrength`
- Track: `width`

**Numerical Stability**

- Clamp `dt ≤ 1/60` inside sim; cap steps per frame to 5.
- Damping `∈ [0.005..0.03]` feels good at 60 Hz.

---

## 21) Shader Stubs (Minimal)

**water\_update.frag (sketch)**

```
precision highp float;
uniform sampler2D uPrev;   // R=h, G=v
uniform vec2 uTexel;       // 1/size
uniform float uC, uDamp, uDt;
varying vec2 vUv;

void main(){
  vec4 p = texture2D(uPrev, vUv);
  float h = p.r, v = p.g;
  float hL = texture2D(uPrev, vUv - vec2(uTexel.x,0.)).r;
  float hR = texture2D(uPrev, vUv + vec2(uTexel.x,0.)).r;
  float hD = texture2D(uPrev, vUv - vec2(0.,uTexel.y)).r;
  float hU = texture2D(uPrev, vUv + vec2(0.,uTexel.y)).r;
  float lap = (hL + hR + hD + hU - 4.0*h);
  v += (uC*uC*lap - uDamp*v)*uDt;
  h += v*uDt;
  gl_FragColor = vec4(h, v, 0.0, 1.0);
}
```

**water\_normal.frag (sketch)**

```
precision highp float;
uniform sampler2D uHeight;
uniform vec2 uTexel;
varying vec2 vUv;
void main(){
  float hL = texture2D(uHeight, vUv - vec2(uTexel.x,0.)).r;
  float hR = texture2D(uHeight, vUv + vec2(uTexel.x,0.)).r;
  float hD = texture2D(uHeight, vUv - vec2(0.,uTexel.y)).r;
  float hU = texture2D(uHeight, vUv + vec2(0.,uTexel.y)).r;
  vec3 n = normalize(vec3((hR-hL), 1.0, (hU-hD)));
  gl_FragColor = vec4(n*0.5+0.5, 1.0);
}
```

**probe.frag (sketch)**

```
precision highp float;
uniform sampler2D uHeight, uNormal;
uniform vec2 uProbeXZ; // in [-1..1]
vec2 xzToUv(vec2 xz){ return xz*0.5 + 0.5; }
void main(){
  vec2 uv = xzToUv(uProbeXZ);
  float h = texture2D(uHeight, uv).r;
  vec3 n = texture2D(uNormal, uv).xyz*2.0-1.0;
  gl_FragColor = vec4(h, n.x*0.5+0.5, n.z*0.5+0.5, 1.0);
}
```

**track\_sdf.frag (sketch)** — see SDF in §13; write 1 inside ribbon.

---

## 22) Tuning Checklist (Playtest)

- Raise `latDrag` to reduce skating.
- Raise `buoyK`/`buoyDamp` if porpoising.
- Increase `thrust` for snap; scale `rudderPower` by speed to avoid spin in place.
- Keep `waveSpeed` low if boat gets too “bouncy.”

---

## 23) Risks & Mitigations

- **GPU Readbacks:** keep to ≤2 small reads/frame; stagger if needed.
- **Mobile WebGL Quirks:** provide quality levels; disable caustics on weak devices.
- **Self‑Intersecting Tracks:** use SDF check during generation; clamp curvature.

---

## 24) Nice‑to‑Haves

- Foam decals along wake (pure visual).
- Dynamic ambient occlusion for pool corners.
- Replay sharing via URL seed + ghost data.

---

## 25) Reference Links

- Evan Wallace’s original WebGL water demo & caustics article (for conceptual grounding).
- MDN WebGL extensions: `OES_texture_float`, `EXT_color_buffer_float`, `OES_standard_derivatives`.

(Integrate the above concepts; code stubs here are minimal and intended for Codex to expand into complete modules consistent with the folder skeleton and APIs.)

