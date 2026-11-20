# AGENTS.md — AI Harness & Rules for "Đảo Đèn Lồng"

## 1. Project Overview & Rules
- **Project**: Đảo Đèn Lồng (Lantern Island) — 3D Third-person game + Deterministic Headless Game Engine.
- **Tech Stack**:
  - Core Game Engine: Pure JavaScript (ES modules, zero native dependencies, deterministic, 60 ticks/s).
  - Headless CLI: Node.js CLI complying with `Test Contract v1.0`.
  - 3D Renderer: Three.js + Vite Web Application.
- **Execution Rules**:
  - Code must run cross-platform (macOS, Linux, Windows) with `<= 3` commands.
  - Never break the Test Contract: headless output must remain strictly identical across multiple runs with identical seed/scenario/inputs.
  - In headless mode, no browser DOM or WebGL APIs can be invoked.
  - Verification is mandatory: every change must pass unit tests and contract validation.

## 2. Key Commands
- **Install dependencies**: `npm install`
- **Run 3D Game (UI)**: `npm start` (or `npx vite`)
- **Run Headless Contract**: `node src/headless/cli.js --seed <int> --night 1 [--scenario <file.json>] [--inputs <file.json>] --ticks <int> --out <file.jsonl>`
- **Run All Tests**: `npm test`

## 3. Architecture & Separation of Concerns
```
src/
├── core/            # PURE GAME LOGIC (Headless-safe, deterministic, math, entities)
│   ├── constants.js # Contract tuning parameters and default settings
│   ├── prng.js      # Deterministic pseudo-random number generator
│   ├── entities.js  # Player, Lantern, Shade, Mote models
│   └── game.js      # 60Hz tick loop, state machine, event dispatcher
├── headless/        # CLI Runner for Test Contract
│   └── cli.js       # Argument parser, scenario/input loader, JSONL emitter
└── render/          # 3D Visuals & Audio (Browser only)
    ├── scene.js     # Three.js lights, island terrain, sky, fog
    ├── character.js # Mây 3D model (Nón lá, small lantern)
    ├── vfx.js       # Pulse shockwave, particle motes, dark ink aura
    └── main.js      # Game loop connecting core game engine to 3D rendering
```

## 4. Contract Compliance Rules
- Coordinate conventions: length in meters, Y is up, island surface at Y = 0, player starts at `(0, 0, 0)`.
- All distances measured horizontally on XZ plane (`sqrt(dx^2 + dz^2) <= radius`).
- Coordinates in JSONL outputs must be rounded to 3 decimal places (`Math.round(v * 1000) / 1000`).
- Input frame direction: $x' = x \cos\theta + z \sin\theta$, $z' = -x \sin\theta + z \cos\theta$ ($\theta$ in radians).
- Any creative visual/audio additions MUST be disabled or strictly insulated from the core logic so they never alter headless output.
