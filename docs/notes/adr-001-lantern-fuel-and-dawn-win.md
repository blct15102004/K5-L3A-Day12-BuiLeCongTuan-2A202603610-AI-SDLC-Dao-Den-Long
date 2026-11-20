# ADR-001: Lantern Fuel State Model, Shadow Drain & Dawn-Survival Win Condition

- **Date**: 2026-11-20
- **Status**: Accepted (Phase 3 / TICKET-03, Contract v1.2)

## Context
In Phases 1–2, lighting a lantern was permanent and lighting all lanterns ended the Night immediately. TICKET-03 overhauls this core loop into a survival/maintenance loop where lit lanterns lose fuel passively (`1/s`) and via Ink Shadow draining (`5/s` when `fuel < 30`), can go out (`lantern_out`), can be refueled or relit (`5` fireflies if `ever_lit`), and victory is evaluated only at dawn (`>= ceil(0.6 * total_lanterns)`).

## Decisions

### 1. Integer Fixed-Point Fuel Representation (`1/60` units)
- **Decision**: Store lantern fuel internally as integer units `fuelUnits ∈ [0, 6000]` where `1 unit = 1/60 fuel` (`6000 = 100.0`).
- **Rationale**: Passive decay (`1 unit/tick`) and Shadow drain (`5 units/tick`) execute as exact integer subtractions, eliminating IEEE-754 floating-point drift across 18,000+ ticks and guaranteeing byte-identical determinism across platforms. Output snapshots export `Math.round((fuelUnits / 60) * 10) / 10` (`0` when unlit).

### 2. Lantern Lifecycle & Refuel/Relight Unification
- **Decision**: Each lantern tracks `{ lit, fuelUnits, everLit, relitCount, deposited }`.
  - Unlit lanterns require `everLit ? 5 : 10` fireflies to light; lighting sets `fuelUnits = 6000`, `everLit = true`, increments `successfulLights` (and `relitCount` if `everLit` was already true), and activates the `6 m` safe zone.
  - Lit lanterns with `fuelUnits < 6000` accept `used = min(carried, ceil((6000 - fuelUnits) / 600))` fireflies, adding `used * 600` units (capped at `6000`). If fuel crosses from `< 1800` (`< 30`) to `>= 1800` (`>= 30`), the safe zone reactivates and pushes out any Shadows within `6 m` over `<= 30` ticks.

### 3. Ink Shadow `drain` State Machine
- **Decision**: Add `drain` to the Shadow state set (`spawning | wander | chase | recoil | stunned | drain`).
  - `wander` Shades target the closest lit lantern with `fuel < 30` (tie-break smallest `id`), falling back to the closest unlit lantern.
  - Entering `<= 2 m` of a lit low-fuel lantern transitions `wander -> drain` (stationary, `5 units/tick` stacked additively, emitting `fuel_drain` every 60 ticks).
  - `drain` exits to `chase` if Mây enters `<= 6 m`, `stunned` on Pulse (`+15` score), or `wander` if the lantern extinguishes, reaches `fuel >= 30`, or distance exceeds `2 m`.

### 4. Dawn-Only Win Condition
- **Decision**: Remove early `all_lit` victory from Step 5 / Step 11. Step 11 evaluates:
  1. `flames <= 0` → `lost` (`no_flames`) — checked first even on the final tick.
  2. `timeLeft <= 0` → `won` (`dawn_survived`) if `litCount >= ceil(0.6 * totalLanterns)`, else `lost` (`dawn`).

## Consequences
- All Phase 1–2 tests asserting immediate `all_lit` victory or `+10` per deposited firefly are superseded and updated with documented justification in `CHANGELOG.md` and `docs/notes/phase-3-spec-assumptions.md`.
