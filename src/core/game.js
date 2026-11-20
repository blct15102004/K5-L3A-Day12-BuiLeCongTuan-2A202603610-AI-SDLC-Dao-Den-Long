import { TUNING, PHYSICS } from './constants.js';
import { getNightConfig, getGroundHeight, getSupportingGroundHeight, resolveHorizontalMovement, resolveEntityObstacle, round3 } from './maps.js';
import { PRNG } from './prng.js';

export { round3 };

export function round1(v) {
  return Math.round(v * 10) / 10;
}

export function distXZ(a, b) {
  const dx = a[0] - b[0];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dz * dz);
}

export function dist3D(a, b) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function parseNumericId(id) {
  const m = String(id).match(/(\d+)$/);
  return m ? parseInt(m[1], 10) : 0;
}

export class GameEngine {
  constructor(options = {}) {
    this.seed = options.seed ?? 42;
    this.night = options.night ?? 1;
    this.prng = new PRNG(this.seed);
    this.tuning = {
      ...TUNING,
      score: { ...TUNING.score, ...(options.tuning?.score || {}) },
      ...(options.tuning || {})
    };
    this.map = getNightConfig(this.night);

    this.tickCount = 0;
    this.simTick = 0;
    this.state = 'playing'; // 'playing' | 'paused' | 'won' | 'lost'
    this.gameOverReason = null; // 'dawn_survived' | 'dawn' | 'no_flames'
    this.score = 0;

    this.totalDuration = this.map.duration;
    this.timeLeft = this.totalDuration;

    this.windEnabled = this.map.windEnabled;
    this.wind = {
      active: false,
      dir_deg: 0,
      warning: false
    };

    this.randomMotes = true;
    this.randomShades = true;
    this.randomDrifters = true;
    this.benchmarkMode = Boolean(options.benchmark);

    this.player = {
      pos: [...this.map.spawn],
      vel: [0, 0, 0],
      facing: [0, 1],
      grounded: true,
      flames: this.tuning.flames,
      carried: 0,
      successfulLights: 0,
      invulnTicks: 0,
      dashTicks: 0,
      dashCdTicks: 0,
      dashDir: [0, 1],
      pulseCdTicks: 0,
      charmTicks: 0,
      launched: false,
      respawnTicks: 0
    };

    this.lanterns = this.map.lanterns.map(l => ({
      ...l,
      pos: [...l.pos],
      fuelUnits: 0,
      everLit: false,
      relitCount: 0,
      justSafeActivated: false
    }));

    this.charms = this.map.charms.map(c => ({
      id: c.id,
      pos: [...c.pos],
      available: true,
      respawnTicks: 0
    }));

    this.motes = [];
    this.shades = [];
    this.drifters = [];

    this.shadeCounter = 1;
    this.moteCounter = 1;
    this.drifterCounter = 1;

    this.prevButtons = {
      jump: false,
      interact: false,
      pulse: false,
      dash: false,
      pause: false
    };

    this.events = [];
    if (this.benchmarkMode) {
      this.initBenchmarkScene();
    } else {
      this.initScenario(options.scenario);
    }
  }

  initBenchmarkScene() {
    this.randomMotes = false;
    this.randomShades = false;
    this.randomDrifters = false;
    this.player.pos = [0, 0, 0];
    this.player.grounded = true;

    // L1-L3 lit with fuel: 100; L4-L5 unlit
    for (let i = 0; i < this.lanterns.length; i++) {
      if (i < 3) {
        this.lanterns[i].lit = true;
        this.lanterns[i].everLit = true;
        this.lanterns[i].fuelUnits = PHYSICS.FUEL_MAX_UNITS;
      } else {
        this.lanterns[i].lit = false;
        this.lanterns[i].fuelUnits = 0;
      }
    }

    // 100 fireflies evenly distributed across Night 1 island
    const goldenAngle = 2.39996323;
    const seedAngleOffset = this.prng.range(0, Math.PI * 2);
    for (let i = 0; i < 100; i++) {
      const r = 36.0 * Math.sqrt((i + 0.5) / 100);
      const a = i * goldenAngle + seedAngleOffset;
      this.motes.push({
        id: `M${this.moteCounter++}`,
        pos: [round3(r * Math.cos(a)), 0, round3(r * Math.sin(a))],
        kind: 'random',
        ttlTicks: null,
        spawnTick: -1
      });
    }

    // 200 Ink Shades in wander evenly distributed outside L1-L3 safe zones
    for (let i = 0; i < 200; i++) {
      const r = 37.0 * Math.sqrt((i + 0.5) / 200);
      const a = i * goldenAngle + seedAngleOffset + 0.5;
      let sx = r * Math.cos(a);
      let sz = r * Math.sin(a);
      const safe = this.applyShadeSafety(sx, sz, 0.8, true);
      this.shades.push({
        id: `S${this.shadeCounter++}`,
        pos: [safe.x, 0.8, safe.z],
        yOffset: 0.8,
        state: 'wander',
        stateTicksLeft: 0,
        targetLanternId: null,
        drainTickCounter: 0,
        pushTicksLeft: 0,
        pushDir: [1, 0],
        recoilDir: [1, 0],
        safePushLanternId: null,
        safePushTicksLeft: 0,
        wanderAngle: this.prng.range(0, Math.PI * 2),
        spawnTick: -1
      });
    }
  }

  getCarryCapacity() {
    return Math.min(this.tuning.capacity_max, this.tuning.carry_capacity + 2 * this.player.successfulLights);
  }

