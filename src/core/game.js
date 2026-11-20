import { TUNING, DEFAULT_LANTERNS } from './constants.js';
import { PRNG } from './prng.js';

export function round3(v) {
  return Math.round(v * 1000) / 1000;
}

export function distXZ(a, b) {
  const dx = a[0] - b[0];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dz * dz);
}

export class GameEngine {
  constructor(options = {}) {
    this.seed = options.seed ?? 42;
    this.prng = new PRNG(this.seed);
    this.tuning = { ...TUNING, ...(options.tuning || {}) };

    this.tickCount = 0;
    this.simTick = 0;
    this.state = 'playing'; // 'playing' | 'won' | 'lost'
    this.gameOverReason = null; // 'all_lit' | 'dawn' | 'no_flames'
    this.score = 0;

    this.totalDuration = this.tuning.night1_duration_s;
    this.timeLeft = this.totalDuration;

    // Player state
    this.player = {
      pos: [0, 0, 0],
      carried: 0,
      flames: this.tuning.flames,
      invulnTimer: 0,
      pulseCooldownTimer: 0
    };

    // Lanterns
    this.lanterns = DEFAULT_LANTERNS.map(l => ({ ...l, pos: [...l.pos] }));

    // Entities
    this.motes = [];
    this.shades = [];

    this.shadeCounter = 1;
    this.moteCounter = 1;

    // Previous button states for edge detection (false -> true)
    this.prevButtons = {
      jump: false,
      interact: false,
      pulse: false,
      dash: false
    };

    // Event queue for the current tick
    this.events = [];

    // Initialize from scenario if provided
    this.initScenario(options.scenario);
  }

  initScenario(scenario) {
    if (!scenario) {
      this.initDefaultWorld();
      return;
    }

    // Time left
    if (typeof scenario.time_left_s === 'number') {
      this.timeLeft = scenario.time_left_s;
      this.totalDuration = scenario.time_left_s;
    }

    // Player
    if (scenario.player) {
      if (Array.isArray(scenario.player.pos)) {
        this.player.pos = [...scenario.player.pos];
      }
      if (typeof scenario.player.carried === 'number') {
        this.player.carried = scenario.player.carried;
      }
      if (typeof scenario.player.flames === 'number') {
        this.player.flames = scenario.player.flames;
      }
    }

    // Lanterns override
    if (Array.isArray(scenario.lanterns)) {
      for (const item of scenario.lanterns) {
        const found = this.lanterns.find(l => l.id === item.id);
        if (found) {
          if (Array.isArray(item.pos)) found.pos = [...item.pos];
          if (typeof item.deposited === 'number') found.deposited = item.deposited;
          if (typeof item.lit === 'boolean') found.lit = item.lit;
        } else {
          this.lanterns.push({
            id: item.id,
            pos: Array.isArray(item.pos) ? [...item.pos] : [0, 0, 0],
            deposited: item.deposited || 0,
            lit: item.lit || false
          });
        }
      }
    }

    // Motes
    if (scenario.motes !== undefined) {
      this.motes = scenario.motes.map((m, idx) => {
        const pos = Array.isArray(m) ? [...m] : [...m.pos];
        const id = m.id || `M${idx + 1}`;
        return { id, pos };
      });
      this.moteCounter = this.motes.length + 1;
    } else if (scenario.random_motes !== false) {
      this.spawnInitialMotes(20);
    }

    // Shades
    if (scenario.shades !== undefined) {
      this.shades = scenario.shades.map((s, idx) => {
        const id = s.id || `S${idx + 1}`;
        const pos = Array.isArray(s.pos) ? [...s.pos] : [0, 0, 0];
        return {
          id,
          pos,
          state: s.state || 'chase',
          stunTimer: 0
        };
      });
      this.shadeCounter = this.shades.length + 1;
    } else if (scenario.random_shades !== false) {
      this.spawnInitialShades(4);
    }
  }

  initDefaultWorld() {
    this.spawnInitialMotes(20);
    this.spawnInitialShades(4);
  }

  spawnInitialMotes(count) {
    for (let i = 0; i < count; i++) {
      const angle = this.prng.range(0, Math.PI * 2);
      const r = this.prng.range(5, 36);
      const x = r * Math.cos(angle);
      const z = r * Math.sin(angle);
      this.motes.push({
        id: `M${this.moteCounter++}`,
        pos: [round3(x), 0, round3(z)]
      });
    }
  }

  spawnInitialShades(count) {
    for (let i = 0; i < count; i++) {
      const angle = (i * Math.PI * 2) / count + this.prng.range(-0.2, 0.2);
      const r = this.prng.range(28, 35);
      const x = r * Math.cos(angle);
      const z = r * Math.sin(angle);
      const shade = {
        id: `S${this.shadeCounter++}`,
        pos: [round3(x), 0, round3(z)],
        state: 'chase',
        stunTimer: 0
      };
      this.shades.push(shade);
      this.events.push({
        type: 'event',
        tick: 0,
        name: 'shade_spawned',
        data: { id: shade.id }
      });
    }
  }

