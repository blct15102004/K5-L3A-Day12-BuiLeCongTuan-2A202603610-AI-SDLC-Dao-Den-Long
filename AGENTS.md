# AGENTS.md — AI Harness & Rules for "Đảo Đèn Lồng"

## 1. Project Overview & Rules
- **Project**: Đảo Đèn Lồng (Lantern Island) — 3D Third-person game + Deterministic Headless Game Engine across 3 Nights (Đảo Bến, Đảo Cau, Đảo Chuông).
- **Tech Stack**:
  - Core Game Engine: Pure JavaScript (ES modules, **zero native or Node.js dependencies**, browser-safe & headless-safe, deterministic, 60 ticks/s).
  - Headless CLI & Harnesses: Node.js CLIs complying with `Test Contract v1.3` (`cli.js`, `bench.js`, `soak.js`).
  - 3D Renderer & Audio: Zero-dependency Pure WebGL 3D Renderer (`src/render/webgl-renderer.js`) + Procedural Web Audio API (`src/render/audio.js`) + Zero-dependency Node.js static & leaderboard server (`src/server.js`).
- **Execution Rules**:
  - Code must run cross-platform (macOS, Linux, Windows) with `<= 3` commands.
  - On Windows PowerShell, separate commands with `;` (never `&&`).
  - Never break the Test Contract: headless output must remain strictly identical across multiple runs with identical seed/night/scenario/inputs.
  - `src/core/` and `src/render/` MUST NEVER import `node:*` modules (like `node:fs` or `node:path`) or assume Node-only globals, because `src/core/` is imported directly by BOTH Node.js CLI/tests and the Browser UI.
  - Creative additions MUST NOT alter headless determinism and MUST remain disabled in `benchmarkMode` / soak scenes.
  - Verification is mandatory: run the `verify-phase` skill (`.agents/skills/verify-phase/SKILL.md`) before finishing or tagging any phase.

## 2. Key Commands
- **Install**: `npm install`
- **Run 3D Game (UI + Leaderboard API)**: `npm start` or `node src/server.js` (starts server on `http://127.0.0.1:3000`)
- **Export Leaderboard**: `node src/server.js --export-leaderboard <out.json>`
- **Run Headless Contract**: `node src/headless/cli.js --seed <int> --night <1|2|3> [--scenario <file.json>] [--inputs <file.json>] --ticks <int> --out <file.jsonl> [--snapshot-every <int>]`
- **Run 3D Benchmark**: `node src/headless/bench.js --seed 42 --duration 30 --out bench.json`
- **Run Soak Test**: `node src/headless/soak.js --seed 7 --nights 10 --out soak.json`
- **Run All Tests**: `npm test`

## 3. Architecture & Separation of Concerns
```
src/
├── core/            # PURE GAME LOGIC (Browser-safe & Headless-safe, deterministic)
│   ├── constants.js # Contract v1.3 tuning, physics constants, standard color palette
│   ├── maps.js      # Night 1/2/3 geometry, ground height, ramps, cliffs, launch pads, obstacles
│   ├── prng.js      # Deterministic Mulberry32 PRNG
│   ├── leaderboard.js # Player name validation, ISO timezone timestamp, Top-10 sorting
│   └── game.js      # Strict 12-step 60Hz tick loop, fuel/drain state machine, benchmark scene
├── headless/        # CLI Runners for Test Contract v1.3
│   ├── cli.js       # Argument parser, scenario/input loader, JSONL emitter
│   ├── soak.js      # Multi-night consecutive headless stability & RSS leak test
│   └── bench.js     # Ephemeral HTTP server + Chrome/Edge 1280x720 WebGL FPS harness
└── render/          # 3D Visuals, Audio, Accessibility & HUD (Browser only)
    ├── matrix4.js   # 4x4 matrix math, zero-alloc setTRS & 3D->2D screen projection
    ├── audio.js     # Procedural Web Audio synthesizer + BGM + volume control
    ├── webgl-renderer.js # Multi-night WebGL renderer, VBO cache, low-poly batching, colorblind palette
    └── main.js      # 3-Night campaign UI, key rebinding, subtitles, reduced motion, leaderboard UI
```

## 4. Contract v1.3 Compliance Rules
- **12-Step Tick Order (MANDATORY)**:
  1. Read input & handle `pause` toggle (if newly paused, increment `tick` only and stop step).
  2. Decrement timers (`timeLeft`, `invuln`, `dash`, `dashCd`, `pulseCd`, `charm`, `respawn`, shade/drifter timers, dropped mote `ttl`, charm `respawn`, wind cycle) & lantern `fuel` (`1.0/s` when lit; disabled in `benchmarkMode`).
  3. Move Mây (walk/dash/jump/launch pad/wind), resolve cliffs/Bell Tower, check fall (`Y < -10`).
  4. Pickup motes (`XZ <= 1.0`, `|dY| <= 1.5`) and wind charms (disabled in `benchmarkMode`).
  5. Interact with nearest eligible lantern (`XZ <= 2.0`, lowest ID tie-break) to light (`10`), relight (`5`), or refuel (`+10/mote`, `+5` score/mote; disabled in `benchmarkMode`).
  6. Update safe zones (`6.0 m` around lit lanterns with `fuel >= 30`; push inside shades out in `<= 30` ticks).
  7. Pulse (`3` motes, `5.0 m` 3D from `feet + 0.8 m`, `120` ticks stun, `4.0 m` horizontal push over `15` ticks, `+5` or `+15` for `drain`; disabled in `benchmarkMode`).
  8. Move Shades (`spawning|wander|chase|drain|recoil|stunned`; only `wander` in `benchmarkMode`) and Drifters (`idle|chase|flee|removed`).
  9. Collisions: Drifters steal first (`XZ <= 1.2`), then Shades hit (`XZ <= 1.0`, `|dY| <= 1.5`, ascending ID; disabled in `benchmarkMode`).
  10. Periodic spawns (motes, shades, drifters; interactive starting next tick; disabled in `benchmarkMode`).
  11. Check win/loss (`flames <= 0` -> `no_flames`; `timeLeft <= 0` -> `dawn_survived` if `lit >= ceil(0.6 * total)`, else `dawn`; disabled in `benchmarkMode`).
  12. Emit snapshot if `tick % snapshotEvery === 0`.
- **Integer-Tick Timers**: Represent fuel units (`60 units/s`), cooldowns, durations, and TTLs as integers to prevent floating-point drift across runs.
- **Coordinate & Angle Conventions**:
  - `x = cx + r * cos(rad)`, `z = cz + r * sin(rad)` (angles measured from `+X`).
  - Input frame direction: `x' = x*cos(θ) + z*sin(θ)`, `z' = -x*sin(θ) + z*cos(θ)`.
  - Round output coordinates and times to 3 decimal places (`Math.round(v * 1000) / 1000`, `fuel` to 1 decimal place).
