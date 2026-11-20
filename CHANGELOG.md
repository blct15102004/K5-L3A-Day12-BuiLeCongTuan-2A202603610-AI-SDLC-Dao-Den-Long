# Changelog — Đảo Đèn Lồng

## [Phase 3 / Contract v1.2] — TICKET-03: "Lanterns Run Out of Fuel"

### Breaking Changes (`[REPLACED]` from Contract v1.0 / v1.1)
- **Lantern Fuel & Refueling**: Lit lanterns now start at `fuel = 100`, decay passively at `1.0/s` (`1/60` per tick), and extinguish (`lantern_out`) when `fuel <= 0`. Lit lanterns with `fuel < 100` can be refueled (`+10` fuel per firefly). Previously lit lanterns (`ever_lit: true`) cost `5` fireflies to relight instead of `10`.
- **Safe Zone Threshold & Shadow `drain` State**: Lanterns with `fuel < 30` lose their `6 m` safe zone. Wandering Shades target low-fuel lanterns (`fuel < 30`) and drain `5 fuel/s` within `<= 2 m` (`state: "drain"`). Refueling a lantern to `>= 30` pushes nearby Shades out over `<= 30` ticks.
- **Dawn-Only Win Condition**: Lighting all lanterns no longer ends the Night early (`all_lit` deprecated). Nights now last `240s / 270s / 300s` (Nights 1/2/3). Winning requires surviving until dawn with `>= ceil(0.6 * total_lanterns)` lit (`3/5`, `4/6`, `5/7`), emitting `game_over` with `reason: "dawn_survived"`.
- **Scoring Overhaul**:
  - Firefly deposited (light, relight, or refuel): `+5` (was `+10`).
  - Initial lantern light: `+100`; Relight: `+40`.
  - Pulse hit: `+5` normal, `+15` if Shade was in `drain` state.
  - Dawn bonus (win only): `+50 + floor(fuel)` per lit lantern + `+50` per remaining Flame. Time bonus (`per_second_left`) removed.
- **Progressive Carrying Capacity**: Starts at `10` per Night and increases by `+2` per `successful_lights` up to `20`.
- **Colorblind / High-Contrast Mode**: Persistent setting switching Shade outline/eyes to `#00B3FF`, UI warnings to `#FFFFFF` with `⚠`, plus 20% vertical compression and paper-tear visuals on unlit lanterns.
- **Test Contract v1.2**: Updated `game.contract.json`, snapshot fields (`lanterns[].{fuel, ever_lit, relit_count}`, `player.capacity`), scenario fields (`player.successful_lights`, `lanterns[].{fuel, ever_lit}`, `shades[].target_lantern_id`), and events (`refuel`, `lantern_out`, `fuel_drain`, `lantern_lit.relight`).

## [Phase 2 / Contract v1.1] — TICKET-02: "Ba hòn đảo"
- Standardized physics/tuning, added Jump, Dash, Fall/Respawn, Night 2 (Đảo Cau) & Night 3 (Đảo Chuông), Drifters (Gió Lạc), Wind Charms, 3-Night campaign UI, Pause, Settings, Audio, and Standard Palette.

## [Phase 1 / Contract v1.0] — PRD-0: "Đảo Bến"
- Initial 3D WebGL game, deterministic 60Hz core engine, and headless CLI.
