# RC Boat Trials

A prototype WebGL2 RC boat time trial built around a GPU-driven water simulation. The project follows the included game design document and uses a fixed-timestep loop, Evan Wallace–style height-field water, and simple arcade boat physics.

## Features

- GPU height-field water simulation with Gaussian drop impulses and dynamic normal map.
- Water surface shading with Fresnel blend, simple environment lighting, and procedural track tinting.
- Arcade boat physics with buoyancy, thrust, lateral drag, and wake-induced ripples.
- Hard-coded oval time-trial track with checkpoint progression and lap timing HUD.
- Keyboard controls (W/S throttle, A/D steering, R reset) with optional mouse ripples.

## Getting Started

The project is dependency free and served as ES modules. Any static file server can be used for development:

```bash
npx http-server .
# or
python -m http.server
```

Open `http://localhost:8080` (or the port reported by your server) in a WebGL2-capable browser.

## Controls

- **Throttle:** `W` / `↑`
- **Brake/Reverse:** `S` / `↓`
- **Steer:** `A` / `D` or `←` / `→`
- **Reset Boat:** `R`
- **Water Ripple:** Left mouse click

## Notes

- The prototype targets WebGL2. A compatibility notice is shown if WebGL2 is unavailable.
- Performance scales with the GPU. The default water resolution is 256×256 and can be tuned in `src/core/tuning.js`.