  /**
   * Run 1 tick with the given input
   * Input format: { move: [x, z], cam_yaw_deg: 0, jump: bool, interact: bool, pulse: bool, dash: bool }
   */
  step(input = {}) {
    if (this.state !== 'playing') {
      return this.events;
    }

    this.events = [];
    const tick = this.tickCount + 1; // Current transition generates tick k+1
    const dt = 1 / 60;

    // 1. Process Timers
    if (this.player.invulnTimer > 0) {
      this.player.invulnTimer = Math.max(0, this.player.invulnTimer - dt);
    }
    if (this.player.pulseCooldownTimer > 0) {
      this.player.pulseCooldownTimer = Math.max(0, this.player.pulseCooldownTimer - dt);
    }

    // Shades stun timers
    for (const shade of this.shades) {
      if (shade.state === 'stunned') {
        shade.stunTimer = Math.max(0, shade.stunTimer - dt);
        if (shade.stunTimer <= 0) {
          shade.state = 'chase';
        }
      }
    }

    // 2. Player Movement
    const move = input.move || [0, 0];
    const mx = move[0] ?? 0;
    const mz = move[1] ?? 0;
    const camYawDeg = input.cam_yaw_deg ?? 0;
    const theta = (camYawDeg * Math.PI) / 180;

    // World direction conversion per contract specification
    let wx = mx * Math.cos(theta) + mz * Math.sin(theta);
    let wz = -mx * Math.sin(theta) + mz * Math.cos(theta);
    const mag = Math.sqrt(wx * wx + wz * wz);
    if (mag > 1.0) {
      wx /= mag;
      wz /= mag;
    }

    const moveDist = this.tuning.player_speed * dt;
    this.player.pos[0] = round3(this.player.pos[0] + wx * moveDist);
    this.player.pos[2] = round3(this.player.pos[2] + wz * moveDist);
    // Y remains 0 in 2D ground plane

    // 3. Button edge detections (false -> true)
    const interactPressed = !!input.interact && !this.prevButtons.interact;
    const pulsePressed = !!input.pulse && !this.prevButtons.pulse;

    this.prevButtons.interact = !!input.interact;
    this.prevButtons.pulse = !!input.pulse;
    this.prevButtons.jump = !!input.jump;
    this.prevButtons.dash = !!input.dash;

    // 4. Mote Pickups
    for (let i = this.motes.length - 1; i >= 0; i--) {
      const mote = this.motes[i];
      const dist = distXZ(this.player.pos, mote.pos);
      if (dist <= this.tuning.pickup_radius && this.player.carried < this.tuning.carry_capacity) {
        this.player.carried += 1;
        this.motes.splice(i, 1);
        this.score += this.tuning.score.per_mote;
        this.events.push({
          type: 'event',
          tick,
          name: 'mote_picked',
          data: { carried: this.player.carried }
        });
      }
    }

    // 5. Lantern Interaction (Deposit & Light)
    if (interactPressed && this.player.carried > 0) {
      for (const lantern of this.lanterns) {
        if (!lantern.lit) {
          const dist = distXZ(this.player.pos, lantern.pos);
          if (dist <= this.tuning.interact_radius) {
            const needed = this.tuning.lantern_cost - lantern.deposited;
            const amount = Math.min(this.player.carried, needed);
            if (amount > 0) {
              this.player.carried -= amount;
              lantern.deposited += amount;
              this.events.push({
                type: 'event',
                tick,
                name: 'deposit',
                data: {
                  lantern_id: lantern.id,
                  amount,
                  deposited: lantern.deposited
                }
              });

              if (lantern.deposited >= this.tuning.lantern_cost) {
                lantern.lit = true;
                this.score += this.tuning.score.per_lantern;
                this.events.push({
                  type: 'event',
                  tick,
                  name: 'lantern_lit',
                  data: { lantern_id: lantern.id }
                });

                // Check Win condition
                if (this.lanterns.every(l => l.lit)) {
                  this.state = 'won';
                  this.gameOverReason = 'all_lit';
                  const secLeft = Math.max(0, Math.floor(this.timeLeft));
                  this.score += secLeft * this.tuning.score.per_second_left;
                  this.score += this.player.flames * this.tuning.score.per_flame_left;
                  this.events.push({
                    type: 'event',
                    tick,
                    name: 'game_over',
                    data: { result: 'won', reason: 'all_lit' }
                  });
                  this.tickCount = tick;
                  this.simTick = tick;
                  return this.events;
                }
              }
            }
          }
        }
      }
    }

    // 6. Pulse Action
    if (pulsePressed && this.player.pulseCooldownTimer <= 0 && this.player.carried >= this.tuning.pulse_cost) {
      this.player.carried -= this.tuning.pulse_cost;
      this.player.pulseCooldownTimer = this.tuning.pulse_cooldown_s;

      const stunnedIds = [];
      for (const shade of this.shades) {
        const dist = distXZ(this.player.pos, shade.pos);
        if (dist <= this.tuning.pulse_radius) {
          // Push away
          let pdx = shade.pos[0] - this.player.pos[0];
          let pdz = shade.pos[2] - this.player.pos[2];
          let pdist = Math.sqrt(pdx * pdx + pdz * pdz);
          if (pdist < 0.001) {
            pdx = 1;
            pdz = 0;
            pdist = 1;
          }
          shade.pos[0] = round3(shade.pos[0] + (pdx / pdist) * this.tuning.pulse_push_m);
          shade.pos[2] = round3(shade.pos[2] + (pdz / pdist) * this.tuning.pulse_push_m);

          shade.state = 'stunned';
          shade.stunTimer = this.tuning.pulse_stun_s;
          stunnedIds.push(shade.id);
          this.score += this.tuning.score.per_stun;
        }
      }

      this.events.push({
        type: 'event',
        tick,
        name: 'pulse',
        data: { stunned_ids: stunnedIds }
      });
    }

    // 7. Shade Movement & Safe Radius Check
    for (const shade of this.shades) {
      if (shade.state === 'chase') {
        const dx = this.player.pos[0] - shade.pos[0];
        const dz = this.player.pos[2] - shade.pos[2];
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > 0.001) {
          const moveStep = this.tuning.shade_speed * dt;
          let nextX = shade.pos[0] + (dx / dist) * moveStep;
          let nextZ = shade.pos[2] + (dz / dist) * moveStep;

          // Safe radius check for lit lanterns
          let blocked = false;
          for (const lantern of this.lanterns) {
            if (lantern.lit) {
              const dToLantern = distXZ([nextX, 0, nextZ], lantern.pos);
              if (dToLantern < this.tuning.safe_radius) {
                blocked = true;
                // Repel to safe radius edge
                const ldx = nextX - lantern.pos[0];
                const ldz = nextZ - lantern.pos[2];
                const ldist = Math.sqrt(ldx * ldx + ldz * ldz);
                if (ldist > 0.001) {
                  nextX = lantern.pos[0] + (ldx / ldist) * this.tuning.safe_radius;
                  nextZ = lantern.pos[2] + (ldz / ldist) * this.tuning.safe_radius;
                }
                break;
              }
            }
          }

          shade.pos[0] = round3(nextX);
          shade.pos[2] = round3(nextZ);
        }

        // 8. Shade Hit Player
        const hitDist = distXZ(shade.pos, this.player.pos);
        if (hitDist <= this.tuning.shade_hit_radius && this.player.invulnTimer <= 0) {
          const dropped = Math.floor(this.player.carried * this.tuning.hit_drop_ratio);
          this.player.carried -= dropped;
          this.player.flames -= 1;
          this.player.invulnTimer = this.tuning.invuln_s;

          // Drop motes on the ground
          for (let d = 0; d < dropped; d++) {
            this.motes.push({
              id: `M${this.moteCounter++}`,
              pos: [
                round3(this.player.pos[0] + this.prng.range(-1, 1)),
                0,
                round3(this.player.pos[2] + this.prng.range(-1, 1))
              ]
            });
          }

          this.events.push({
            type: 'event',
            tick,
            name: 'player_hit',
            data: {
              by: 'shade',
              flames: this.player.flames,
              dropped
            }
          });

          if (this.player.flames <= 0) {
            this.state = 'lost';
            this.gameOverReason = 'no_flames';
            this.events.push({
              type: 'event',
              tick,
              name: 'game_over',
              data: { result: 'lost', reason: 'no_flames' }
            });
            this.tickCount = tick;
            this.simTick = tick;
            return this.events;
          }
        }
      }
    }