  initScenario(scenario) {
    if (!scenario) {
      this.spawnRandomInitialMotes();
      return;
    }

    if (typeof scenario.time_left_s === 'number') {
      this.timeLeft = scenario.time_left_s;
      this.totalDuration = scenario.time_left_s;
    }

    if (typeof scenario.random_motes === 'boolean') this.randomMotes = scenario.random_motes;
    if (typeof scenario.random_shades === 'boolean') this.randomShades = scenario.random_shades;
    if (typeof scenario.random_drifters === 'boolean') this.randomDrifters = scenario.random_drifters;
    if (typeof scenario.wind_enabled === 'boolean') this.windEnabled = scenario.wind_enabled;

    if (scenario.player) {
      const p = scenario.player;
      if (Array.isArray(p.pos)) this.player.pos = [...p.pos];
      if (Array.isArray(p.vel)) this.player.vel = [...p.vel];
      if (typeof p.carried === 'number') this.player.carried = p.carried;
      if (typeof p.flames === 'number') this.player.flames = p.flames;
      if (typeof p.successful_lights === 'number') this.player.successfulLights = p.successful_lights;
      if (typeof p.invuln_ticks === 'number') this.player.invulnTicks = p.invuln_ticks;
      if (typeof p.dash_cd_ticks === 'number') this.player.dashCdTicks = p.dash_cd_ticks;
      if (typeof p.pulse_cd_ticks === 'number') this.player.pulseCdTicks = p.pulse_cd_ticks;
      if (typeof p.charm_ticks === 'number') this.player.charmTicks = p.charm_ticks;
      const gh = getGroundHeight(this.night, this.player.pos[0], this.player.pos[2]);
      this.player.grounded = gh !== null && Math.abs(this.player.pos[1] - gh) <= 0.05;
    }

    if (Array.isArray(scenario.lanterns)) {
      for (const item of scenario.lanterns) {
        let found = this.lanterns.find(l => l.id === item.id);
        if (!found) {
          found = {
            id: item.id,
            pos: Array.isArray(item.pos) ? [...item.pos] : [0, 0, 0],
            deposited: 0,
            lit: false,
            fuelUnits: 0,
            everLit: false,
            relitCount: 0,
            justSafeActivated: false
          };
          this.lanterns.push(found);
        }
        if (Array.isArray(item.pos)) found.pos = [...item.pos];
        if (typeof item.deposited === 'number') found.deposited = item.deposited;
        if (typeof item.lit === 'boolean') found.lit = item.lit;
        if (typeof item.ever_lit === 'boolean') found.everLit = item.ever_lit;
        else if (found.lit) found.everLit = true;
        if (typeof item.relit_count === 'number') found.relitCount = item.relit_count;

        if (found.lit) {
          const fuelVal = typeof item.fuel === 'number' ? item.fuel : this.tuning.fuel_max;
          found.fuelUnits = Math.max(0, Math.min(PHYSICS.FUEL_MAX_UNITS, Math.round(fuelVal * 60)));
        } else {
          found.fuelUnits = 0;
        }
      }
    }

    if (scenario.motes !== undefined) {
      this.motes = scenario.motes.map((m, idx) => {
        const pos = Array.isArray(m) ? [...m] : [...m.pos];
        const id = m.id || `M${idx + 1}`;
        const kind = m.kind || 'random';
        const ttlTicks = typeof m.ttl_ticks === 'number'
          ? m.ttl_ticks
          : (typeof m.ttl_s === 'number' ? Math.round(m.ttl_s * 60) : (kind === 'dropped' ? PHYSICS.MOTE_DROP_TTL_TICKS : null));
        return { id, pos, kind, ttlTicks, spawnTick: -1 };
      });
      this.moteCounter = this.motes.length + 1;
    } else if (this.randomMotes) {
      this.spawnRandomInitialMotes();
    }

    if (scenario.shades !== undefined) {
      let maxSNum = 0;
      this.shades = scenario.shades.map((s, idx) => {
        const id = s.id || `S${idx + 1}`;
        maxSNum = Math.max(maxSNum, parseNumericId(id));
        const pos = Array.isArray(s.pos) ? [...s.pos] : [0, 0, 0];
        const gh = getGroundHeight(this.night, pos[0], pos[2]);
        const yOffset = gh !== null ? pos[1] - gh : 0;
        const d = distXZ(pos, this.player.pos);
        const state = s.state || (d <= PHYSICS.SHADE_DETECT_R ? 'chase' : 'wander');
        const stateTicksLeft = typeof s.state_ticks_left === 'number'
          ? s.state_ticks_left
          : (state === 'stunned' ? PHYSICS.PULSE_STUN_TICKS : state === 'recoil' ? PHYSICS.SHADE_RECOIL_TICKS : state === 'spawning' ? PHYSICS.SHADE_SPAWN_TICKS : 0);
        return {
          id,
          pos,
          yOffset,
          state,
          stateTicksLeft,
          targetLanternId: s.target_lantern_id || null,
          drainTickCounter: 0,
          pushTicksLeft: 0,
          pushDir: [1, 0],
          recoilDir: [1, 0],
          safePushLanternId: null,
          safePushTicksLeft: 0,
          wanderAngle: this.prng.range(0, Math.PI * 2),
          spawnTick: -1
        };
      });
      this.shadeCounter = Math.max(this.shades.length, maxSNum) + 1;
    }

    if (scenario.drifters !== undefined) {
      let maxDNum = 0;
      this.drifters = scenario.drifters.map((d, idx) => {
        const id = d.id || `D${idx + 1}`;
        maxDNum = Math.max(maxDNum, parseNumericId(id));
        const pos = Array.isArray(d.pos) ? [...d.pos] : [0, 0, 0];
        const state = d.state || 'idle';
        const stolen = d.stolen || 0;
        const stateTicksLeft = typeof d.state_ticks_left === 'number'
          ? d.state_ticks_left
          : (state === 'flee' ? PHYSICS.DRIFTER_FLEE_TICKS : 0);
        return {
          id,
          pos,
          state,
          stolen,
          hasStolen: Boolean(d.has_stolen || stolen > 0 || state === 'flee' || state === 'removed'),
          stateTicksLeft,
          anchor: [...pos],
          orbitAngle: this.prng.range(0, Math.PI * 2),
          spawnTick: -1
        };
      });
      this.drifterCounter = Math.max(this.drifters.length, maxDNum) + 1;
    }

    if (scenario.charms !== undefined) {
      this.charms = scenario.charms.map((c, idx) => {
        const id = c.id || `C${idx + 1}`;
        const fallback = this.map.charms.find(mc => mc.id === id);
        const pos = Array.isArray(c.pos) ? [...c.pos] : (fallback ? [...fallback.pos] : [0, 0, 0]);
        const available = c.available !== undefined ? !!c.available : true;
        const respawnTicks = typeof c.respawn_ticks === 'number'
          ? c.respawn_ticks
          : (typeof c.respawn_s === 'number' ? Math.round(c.respawn_s * 60) : (available ? 0 : PHYSICS.CHARM_RESPAWN_TICKS));
        return { id, pos, available, respawnTicks };
      });
    }
  }

