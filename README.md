# Dao Den Long — 3D Third-Person Game & AI SDLC

Video demo: [docs/demo/demo.mp4](docs/demo/demo.mp4) (attached at Phase 4)

## 1. Quick Start (<= 3 commands)

```bash
# 1. Install dependencies
npm install

# 2. Run automated test suite
npm test

# 3. Start 3D game server
npm start
```
After starting the server, open http://localhost:3000 in your web browser.

## 2. Controls

- `W`, `A`, `S`, `D` or Arrow keys: Move character (May)
- `E`: Interact / Deposit motes into lantern
- `Q` or `Space`: Pulse light to push back and stun shades
- Mouse click & drag: Rotate camera view

## 3. Scoring System

- Pick up a mote: +10 points
- Light a lantern: +100 points
- Stun a shade with pulse: +20 points
- Win bonus: +2 points per remaining second, +50 points per remaining flame

## 4. Headless Execution (Test Contract v1.0)

Run the deterministic headless simulator via:
```bash
node src/headless/cli.js --seed 42 --night 1 --ticks 600 --out output.jsonl
```

Supported flags:
- `--seed <int>`: Random seed for deterministic simulation.
- `--night 1`: Night level index.
- `--scenario <file.json>`: Optional scenario configuration.
- `--inputs <file.json>`: Optional scripted inputs.
- `--ticks <int>`: Number of ticks to simulate (60 ticks/s).
- `--out <file.jsonl>`: Output JSONL path.
- `--snapshot-every <int>`: Snapshot frequency (default 10).

## 5. My Creative Additions (Sang tao cua toi)

1. Character styling: May wears a traditional conical hat (non la) with a swaying mini lantern.
2. Procedural Web Audio API sound effects: ambient tones, mote chimes, gong resonant hits, and pulse wooshes with zero external audio assets.
3. Architecture separation: Rendering and audio reside in `src/render/` and are strictly excluded from `src/core/` and `src/headless/`, ensuring 100% compliance with Test Contract v1.0.

## 6. Project Documentation

- [AGENTS.md](AGENTS.md): AI harness and operational guidelines.
- [docs/notes/phase-1-spec-assumptions.md](docs/notes/phase-1-spec-assumptions.md): Requirement specs and assumptions.
- [docs/proof/phase-1-proof.md](docs/proof/phase-1-proof.md): Verification test proofs.
- [docs/notes/ai-log.md](docs/notes/ai-log.md): AI interaction and token accounting.