    // 9. Time check
    this.tickCount = tick;
    this.simTick = tick;
    this.timeLeft = Math.max(0, this.totalDuration - this.simTick / 60);

    if (this.timeLeft <= 0 && this.state === 'playing') {
      this.state = 'lost';
      this.gameOverReason = 'dawn';
      this.events.push({
        type: 'event',
        tick,
        name: 'game_over',
        data: { result: 'lost', reason: 'dawn' }
      });
    }

    return this.events;
  }

  getSnapshot() {
    return {
      type: 'snapshot',
      tick: this.tickCount,
      sim_tick: this.simTick,
      state: this.state,
      time_left_s: round3(this.timeLeft),
      score: this.score,
      player: {
        pos: [round3(this.player.pos[0]), round3(this.player.pos[1]), round3(this.player.pos[2])],
        flames: this.player.flames,
        carried: this.player.carried
      },
      lanterns: this.lanterns.map(l => ({
        id: l.id,
        pos: [round3(l.pos[0]), round3(l.pos[1]), round3(l.pos[2])],
        lit: l.lit,
        deposited: l.deposited
      })),
      shades: this.shades.map(s => ({
        id: s.id,
        pos: [round3(s.pos[0]), round3(s.pos[1]), round3(s.pos[2])],
        state: s.state
      })),
      motes_active: this.motes.length
    };
  }
}