  spawnRandomInitialMotes() {
    const indices = this.map.moteSpawnPoints.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(this.prng.next() * (i + 1));
      const tmp = indices[i];
      indices[i] = indices[j];
      indices[j] = tmp;
    }
    const count = Math.min(PHYSICS.MOTE_START_COUNT, indices.length);
    for (let i = 0; i < count; i++) {
      const pt = this.map.moteSpawnPoints[indices[i]];
      this.motes.push({
        id: `M${this.moteCounter++}`,
        pos: [...pt],
        kind: 'random',
        ttlTicks: null,
        spawnTick: -1
      });
    }
  }

  step(input = {}) {
    if (this.state === 'won' || this.state === 'lost') {
      this.events = [];
      return this.events;
    }

    this.events = [];

    // 1. Read input & handle pause BEFORE anything else
    const pausePressed = !!input.pause && !this.prevButtons.pause;
    const jumpPressed = !!input.jump && !this.prevButtons.jump;
    const interactPressed = !!input.interact && !this.prevButtons.interact;
    const pulsePressed = !!input.pulse && !this.prevButtons.pulse;
    const dashPressed = !!input.dash && !this.prevButtons.dash;

    this.prevButtons.pause = !!input.pause;
    this.prevButtons.jump = !!input.jump;
    this.prevButtons.interact = !!input.interact;
    this.prevButtons.pulse = !!input.pulse;
    this.prevButtons.dash = !!input.dash;

    if (this.state === 'playing' && pausePressed) {
      this.state = 'paused';
      this.tickCount += 1;
      this.events.push({ type: 'event', tick: this.tickCount, name: 'paused', data: {} });
      return this.events;
    }

    if (this.state === 'paused') {
      if (pausePressed) {
        this.state = 'playing';
        this.events.push({ type: 'event', tick: this.tickCount + 1, name: 'resumed', data: {} });
      } else {
        this.tickCount += 1;
        return this.events;
      }
    }

    // 2. Advance simulation tick & decrement timers + lantern fuel decay/drain
    this.tickCount += 1;
    this.simTick += 1;
    const tick = this.tickCount;
    const sim = this.simTick;
    const dt = PHYSICS.DT;

    this.timeLeft = Math.max(0, this.totalDuration - sim / 60);

    if (this.player.invulnTicks > 0) this.player.invulnTicks -= 1;
    if (this.player.dashCdTicks > 0) this.player.dashCdTicks -= 1;
    if (this.player.dashTicks > 0) this.player.dashTicks -= 1;
    if (this.player.pulseCdTicks > 0) this.player.pulseCdTicks -= 1;
    if (this.player.charmTicks > 0) this.player.charmTicks -= 1;

    if (this.player.respawnTicks > 0) {
      this.player.respawnTicks -= 1;
      if (this.player.respawnTicks === 0) {
        this.player.pos = [...this.map.spawn];
        this.player.vel = [0, 0, 0];
        this.player.grounded = true;
        this.player.facing = [0, 1];
        this.player.launched = false;
        this.player.dashTicks = 0;
        this.player.invulnTicks = PHYSICS.INVULN_TICKS;
      }
    }

    for (const shade of this.shades) {
      if (shade.state === 'spawning' || shade.state === 'stunned' || shade.state === 'recoil') {
        if (shade.stateTicksLeft > 0) {
          shade.stateTicksLeft -= 1;
          if (shade.stateTicksLeft === 0) {
            shade.state = 'wander';
            shade.pushTicksLeft = 0;
          }
        }
      }
    }

    for (const drifter of this.drifters) {
      if (drifter.state === 'flee' && drifter.stateTicksLeft > 0) {
        drifter.stateTicksLeft -= 1;
        if (drifter.stateTicksLeft === 0) {
          drifter.state = 'removed';
          drifter.stolen = 0;
        }
      }
    }

    for (let i = this.motes.length - 1; i >= 0; i--) {
      const m = this.motes[i];
      if (m.ttlTicks !== null) {
        m.ttlTicks -= 1;
        if (m.ttlTicks <= 0) {
          this.motes.splice(i, 1);
        }
      }
    }

    for (const charm of this.charms) {
      if (!charm.available && charm.respawnTicks > 0) {
        charm.respawnTicks -= 1;
        if (charm.respawnTicks === 0) {
          charm.available = true;
        }
      }
    }

    if (this.windEnabled) {
      if (sim > 0 && (sim + PHYSICS.WIND_WARN_TICKS) % PHYSICS.WIND_PERIOD_TICKS === 0) {
        this.wind.dir_deg = round3(this.prng.range(0, 360));
        this.wind.warning = true;
      }
      if (sim > 0 && sim % PHYSICS.WIND_PERIOD_TICKS === 0) {
        this.wind.active = true;
        this.wind.warning = false;
      }
      if (sim >= PHYSICS.WIND_DURATION_TICKS && (sim - PHYSICS.WIND_DURATION_TICKS) % PHYSICS.WIND_PERIOD_TICKS === 0) {
        this.wind.active = false;
      }
    }

    // Lantern Passive Fuel Decay (1/60 per tick) & Shadow Drain (5/60 per tick)
    if (!this.benchmarkMode) {
      for (const lantern of this.lanterns) {
        if (lantern.lit && lantern.fuelUnits > 0) {
          lantern.fuelUnits = Math.max(0, lantern.fuelUnits - PHYSICS.FUEL_DECAY_UNITS);
        }
      }

      for (const shade of this.shades) {
        if (shade.state === 'drain' && shade.targetLanternId) {
          const target = this.lanterns.find(l => l.id === shade.targetLanternId);
          if (target && target.lit) {
            target.fuelUnits = Math.max(0, target.fuelUnits - PHYSICS.FUEL_DRAIN_UNITS);
            shade.drainTickCounter += 1;
            if (shade.drainTickCounter % 60 === 0) {
              this.events.push({
                type: 'event',
                tick,
                name: 'fuel_drain',
                data: {
                  lantern_id: target.id,
                  shade_id: shade.id,
                  fuel: round1(target.fuelUnits / 60)
                }
              });
            }
          }
        }
      }

      // Extinguish lanterns whose fuel reached <= 0 immediately after Step 2
      for (const lantern of this.lanterns) {
        if (lantern.lit && lantern.fuelUnits <= 0) {
          lantern.fuelUnits = 0;
          lantern.lit = false;
          lantern.deposited = 0;
          this.events.push({
            type: 'event',
            tick,
            name: 'lantern_out',
            data: { lantern_id: lantern.id }
          });
        }
      }
    }

    // 3. Move Mây (walk, jump, dash, launch pads, wind) & check fall off island
    if (!this.benchmarkMode && this.player.respawnTicks === 0) {
      const move = input.move || [0, 0];
      const mx = move[0] ?? 0;
      const mz = move[1] ?? 0;
      const theta = ((input.cam_yaw_deg ?? 0) * Math.PI) / 180;

      let wx = mx * Math.cos(theta) + mz * Math.sin(theta);
      let wz = -mx * Math.sin(theta) + mz * Math.cos(theta);
      const mag = Math.hypot(wx, wz);
      if (mag > 1.0) {
        wx /= mag;
        wz /= mag;
      }

      const isMoving = mag > 0.001;
      if (isMoving) {
        this.player.facing = [wx / mag, wz / mag];
      }

      const hasCharm = this.player.charmTicks > 0;

      if (dashPressed && this.player.dashTicks === 0 && (this.player.dashCdTicks === 0 || hasCharm)) {
        this.player.dashTicks = PHYSICS.DASH_TICKS;
        this.player.dashCdTicks = hasCharm ? 0 : PHYSICS.DASH_CD_TICKS;
        this.player.dashDir = isMoving ? [wx / mag, wz / mag] : [...this.player.facing];
        this.player.launched = false;
        this.player.vel[1] = 0;
        this.events.push({ type: 'event', tick, name: 'dash', data: {} });
      }

      if (jumpPressed && this.player.grounded && this.player.dashTicks === 0) {
        this.player.vel[1] = PHYSICS.JUMP_VEL;
        this.player.grounded = false;
      }

      let vx, vy, vz;
      if (this.player.dashTicks > 0) {
        vx = this.player.dashDir[0] * this.tuning.dash_speed;
        vz = this.player.dashDir[1] * this.tuning.dash_speed;
        vy = 0;
      } else if (this.player.launched) {
        vx = this.player.vel[0];
        vz = this.player.vel[2];
        vy = this.player.vel[1] + PHYSICS.GRAVITY * dt;
      } else {
        const runSpeed = hasCharm ? PHYSICS.CHARM_SPEED : this.tuning.player_speed;
        vx = wx * runSpeed;
        vz = wz * runSpeed;
        vy = this.player.grounded ? 0 : this.player.vel[1] + PHYSICS.GRAVITY * dt;
      }

      if (this.wind.active && this.player.dashTicks === 0) {
        const wr = (this.wind.dir_deg * Math.PI) / 180;
        vx += PHYSICS.WIND_SPEED * Math.cos(wr);
        vz += PHYSICS.WIND_SPEED * Math.sin(wr);
      }

      const oldY = this.player.pos[1];
      const horiz = resolveHorizontalMovement(
        this.night,
        this.player.pos,
        this.player.pos[0] + vx * dt,
        this.player.pos[2] + vz * dt
      );

      let newY = oldY + vy * dt;
      const groundH = getSupportingGroundHeight(this.night, horiz.x, horiz.z, oldY);

      if (groundH !== null) {
        if (this.player.dashTicks > 0 && oldY > groundH + 0.05) {
          newY = oldY;
          this.player.grounded = false;
        } else if (this.player.grounded && vy === 0 && Math.abs(groundH - oldY) <= 0.5) {
          newY = groundH;
          this.player.grounded = true;
        } else if (vy <= 0 && newY <= groundH + 0.05 && oldY >= groundH - 0.55) {
          newY = groundH;
          vy = 0;
          this.player.grounded = true;
          this.player.launched = false;
        } else {
          this.player.grounded = false;
        }
      } else {
        this.player.grounded = false;
      }

      this.player.pos = [horiz.x, round3(newY), horiz.z];
      this.player.vel = [round3(vx), round3(vy), round3(vz)];

      if (this.player.grounded && this.player.dashTicks === 0 && this.map.launchPads.length > 0) {
        for (const pad of this.map.launchPads) {
          if (distXZ(this.player.pos, pad.pos) <= pad.radius && Math.abs(this.player.pos[1] - pad.pos[1]) <= 0.6) {
            let dirX = 0;
            let dirZ = 0;
            if (pad.dir) {
              dirX = pad.dir[0];
              dirZ = pad.dir[1];
            } else if (pad.target) {
              const dx = pad.target[0] - pad.pos[0];
              const dz = pad.target[2] - pad.pos[2];
              const d = Math.hypot(dx, dz) || 1;
              dirX = dx / d;
              dirZ = dz / d;
            }
            this.player.vel = [round3(dirX * pad.horizSpeed), pad.velY, round3(dirZ * pad.horizSpeed)];
            this.player.grounded = false;
            this.player.launched = true;
            break;
          }
        }
      }

      if (this.tuning.fall_enabled && this.player.pos[1] < PHYSICS.FALL_Y) {
        const lost = this.player.carried;
        this.player.carried = 0;
        this.player.flames -= 1;
        this.player.dashTicks = 0;
        this.player.launched = false;
        this.player.vel = [0, 0, 0];
        this.events.push({
          type: 'event',
          tick,
          name: 'player_hit',
          data: {
            by: 'fall',
            flames: this.player.flames,
            dropped: 0,
            lost
          }
        });
        if (this.player.flames > 0) {
          this.player.respawnTicks = PHYSICS.RESPAWN_WAIT_TICKS;
        }
      }
    }

    // 4. Pickup Motes & Charms
    if (!this.benchmarkMode && this.player.respawnTicks === 0 && this.player.flames > 0) {
      const cap = this.getCarryCapacity();
      for (let i = this.motes.length - 1; i >= 0; i--) {
        const mote = this.motes[i];
        if (mote.spawnTick >= sim) continue;
        if (
          this.player.carried < cap &&
          distXZ(this.player.pos, mote.pos) <= this.tuning.pickup_radius &&
          Math.abs(this.player.pos[1] - mote.pos[1]) <= 1.5
        ) {
          this.player.carried += 1;
          this.motes.splice(i, 1);
          this.events.push({
            type: 'event',
            tick,
            name: 'mote_picked',
            data: { carried: this.player.carried }
          });
        }
      }

      for (const charm of this.charms) {
        if (
          charm.available &&
          distXZ(this.player.pos, charm.pos) <= this.tuning.pickup_radius &&
          Math.abs(this.player.pos[1] - charm.pos[1]) <= 1.5
        ) {
          charm.available = false;
          charm.respawnTicks = PHYSICS.CHARM_RESPAWN_TICKS;
          this.player.charmTicks = PHYSICS.CHARM_DURATION_TICKS;
          this.player.dashCdTicks = 0;
          this.events.push({
            type: 'event',
            tick,
            name: 'charm_picked',
            data: { charm_id: charm.id, charm_ticks: PHYSICS.CHARM_DURATION_TICKS }
          });
        }
      }
    }

    // 5. Interact with Lantern (unlit OR lit with fuel < 100; closest, tie-break smallest ID)
    if (!this.benchmarkMode && this.player.respawnTicks === 0 && this.player.flames > 0 && interactPressed && this.player.carried > 0) {
      const candidates = [];
      for (const lantern of this.lanterns) {
        const isValid = !lantern.lit || (lantern.lit && lantern.fuelUnits < PHYSICS.FUEL_MAX_UNITS);
        if (isValid) {
          const d = distXZ(this.player.pos, lantern.pos);
          if (d <= this.tuning.interact_radius && Math.abs(this.player.pos[1] - lantern.pos[1]) <= 2.5) {
            candidates.push({ lantern, dist: d });
          }
        }
      }
      if (candidates.length > 0) {
        candidates.sort((a, b) => {
          if (Math.abs(a.dist - b.dist) > 1e-9) return a.dist - b.dist;
          return a.lantern.id.localeCompare(b.lantern.id);
        });
        const target = candidates[0].lantern;

        if (!target.lit) {
          const cost = target.everLit ? this.tuning.relight_cost : this.tuning.lantern_cost;
          const needed = cost - target.deposited;
          const amount = Math.min(this.player.carried, needed);
          if (amount > 0) {
            this.player.carried -= amount;
            target.deposited += amount;
            this.score += amount * this.tuning.score.per_mote;
            this.events.push({
              type: 'event',
              tick,
              name: 'deposit',
              data: {
                lantern_id: target.id,
                amount,
                deposited: target.deposited
              }
            });

            if (target.deposited >= cost) {
              const isRelight = target.everLit;
              target.lit = true;
              target.everLit = true;
              target.fuelUnits = PHYSICS.FUEL_MAX_UNITS;
              target.justSafeActivated = true;
              if (isRelight) target.relitCount += 1;
              this.player.successfulLights += 1;
              this.score += isRelight ? this.tuning.score.per_relight : this.tuning.score.per_lantern;
              this.events.push({
                type: 'event',
                tick,
                name: 'lantern_lit',
                data: { lantern_id: target.id, relight: isRelight }
              });
            }
          }
        } else {
          const prevFuelUnits = target.fuelUnits;
          const neededMotes = Math.ceil((PHYSICS.FUEL_MAX_UNITS - target.fuelUnits) / PHYSICS.FUEL_MOTE_UNITS);
          const used = Math.min(this.player.carried, neededMotes);
          if (used > 0) {
            this.player.carried -= used;
            target.fuelUnits = Math.min(PHYSICS.FUEL_MAX_UNITS, target.fuelUnits + used * PHYSICS.FUEL_MOTE_UNITS);
            this.score += used * this.tuning.score.per_mote;
            this.events.push({
              type: 'event',
              tick,
              name: 'refuel',
              data: {
                lantern_id: target.id,
                amount: used,
                fuel: round1(target.fuelUnits / 60)
              }
            });
            if (prevFuelUnits < PHYSICS.FUEL_LOW_UNITS && target.fuelUnits >= PHYSICS.FUEL_LOW_UNITS) {
              target.justSafeActivated = true;
            }
          }
        }
      }
    }

    // 6. Update Safe Zones (active only for lit lanterns with fuel >= 30)
    for (const lantern of this.lanterns) {
      if (lantern.justSafeActivated) {
        lantern.justSafeActivated = false;
        for (const shade of this.shades) {
          if (distXZ(shade.pos, lantern.pos) < this.tuning.safe_radius) {
            shade.safePushLanternId = lantern.id;
            shade.safePushTicksLeft = PHYSICS.SAFE_PUSH_TICKS;
            if (shade.state === 'drain') {
              shade.state = 'wander';
              shade.targetLanternId = null;
              shade.drainTickCounter = 0;
            }
          }
        }
      }
    }

    for (const shade of this.shades) {
      if (shade.safePushTicksLeft > 0) {
        const lantern = this.lanterns.find(l => l.id === shade.safePushLanternId);
        if (lantern && lantern.lit && lantern.fuelUnits >= PHYSICS.FUEL_LOW_UNITS) {
          const dx = shade.pos[0] - lantern.pos[0];
          const dz = shade.pos[2] - lantern.pos[2];
          const d = Math.hypot(dx, dz);
          if (d >= this.tuning.safe_radius) {
            shade.safePushTicksLeft = 0;
            shade.safePushLanternId = null;
          } else {
            const ux = d < 0.0001 ? 1 : dx / d;
            const uz = d < 0.0001 ? 0 : dz / d;
            const rem = this.tuning.safe_radius + 0.01 - d;
            const stepOut = rem / shade.safePushTicksLeft;
            shade.pos[0] = round3(shade.pos[0] + ux * stepOut);
            shade.pos[2] = round3(shade.pos[2] + uz * stepOut);
            shade.safePushTicksLeft -= 1;
            if (distXZ(shade.pos, lantern.pos) >= this.tuning.safe_radius) {
              shade.safePushTicksLeft = 0;
              shade.safePushLanternId = null;
            }
          }
        } else {
          shade.safePushTicksLeft = 0;
          shade.safePushLanternId = null;
        }
      }
    }

    // 7. Pulse (Tỏa Sáng)
    if (
      this.player.respawnTicks === 0 &&
      this.player.flames > 0 &&
      pulsePressed &&
      this.player.pulseCdTicks === 0 &&
      this.player.carried >= this.tuning.pulse_cost
    ) {
      this.player.carried -= this.tuning.pulse_cost;
      this.player.pulseCdTicks = PHYSICS.PULSE_CD_TICKS;

      const pulseCenter = [this.player.pos[0], this.player.pos[1] + 0.8, this.player.pos[2]];
      const stunnedIds = [];

      for (const shade of this.shades) {
        if (shade.spawnTick >= sim) continue;
        if (dist3D(pulseCenter, shade.pos) <= this.tuning.pulse_radius) {
          const wasDraining = shade.state === 'drain';
          let pdx = shade.pos[0] - this.player.pos[0];
          let pdz = shade.pos[2] - this.player.pos[2];
          const pdist = Math.hypot(pdx, pdz);
          if (pdist < 0.0001) {
            pdx = 1;
            pdz = 0;
          } else {
            pdx /= pdist;
            pdz /= pdist;
          }
          shade.state = 'stunned';
          shade.stateTicksLeft = PHYSICS.PULSE_STUN_TICKS;
          shade.targetLanternId = null;
          shade.drainTickCounter = 0;
          shade.pushTicksLeft = PHYSICS.PULSE_PUSH_TICKS;
          shade.pushDir = [pdx, pdz];
          stunnedIds.push(shade.id);
          this.score += wasDraining ? 15 : this.tuning.score.per_stun;
        }
      }

      for (const drifter of this.drifters) {
        if (drifter.state === 'removed' || drifter.spawnTick >= sim) continue;
        if (dist3D(pulseCenter, drifter.pos) <= this.tuning.pulse_radius) {
          if (drifter.state === 'chase') {
            drifter.state = 'flee';
            drifter.stateTicksLeft = PHYSICS.DRIFTER_FLEE_TICKS;
            drifter.stolen = 0;
            drifter.hasStolen = true;
          } else if (drifter.state === 'flee' && drifter.stolen > 0) {
            const amount = drifter.stolen;
            const dropY = getGroundHeight(this.night, drifter.pos[0], drifter.pos[2]);
            const moteY = dropY !== null ? dropY : this.player.pos[1];
            for (let k = 0; k < amount; k++) {
              const ang = (k * Math.PI * 2) / amount;
              this.motes.push({
                id: `M${this.moteCounter++}`,
                pos: [
                  round3(drifter.pos[0] + Math.cos(ang) * 0.4),
                  round3(moteY),
                  round3(drifter.pos[2] + Math.sin(ang) * 0.4)
                ],
                kind: 'dropped',
                ttlTicks: PHYSICS.MOTE_DROP_TTL_TICKS,
                spawnTick: sim
              });
            }
            this.events.push({
              type: 'event',
              tick,
              name: 'drifter_drop',
              data: { drifter_id: drifter.id, amount }
            });
            drifter.stolen = 0;
            drifter.stateTicksLeft = PHYSICS.DRIFTER_DROP_FLEE_TICKS;
          }
        }
      }

      this.events.push({
        type: 'event',
        tick,
        name: 'pulse',
        data: { stunned_ids: stunnedIds }
      });
    }

    // 8. Move Shades & Drifters
    for (const shade of this.shades) {
      if (shade.safePushTicksLeft > 0) continue;
      if (shade.state === 'spawning') continue;

      if (shade.state === 'stunned') {
        if (shade.pushTicksLeft > 0) {
          const stepM = this.tuning.pulse_push_m / PHYSICS.PULSE_PUSH_TICKS;
          const nx = shade.pos[0] + shade.pushDir[0] * stepM;
          const nz = shade.pos[2] + shade.pushDir[1] * stepM;
          const resolved = resolveEntityObstacle(this.night, nx, nz, shade.pos[1], true);
          shade.pos[0] = resolved.x;
          shade.pos[2] = resolved.z;
          const gh = getGroundHeight(this.night, shade.pos[0], shade.pos[2]);
          if (gh !== null) shade.pos[1] = round3(gh + shade.yOffset);
          shade.pushTicksLeft -= 1;
          if (resolved.blocked) shade.pushTicksLeft = 0;
        }
        continue;
      }

      if (shade.state === 'recoil') {
        const stepM = PHYSICS.SHADE_RECOIL_M / PHYSICS.SHADE_RECOIL_TICKS;
        const nx = shade.pos[0] + shade.recoilDir[0] * stepM;
        const nz = shade.pos[2] + shade.recoilDir[1] * stepM;
        const resolved = this.applyShadeSafety(nx, nz, shade.pos[1]);
        shade.pos[0] = resolved.x;
        shade.pos[2] = resolved.z;
        const gh = getGroundHeight(this.night, shade.pos[0], shade.pos[2]);
        if (gh !== null) shade.pos[1] = round3(gh + shade.yOffset);
        continue;
      }

      const distToPlayer = distXZ(shade.pos, this.player.pos);

      if (shade.state === 'drain') {
        const target = this.lanterns.find(l => l.id === shade.targetLanternId);
        if (this.player.respawnTicks === 0 && distToPlayer <= PHYSICS.SHADE_DRAIN_DETECT_R) {
          shade.state = 'chase';
          shade.targetLanternId = null;
          shade.drainTickCounter = 0;
        } else if (
          !target ||
          !target.lit ||
          target.fuelUnits >= PHYSICS.FUEL_LOW_UNITS ||
          distXZ(shade.pos, target.pos) > PHYSICS.SHADE_DRAIN_R
        ) {
          shade.state = 'wander';
          shade.targetLanternId = null;
          shade.drainTickCounter = 0;
        } else {
          continue; // Stationary while draining
        }
      }

      if (shade.state === 'wander') {
        if (!this.benchmarkMode && this.player.respawnTicks === 0 && distToPlayer <= PHYSICS.SHADE_DETECT_R) {
          shade.state = 'chase';
          shade.targetLanternId = null;
        }
      } else if (shade.state === 'chase') {
        if (this.player.respawnTicks > 0 || distToPlayer > PHYSICS.SHADE_LOSE_R) {
          shade.state = 'wander';
        }
      }

      if (shade.state === 'chase') {
        const dx = this.player.pos[0] - shade.pos[0];
        const dz = this.player.pos[2] - shade.pos[2];
        const d = Math.hypot(dx, dz);
        if (d > 0.0001) {
          const stepM = this.map.shadeSpeed * dt;
          const nx = shade.pos[0] + (dx / d) * stepM;
          const nz = shade.pos[2] + (dz / d) * stepM;
          const resolved = this.applyShadeSafety(nx, nz, shade.pos[1]);
          shade.pos[0] = resolved.x;
          shade.pos[2] = resolved.z;
          const gh = getGroundHeight(this.night, shade.pos[0], shade.pos[2]);
          if (gh !== null) shade.pos[1] = round3(gh + shade.yOffset);
        }
      } else if (shade.state === 'wander') {
        // Target closest lit lantern with fuel < 30; fallback to closest unlit lantern
        const lowFuel = this.lanterns.filter(l => l.lit && l.fuelUnits < PHYSICS.FUEL_LOW_UNITS);
        const pool = lowFuel.length > 0 ? lowFuel : this.lanterns.filter(l => !l.lit);
        if (pool.length > 0) {
          pool.sort((a, b) => {
            const da = distXZ(shade.pos, a.pos);
            const db = distXZ(shade.pos, b.pos);
            if (Math.abs(da - db) > 1e-9) return da - db;
            return a.id.localeCompare(b.id);
          });
          const target = pool[0];
          const dx = target.pos[0] - shade.pos[0];
          const dz = target.pos[2] - shade.pos[2];
          const d = Math.hypot(dx, dz);
          if (d > 0.0001) {
            const stepM = Math.min(d, PHYSICS.SHADE_WANDER_SPEED * dt);
            const nx = shade.pos[0] + (dx / d) * stepM;
            const nz = shade.pos[2] + (dz / d) * stepM;
            const resolved = this.applyShadeSafety(nx, nz, shade.pos[1], true);
            shade.pos[0] = resolved.x;
            shade.pos[2] = resolved.z;
            const gh = getGroundHeight(this.night, shade.pos[0], shade.pos[2]);
            if (gh !== null) shade.pos[1] = round3(gh + shade.yOffset);
          }
          if (target.lit && target.fuelUnits < PHYSICS.FUEL_LOW_UNITS && distXZ(shade.pos, target.pos) <= PHYSICS.SHADE_DRAIN_R) {
            shade.state = 'drain';
            shade.targetLanternId = target.id;
            shade.drainTickCounter = 0;
          }
        } else {
          shade.wanderAngle += 0.02;
          const stepM = PHYSICS.SHADE_WANDER_SPEED * dt;
          const nx = shade.pos[0] + Math.cos(shade.wanderAngle) * stepM;
          const nz = shade.pos[2] + Math.sin(shade.wanderAngle) * stepM;
          const resolved = this.applyShadeSafety(nx, nz, shade.pos[1], true);
          if (resolved.blocked) {
            shade.wanderAngle += Math.PI * 0.75;
          } else {
            shade.pos[0] = resolved.x;
            shade.pos[2] = resolved.z;
            const gh = getGroundHeight(this.night, shade.pos[0], shade.pos[2]);
            if (gh !== null) shade.pos[1] = round3(gh + shade.yOffset);
          }
        }
      }
    }

    for (const drifter of this.drifters) {
      if (drifter.state === 'removed') continue;

      const dPlayer = distXZ(drifter.pos, this.player.pos);
      if (drifter.state === 'idle') {
        if (
          this.player.respawnTicks === 0 &&
          !drifter.hasStolen &&
          this.player.carried >= 5 &&
          dPlayer <= PHYSICS.DRIFTER_DETECT_R
        ) {
          drifter.state = 'chase';
        } else {
          drifter.orbitAngle += 0.03;
          const stepM = PHYSICS.DRIFTER_IDLE_SPEED * dt;
          drifter.pos[0] = round3(drifter.pos[0] + Math.cos(drifter.orbitAngle) * stepM);
          drifter.pos[2] = round3(drifter.pos[2] + Math.sin(drifter.orbitAngle) * stepM);
        }
      } else if (drifter.state === 'chase') {
        if (this.player.respawnTicks > 0 || this.player.carried < 5 || dPlayer > PHYSICS.DRIFTER_DETECT_R) {
          drifter.state = 'idle';
        } else {
          const dx = this.player.pos[0] - drifter.pos[0];
          const dz = this.player.pos[2] - drifter.pos[2];
          const d = Math.hypot(dx, dz);
          if (d > 0.0001) {
            const stepM = PHYSICS.DRIFTER_SPEED * dt;
            drifter.pos[0] = round3(drifter.pos[0] + (dx / d) * stepM);
            drifter.pos[2] = round3(drifter.pos[2] + (dz / d) * stepM);
          }
        }
      } else if (drifter.state === 'flee') {
        let dx = drifter.pos[0] - this.player.pos[0];
        let dz = drifter.pos[2] - this.player.pos[2];
        const d = Math.hypot(dx, dz);
        if (d < 0.0001) {
          dx = 1;
          dz = 0;
        } else {
          dx /= d;
          dz /= d;
        }
        const stepM = PHYSICS.DRIFTER_SPEED * dt;
        drifter.pos[0] = round3(drifter.pos[0] + dx * stepM);
        drifter.pos[2] = round3(drifter.pos[2] + dz * stepM);
      }
    }

    // 9. Collisions: Drifters steal FIRST, then Shades hit (ascending ID, max 1 flame/tick)
    if (!this.benchmarkMode && this.player.respawnTicks === 0 && this.player.flames > 0) {
      for (const drifter of this.drifters) {
        if (
          drifter.state === 'chase' &&
          !drifter.hasStolen &&
          drifter.spawnTick < sim &&
          distXZ(drifter.pos, this.player.pos) <= PHYSICS.DRIFTER_STEAL_R
        ) {
          const amount = Math.min(PHYSICS.DRIFTER_STEAL_MAX, this.player.carried);
          if (amount > 0) {
            this.player.carried -= amount;
            drifter.stolen = amount;
            drifter.hasStolen = true;
            drifter.state = 'flee';
            drifter.stateTicksLeft = PHYSICS.DRIFTER_FLEE_TICKS;
            this.events.push({
              type: 'event',
              tick,
              name: 'drifter_steal',
              data: {
                drifter_id: drifter.id,
                amount,
                carried: this.player.carried
              }
            });
          }
        }
      }

      if (this.player.invulnTicks === 0) {
        const sortedShades = [...this.shades].sort((a, b) => parseNumericId(a.id) - parseNumericId(b.id));
        for (const shade of sortedShades) {
          if (
            (shade.state === 'chase' || shade.state === 'wander') &&
            shade.safePushTicksLeft === 0 &&
            shade.spawnTick < sim &&
            distXZ(shade.pos, this.player.pos) <= this.tuning.shade_hit_radius &&
            Math.abs(shade.pos[1] - this.player.pos[1]) <= 1.5
          ) {
            const dropped = Math.floor(this.player.carried * this.tuning.hit_drop_ratio);
            this.player.carried -= dropped;
            this.player.flames -= 1;
            this.player.invulnTicks = PHYSICS.INVULN_TICKS;

            const groundY = getGroundHeight(this.night, this.player.pos[0], this.player.pos[2]);
            const dropY = groundY !== null ? groundY : this.player.pos[1];
            for (let d = 0; d < dropped; d++) {
              const ang = this.prng.range(0, Math.PI * 2);
              const rad = this.prng.range(1.5, 2.5);
              this.motes.push({
                id: `M${this.moteCounter++}`,
                pos: [
                  round3(this.player.pos[0] + Math.cos(ang) * rad),
                  round3(dropY),
                  round3(this.player.pos[2] + Math.sin(ang) * rad)
                ],
                kind: 'dropped',
                ttlTicks: PHYSICS.MOTE_DROP_TTL_TICKS,
                spawnTick: sim
              });
            }

            let rdx = shade.pos[0] - this.player.pos[0];
            let rdz = shade.pos[2] - this.player.pos[2];
            const rd = Math.hypot(rdx, rdz);
            if (rd < 0.0001) {
              rdx = 1;
              rdz = 0;
            } else {
              rdx /= rd;
              rdz /= rd;
            }
            shade.state = 'recoil';
            shade.stateTicksLeft = PHYSICS.SHADE_RECOIL_TICKS;
            shade.recoilDir = [rdx, rdz];

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
            break;
          }
        }
      }
    }

    // 10. Periodic Spawning
    if (this.randomMotes && sim > 0 && sim % PHYSICS.MOTE_SPAWN_INTERVAL_TICKS === 0) {
      if (this.motes.length < PHYSICS.MOTE_CAP) {
        const emptyPts = this.map.moteSpawnPoints.filter(pt =>
          !this.motes.some(m => distXZ(m.pos, pt) < 0.5 && Math.abs(m.pos[1] - pt[1]) < 0.5)
        );
        if (emptyPts.length > 0) {
          const pt = emptyPts[this.prng.rangeInt(0, emptyPts.length - 1)];
          this.motes.push({
            id: `M${this.moteCounter++}`,
            pos: [...pt],
            kind: 'random',
            ttlTicks: null,
            spawnTick: sim
          });
        }
      }
    }

    if (this.randomShades && sim >= 300) {
      let spawnCount = 0;
      if (sim === 300) spawnCount = 2;
      else if ((sim - 300) % this.map.shadeIntervalTicks === 0) spawnCount = 1;

      for (let s = 0; s < spawnCount; s++) {
        if (this.shades.length >= this.map.maxShades) break;
        const validPts = this.map.shadeSpawnPoints.filter(pt =>
          distXZ(pt, this.player.pos) >= 15.0 &&
          !this.shades.some(sh => distXZ(sh.pos, pt) < 0.5)
        );
        if (validPts.length > 0) {
          const pt = validPts[this.prng.rangeInt(0, validPts.length - 1)];
          const shadeId = `S${this.shadeCounter++}`;
          this.shades.push({
            id: shadeId,
            pos: [pt[0], round3(pt[1] + 0.8), pt[2]],
            yOffset: 0.8,
            state: 'spawning',
            stateTicksLeft: PHYSICS.SHADE_SPAWN_TICKS,
            targetLanternId: null,
            drainTickCounter: 0,
            pushTicksLeft: 0,
            pushDir: [1, 0],
            recoilDir: [1, 0],
            safePushLanternId: null,
            safePushTicksLeft: 0,
            wanderAngle: this.prng.range(0, Math.PI * 2),
            spawnTick: sim
          });
          this.events.push({
            type: 'event',
            tick,
            name: 'shade_spawned',
            data: { id: shadeId }
          });
        }
      }
    }

    if (this.randomDrifters && this.map.driftersEnabled && sim > 0 && sim % PHYSICS.DRIFTER_SPAWN_INTERVAL_TICKS === 0) {
      const activeDrifters = this.drifters.filter(d => d.state !== 'removed').length;
      if (activeDrifters < PHYSICS.DRIFTER_MAX_ACTIVE) {
        const pts = this.map.shadeSpawnPoints;
        const pt = pts[this.prng.rangeInt(0, pts.length - 1)];
        this.drifters.push({
          id: `D${this.drifterCounter++}`,
          pos: [pt[0], round3(pt[1] + 1.0), pt[2]],
          state: 'idle',
          stolen: 0,
          hasStolen: false,
          stateTicksLeft: 0,
          anchor: [pt[0], round3(pt[1] + 1.0), pt[2]],
          orbitAngle: this.prng.range(0, Math.PI * 2),
          spawnTick: sim
        });
      }
    }

    // 11. Check Win / Loss (Phase 3 Dawn Survival: no early win on all_lit)
    if (this.benchmarkMode) return this.events;
    if (this.player.flames <= 0) {
      this.state = 'lost';
      this.gameOverReason = 'no_flames';
      this.events.push({
        type: 'event',
        tick,
        name: 'game_over',
        data: { result: 'lost', reason: 'no_flames' }
      });
    } else if (this.timeLeft <= 0) {
      const litLanterns = this.lanterns.filter(l => l.lit);
      const required = Math.ceil(this.tuning.win_ratio * this.lanterns.length);
      if (litLanterns.length >= required) {
        this.state = 'won';
        this.gameOverReason = 'dawn_survived';
        for (const l of litLanterns) {
          this.score += 50 + Math.floor(l.fuelUnits / 60);
        }
        this.score += this.tuning.score.per_flame_left * this.player.flames;
        this.events.push({
          type: 'event',
          tick,
          name: 'game_over',
          data: { result: 'won', reason: 'dawn_survived' }
        });
      } else {
        this.state = 'lost';
        this.gameOverReason = 'dawn';
        this.events.push({
          type: 'event',
          tick,
          name: 'game_over',
          data: { result: 'lost', reason: 'dawn' }
        });
      }
    }

    return this.events;
  }

  applyShadeSafety(nx, nz, y, clampIsland = false) {
    let x = nx;
    let z = nz;
    let blocked = false;

    const obs = resolveEntityObstacle(this.night, x, z, y, clampIsland);
    x = obs.x;
    z = obs.z;
    if (obs.blocked) blocked = true;

    for (const lantern of this.lanterns) {
      if (lantern.lit && lantern.fuelUnits >= PHYSICS.FUEL_LOW_UNITS) {
        const dx = x - lantern.pos[0];
        const dz = z - lantern.pos[2];
        const d = Math.hypot(dx, dz);
        if (d < this.tuning.safe_radius) {
          blocked = true;
          if (d < 0.0001) {
            x = round3(lantern.pos[0] + this.tuning.safe_radius);
            z = round3(lantern.pos[2]);
          } else {
            const scale = this.tuning.safe_radius / d;
            x = round3(lantern.pos[0] + dx * scale);
            z = round3(lantern.pos[2] + dz * scale);
          }
        }
      }
    }

    return { x, z, blocked };
  }

  getSnapshot() {
    return {
      type: 'snapshot',
      tick: this.tickCount,
      sim_tick: this.simTick,
      night: this.night,
      state: this.state,
      time_left_s: round3(this.timeLeft),
      score: this.score,
      wind: {
        active: this.wind.active,
        dir_deg: round3(this.wind.dir_deg)
      },
      player: {
        pos: [round3(this.player.pos[0]), round3(this.player.pos[1]), round3(this.player.pos[2])],
        vel: [round3(this.player.vel[0]), round3(this.player.vel[1]), round3(this.player.vel[2])],
        grounded: this.player.grounded,
        flames: this.player.flames,
        carried: this.player.carried,
        capacity: this.getCarryCapacity(),
        invuln: this.player.invulnTicks > 0,
        dash_cd_s: round3(this.player.dashCdTicks / 60),
        pulse_cd_s: round3(this.player.pulseCdTicks / 60),
        charm_s: round3(this.player.charmTicks / 60)
      },
      lanterns: this.lanterns.map(l => ({
        id: l.id,
        pos: [round3(l.pos[0]), round3(l.pos[1]), round3(l.pos[2])],
        lit: l.lit,
        deposited: l.deposited,
        fuel: l.lit ? round1(l.fuelUnits / 60) : 0,
        ever_lit: l.everLit,
        relit_count: l.relitCount
      })),
      shades: this.shades.map(s => ({
        id: s.id,
        pos: [round3(s.pos[0]), round3(s.pos[1]), round3(s.pos[2])],
        state: s.state
      })),
      motes_active: this.motes.length,
      motes: this.motes.map(m => ({
        id: m.id,
        pos: [round3(m.pos[0]), round3(m.pos[1]), round3(m.pos[2])],
        kind: m.kind,
        ttl_s: m.ttlTicks === null ? null : round3(m.ttlTicks / 60)
      })),
      drifters: this.drifters.map(d => ({
        id: d.id,
        pos: [round3(d.pos[0]), round3(d.pos[1]), round3(d.pos[2])],
        state: d.state,
        stolen: d.stolen
      })),
      charms: this.charms.map(c => ({
        id: c.id,
        available: c.available,
        respawn_s: round3(c.respawnTicks / 60)
      }))
    };
  }
}
