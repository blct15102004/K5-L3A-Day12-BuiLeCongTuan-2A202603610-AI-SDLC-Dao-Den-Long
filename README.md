# Dao Den Long — 3D Third-Person Game & AI SDLC

Video demo: [docs/demo/demo.mp4](docs/demo/demo.mp4) (attached at Phase 4)

## 1. Quick Start (<= 3 commands)

```bash
# 1. Install / verify setup
npm install

# 2. Run automated test suite (19 tests + 21,600-tick benchmark)
npm test

# 3. Start 3D game server
npm start
```
After starting the server, open `http://127.0.0.1:3000` (or `http://localhost:3000`) in your web browser.

## 2. Game Overview (Ba Hòn Đảo — Contract v1.2)

- **Đêm 1 — Đảo Bến** (`240s`): Round island (`r=40m`), 5 lanterns (need `>= 3/5` lit at dawn).
- **Đêm 2 — Đảo Cau** (`270s`): Twin islands (`r=28m`) connected by a bamboo bridge and 2 launch pads, 6 lanterns (need `>= 4/6` lit at dawn), Wind Charm (`C1`), and Drifters.
- **Đêm 3 — Đảo Chuông** (`300s`): 3-tier island (`r=45m`), vertical cliffs, 2 ramps (`30°`, `150°`), Tier-2 launch pad, central Bell Tower, 7 lanterns (need `>= 5/7` lit at dawn), Wind gusts, 2 Wind Charms, and Drifters.
- **Fuel & Maintenance**: Lit lanterns decay at `1.0/s`; below `30` fuel they blink (`1 Hz`), lose their `6m` safe zone, and wandering Ink Shadows can drain `5/s`. Refuel lit lanterns (`+10` fuel/firefly) or relight extinguished ones (`5` fireflies). Carrying capacity grows `10 + 2 * successful_lights` (max `20`).
- **Accessibility**: Persistent **High-Contrast / Colorblind Palette** toggle in Settings (`#00B3FF` Ink Shadows, `#FFFFFF` `⚠` alerts, compressed/torn unlit lanterns).

## 3. Controls

- `W`, `A`, `S`, `D` or Arrow keys: Move character (May) (`6.0 m/s`; `7.2 m/s` with Wind Charm)
- `Space`: Jump (`7.0 m/s` vertical velocity)
- `Shift`: Dash (`14.0 m/s` for `0.2s`, cooldown `1.5s`; `0s` with Wind Charm)
- `E`: Interact / Deposit motes into nearest unlit lantern (`<= 2.0m`)
- `Q` or `F`: Pulse light (`3` motes, `5.0m` 3D radius, stuns shades `2.0s` & pushes `4.0m`)
- `Esc` or `P`: Pause / Resume game
- Mouse click & drag: Rotate camera view

## 4. Scoring System (Contract v1.2)

- Deposit firefly into a lantern (initial light, relight, or refuel): **+5 points**
- Initial lantern light: **+100 points** · Relight an extinguished lantern: **+40 points**
- Hit an Ink Shadow with Pulse: **+5 points** (**+15 points** if it was in `drain` state)
- Dawn win bonus (`dawn_survived`): **+50 + floor(fuel)** per lit lantern, **+50** per remaining flame

## 5. Headless Execution (Test Contract v1.1)

Run the deterministic headless simulator via:
```bash
node src/headless/cli.js --seed 42 --night 1 --ticks 600 --out output.jsonl
```

Supported flags:
- `--seed <int>`: Random seed for deterministic simulation.
- `--night <1|2|3>`: Night level index (`1`, `2`, or `3`).
- `--scenario <file.json>`: Optional scenario configuration.
- `--inputs <file.json>`: Optional scripted inputs (`move`, `cam_yaw_deg`, `jump`, `dash`, `interact`, `pulse`, `pause`).
- `--ticks <int>`: Number of ticks to simulate (`60 ticks/s`).
- `--out <file.jsonl>`: Output JSONL path.
- `--snapshot-every <int>`: Snapshot frequency (default `10`).

## 6. My Creative Additions (Sáng tạo của tôi)

1. Character styling: Mây wears a traditional conical hat (nón lá) with a swaying mini lantern and crimson scarf (`#C8102E`) over cream robe (`#E8E2D0`).
2. Procedural Web Audio API soundscape & BGM: pentatonic night ambience loop plus synthesized chimes, gongs, wind warnings, countdown ticks, jump, dash, and pulse SFX with zero external audio assets.
3. Visual VFX & HUD aids: expanding golden pulse shockwave rings, spinning Wind Charm talismans, blowing wind leaves on Night 3, and a dynamic off-screen arrow pointing to the nearest unlit lantern.
4. Strict core/render isolation: all visual and audio code lives in `src/render/` and `index.html`, never touching `src/core/` or altering headless Test Contract v1.1 outputs.

## 7. Project Documentation & Harness

- [AGENTS.md](AGENTS.md): AI harness and architectural compliance rules.
- [.agents/skills/verify-phase/SKILL.md](.agents/skills/verify-phase/SKILL.md): Pre-tag verification skill.
- [docs/notes/phase-1-spec-assumptions.md](docs/notes/phase-1-spec-assumptions.md): Phase 1 specs and assumptions.
- [docs/notes/phase-2-spec-assumptions.md](docs/notes/phase-2-spec-assumptions.md) & [docs/notes/phase-3-spec-assumptions.md](docs/notes/phase-3-spec-assumptions.md): Phase 2 & 3 specs and assumptions.
- [docs/notes/adr-001-lantern-fuel-and-dawn-win.md](docs/notes/adr-001-lantern-fuel-and-dawn-win.md): Phase 3 ADR for lantern fuel & dawn survival.
- [CHANGELOG.md](CHANGELOG.md): Breaking changes across phases.
- [docs/proof/phase-1-proof.md](docs/proof/phase-1-proof.md), [docs/proof/phase-2-proof.md](docs/proof/phase-2-proof.md), [docs/proof/phase-3-proof.md](docs/proof/phase-3-proof.md): Verification proofs.
- [docs/notes/ai-log.md](docs/notes/ai-log.md): AI error analysis and token accounting.
