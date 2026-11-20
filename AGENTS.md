# AGENTS.md — AI Harness & Rules for "Đảo Đèn Lồng"

## 1. Project Overview & Rules
- **Project**: Đảo Đèn Lồng (Lantern Island) — 3D Third-person game + Deterministic Headless Game Engine across 3 Nights (Đảo Bến, Đảo Cau, Đảo Chuông).
- **Tech Stack**:
  - Core Game Engine: Pure JavaScript (ES modules, **zero native or Node.js dependencies**, browser-safe & headless-safe, deterministic, 60 ticks/s).
  - Headless CLI: Node.js CLI complying with `Test Contract v1.1`.
  - 3D Renderer & Audio: Zero-dependency Pure WebGL 3D Renderer (`src/render/webgl-renderer.js`) + Procedural Web Audio API (`src/render/audio.js`) + Zero-dependency Node.js static server (`src/server.js`).
- **Execution Rules**:
  - Code must run cross-platform (macOS, Linux, Windows) with `<= 3` commands.
  - On Windows PowerShell, separate commands with `;` (never `&&`).
  - Never break the Test Contract: headless output must remain strictly identical across multiple runs with identical seed/night/scenario/inputs.
  - `src/core/` MUST NEVER import `node:*` modules (like `node:fs` or `node:path`) or browser `window`/`document` globals, because `src/core/` is imported directly by BOTH Node.js CLI and the Browser UI.
  - Verification is mandatory: run the `verify-phase` skill (`.agents/skills/verify-phase/SKILL.md`) before finishing or tagging any phase.

## 2. Key Commands
- **Install**: `npm install`
- **Run 3D Game (UI)**: `npm start` (starts static server on `http://127.0.0.1:3000`)
- **Run Headless Contract**: `node src/headless/cli.js --seed <int> --night <1|2|3> [--scenario <file.json>] [--inputs <file.json>] --ticks <int> --out <file.jsonl> [--snapshot-every <int>]`
- **Run All Tests**: `npm test`

## 3. Architecture & Separation of Concerns
```
src/
├── core/            # PURE GAME LOGIC (Browser-safe & Headless-safe, deterministic)
│   ├── constants.js # Contract v1.1 tuning, physics constants, standard color palette
│   ├── maps.js      # Night 1/2/3 geometry, ground height, ramps, cliffs, launch pads, obstacles
│   ├── prng.js      # Deterministic Mulberry32 PRNG
│   └── game.js      # Strict 12-step 60Hz tick loop, state machine, event dispatcher
├── headless/        # CLI Runner for Test Contract v1.1
│   └── cli.js       # Argument parser, scenario/input loader, JSONL emitter
└── render/          # 3D Visuals, Audio & HUD (Browser only)
    ├── matrix4.js   # 4x4 matrix math & 3D->2D screen projection
    ├── audio.js     # Procedural Web Audio synthesizer + BGM + volume control
    ├── webgl-renderer.js # Multi-night WebGL renderer, palette, VFX rings, wind leaves
    └── main.js      # 3-Night campaign UI, pause/settings modals, HUD, input loop
```

## 4. Contract v1.1 Compliance Rules
- **12-Step Tick Order (MANDATORY)**:
  1. Read input & handle `pause` toggle (if newly paused, increment `tick` only and stop step).
  2. Decrement timers (`timeLeft`, `invuln`, `dash`, `dashCd`, `pulseCd`, `charm`, `respawn`, shade `stateTicksLeft`, drifter `stateTicksLeft`, dropped mote `ttl`, charm `respawn`, wind cycle).
  3. Move Mây (walk/dash/jump/launch pad/wind), resolve cliffs/Bell Tower, check fall (`Y < -10`).
  4. Pickup motes (`XZ <= 1.0`, `|dY| <= 1.5`) and wind charms.
  5. Interact with nearest unlit lantern (`XZ <= 2.0`, tie-break lowest ID); award `+10` per deposited mote & `+100` on lit.
  6. Update safe zones (`6.0 m` around lit lanterns; push inside shades out in `<= 30` ticks).
  7. Pulse (`3` motes, `5.0 m` 3D from `feet + 0.8 m`, `120` ticks stun, `4.0 m` horizontal push over `15` ticks, `+5` per shade).
  8. Move Shades (`spawning|wander|chase|recoil|stunned`) and Drifters (`idle|chase|flee|removed`).
  9. Collisions: Drifters steal first (`XZ <= 1.2`), then Shades hit (`XZ <= 1.0`, `|dY| <= 1.5`, ascending ID).
  10. Periodic spawns (motes, shades, drifters; interactive starting next tick).
  11. Check win/loss (`flames <= 0` -> `no_flames`, `all_lit` -> `won`, `timeLeft <= 0` -> `dawn`).
  12. Emit snapshot if `tick % snapshotEvery === 0`.
- **Integer-Tick Timers**: Represent all cooldowns, durations, and TTLs as integer tick counts (`60 ticks = 1s`) to prevent floating-point drift across runs.
- **Coordinate & Angle Conventions**:
  - `x = cx + r * cos(rad)`, `z = cz + r * sin(rad)` (angles measured from `+X`).
  - Input frame direction: `x' = x*cos(θ) + z*sin(θ)`, `z' = -x*sin(θ) + z*cos(θ)`.
  - Round output coordinates and times to 3 decimal places (`Math.round(v * 1000) / 1000`).
- **Creative Additions**: Any visual, audio, or lore additions MUST stay strictly in `src/render/` and `index.html` so headless JSONL output never changes.
