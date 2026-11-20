import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { TUNING, CONTRACT_VERSION } from '../src/core/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const cliPath = path.resolve(rootDir, 'src/headless/cli.js');
const tempDir = path.resolve(__dirname, 'temp');

if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

let passed = 0;
let total = 0;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function runTest(name, fn) {
  total++;
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    console.error(`         ${err.message}`);
  }
}

function runCli({ seed = 123, night = 1, scenario = null, inputs = null, ticks = 60, snapshotEvery = 10, tag = 'test' }) {
  let scenArg = '';
  if (scenario) {
    const sf = typeof scenario === 'string' ? scenario : path.resolve(tempDir, `scen_${tag}.json`);
    if (typeof scenario !== 'string') fs.writeFileSync(sf, JSON.stringify(scenario));
    scenArg = `--scenario "${sf}"`;
  }
  let inArg = '';
  if (inputs) {
    const inf = typeof inputs === 'string' ? inputs : path.resolve(tempDir, `in_${tag}.json`);
    if (typeof inputs !== 'string') fs.writeFileSync(inf, JSON.stringify(inputs));
    inArg = `--inputs "${inf}"`;
  }
  const outFile = path.resolve(tempDir, `out_${tag}.jsonl`);
  execSync(`node "${cliPath}" --seed ${seed} --night ${night} ${scenArg} ${inArg} --ticks ${ticks} --snapshot-every ${snapshotEvery} --out "${outFile}"`);
  const raw = fs.readFileSync(outFile, 'utf8');
  const lines = raw.trim().split('\n').map(l => JSON.parse(l));
  return { raw, lines, outFile };
}

console.log('--- RUNNING SUITE: DAO DEN LONG PHASE 3 (CONTRACT v1.2) ---');

// 0. Static & Contract Integrity Checks
runTest('Contract: game.contract.json v1.2 matches constants.js TUNING', () => {
  const contract = JSON.parse(fs.readFileSync(path.resolve(rootDir, 'game.contract.json'), 'utf8'));
  assert(contract.contract_version === '1.2', `Expected 1.2, got ${contract.contract_version}`);
  assert(CONTRACT_VERSION === '1.2', `Expected constants.js 1.2, got ${CONTRACT_VERSION}`);
  assert(JSON.stringify(contract.tuning) === JSON.stringify(TUNING), 'game.contract.json tuning differs from src/core/constants.js');
});

runTest('Browser Safety: Zero node:* imports in src/core/ and src/render/', () => {
  for (const dir of ['src/core', 'src/render']) {
    const fullDir = path.resolve(rootDir, dir);
    for (const file of fs.readdirSync(fullDir)) {
      if (file.endsWith('.js')) {
        const src = fs.readFileSync(path.resolve(fullDir, file), 'utf8');
        assert(!/from\s+['"]node:/.test(src), `${dir}/${file} must not import node:* modules`);
      }
    }
  }
});

// 1. Phase 1 Regression Tests (updated to standardized v1.1 values)
runTest('REQ-02 (Reg): Player movement and camera yaw transformation (6.0 m/s)', () => {
  const { lines } = runCli({
    tag: 'move',
    ticks: 60,
    inputs: { frames: [{ tick: 0, move: [0, 1], cam_yaw_deg: 90 }, { tick: 60, move: [0, 0] }] }
  });
  const snap = lines.filter(l => l.type === 'snapshot').pop();
  assert(Math.abs(snap.player.pos[0] - 6.0) < 0.05, `Expected x ~ 6.0, got ${snap.player.pos[0]}`);
});

runTest('REQ-03 (Reg): Mote pickup within 1.0m, no score until deposit', () => {
  const { lines } = runCli({
    tag: 'pickup',
    scenario: path.resolve(__dirname, 'scenarios/scenario_pickup.json'),
    inputs: path.resolve(__dirname, 'scenarios/inputs_pickup.json'),
    ticks: 60
  });
  const pickEvt = lines.find(l => l.type === 'event' && l.name === 'mote_picked');
  assert(pickEvt && pickEvt.data.carried === 1, 'Expected mote_picked carried=1');
  const endLine = lines.find(l => l.type === 'end');
  assert(endLine.score === 0, `Expected score 0 before deposit (v1.1), got ${endLine.score}`);
});

runTest('REQ-04 (P3 Updated): Lantern deposit (10 motes) & lantern_lit relight:false (+100 + 10*5 = 150)', () => {
  const { lines } = runCli({
    tag: 'deposit',
    scenario: path.resolve(__dirname, 'scenarios/scenario_deposit.json'),
    inputs: path.resolve(__dirname, 'scenarios/inputs_deposit.json'),
    ticks: 30
  });
  const depEvt = lines.find(l => l.type === 'event' && l.name === 'deposit');
  const litEvt = lines.find(l => l.type === 'event' && l.name === 'lantern_lit');
  const endLine = lines.find(l => l.type === 'end');
  assert(depEvt && depEvt.data.amount === 10 && depEvt.data.deposited === 10, 'Expected deposit 10');
  assert(litEvt && litEvt.data.lantern_id === 'L1' && litEvt.data.relight === false, 'Expected L1 lit with relight:false');
  assert(endLine.score === 150, `Expected score 150 (10*5 + 100), got ${endLine.score}`);
});

runTest('REQ-06 (Reg): Pulse stuns 120 ticks, pushes 4m over 15 ticks, +5 score', () => {
  const { lines } = runCli({
    tag: 'pulse',
    scenario: path.resolve(__dirname, 'scenarios/scenario_pulse.json'),
    inputs: path.resolve(__dirname, 'scenarios/inputs_pulse.json'),
    ticks: 30,
    snapshotEvery: 15
  });
  const pulseEvt = lines.find(l => l.type === 'event' && l.name === 'pulse');
  assert(pulseEvt && pulseEvt.data.stunned_ids.includes('S1'), 'S1 should be stunned');
  const snap30 = lines.find(l => l.type === 'snapshot' && l.tick === 30);
  const s1 = snap30.shades.find(s => s.id === 'S1');
  assert(s1.state === 'stunned', `Expected S1 stunned, got ${s1.state}`);
  assert(Math.abs(s1.pos[2] - 7.0) < 0.05, `Expected S1 pushed to z~7.0, got ${s1.pos[2]}`);
  const endLine = lines.find(l => l.type === 'end');
  assert(endLine.score === 5, `Expected score 5, got ${endLine.score}`);
});

runTest('REQ-05 (Reg): Shade hit -1 flame, drops 50% motes in 1.5-2.5m ring, recoil state, 90t invuln', () => {
  const { lines } = runCli({
    tag: 'hit',
    scenario: path.resolve(__dirname, 'scenarios/scenario_hit.json'),
    ticks: 10,
    snapshotEvery: 5
  });
  const hitEvt = lines.find(l => l.type === 'event' && l.name === 'player_hit');
  assert(hitEvt && hitEvt.data.by === 'shade' && hitEvt.data.flames === 2 && hitEvt.data.dropped === 2, 'Expected valid shade hit');
  const snap = lines.find(l => l.type === 'snapshot' && l.tick === 5);
  assert(snap.player.invuln === true, 'Player should be invulnerable');
  assert(snap.shades[0].state === 'recoil', `Expected shade state recoil, got ${snap.shades[0].state}`);
  assert(snap.motes.filter(m => m.kind === 'dropped').length === 2, 'Expected 2 dropped motes');
});

runTest('REQ-08 (P3 Updated): Lighting all lanterns no longer ends Night early', () => {
  const { lines } = runCli({
    tag: 'win',
    scenario: path.resolve(__dirname, 'scenarios/scenario_win.json'),
    inputs: path.resolve(__dirname, 'scenarios/inputs_deposit.json'),
    ticks: 30
  });
  const litEvt = lines.find(l => l.type === 'event' && l.name === 'lantern_lit');
  const overEvt = lines.find(l => l.type === 'event' && l.name === 'game_over');
  assert(litEvt && litEvt.data.lantern_id === 'L1', 'Expected L1 lit');
  assert(!overEvt, 'Lighting all lanterns must NOT end Night early in Phase 3');
  const endLine = lines.find(l => l.type === 'end');
  assert(endLine.state === 'playing', `Expected end state "playing", got ${endLine.state}`);
});

// 2. New Phase 2 Feature Headless Scenarios
runTest('P2-JUMP: Jump physics (v=7, g=-20), landing, no double jump', () => {
  const { lines } = runCli({
    tag: 'jump',
    scenario: { player: { pos: [0, 0, 0] }, random_motes: false, random_shades: false },
    inputs: {
      frames: [
        { tick: 0, jump: true },
        { tick: 10, jump: false },
        { tick: 15, jump: true } // should be ignored while airborne
      ]
    },
    ticks: 50,
    snapshotEvery: 5
  });
  const snap10 = lines.find(l => l.type === 'snapshot' && l.tick === 10);
  const snap50 = lines.find(l => l.type === 'snapshot' && l.tick === 50);
  assert(snap10.player.pos[1] > 0.5 && snap10.player.grounded === false, 'Player should be airborne at tick 10');
  assert(snap50.player.pos[1] === 0 && snap50.player.grounded === true, 'Player should land back at Y=0 by tick 50');
});

runTest('P2-DASH: Dash 14 m/s for 12 ticks (2.8m), cooldown 90 ticks, air dash keeps Y', () => {
  const { lines } = runCli({
    tag: 'dash',
    scenario: { player: { pos: [0, 0, 0] }, random_motes: false, random_shades: false },
    inputs: {
      frames: [
        { tick: 0, move: [0, 1], dash: true },
        { tick: 5, move: [0, 0], dash: false }
      ]
    },
    ticks: 20,
    snapshotEvery: 1
  });
  const dashEvt = lines.find(l => l.type === 'event' && l.name === 'dash');
  assert(dashEvt, 'Expected dash event');
  const snap12 = lines.find(l => l.type === 'snapshot' && l.tick === 12);
  assert(Math.abs(snap12.player.pos[2] - 2.8) < 0.05, `Expected z ~ 2.8 after 12-tick dash, got ${snap12.player.pos[2]}`);
  assert(snap12.player.dash_cd_s > 1.2, `Expected dash_cd_s > 1.2, got ${snap12.player.dash_cd_s}`);

  // Air dash keeps Y constant
  const { lines: airLines } = runCli({
    tag: 'airdash',
    scenario: { player: { pos: [0, 0, 0] }, random_motes: false, random_shades: false },
    inputs: {
      frames: [
        { tick: 0, jump: true },
        { tick: 15, jump: false, dash: true }
      ]
    },
    ticks: 28,
    snapshotEvery: 1
  });
  const snap15 = airLines.find(l => l.type === 'snapshot' && l.tick === 15);
  const snap25 = airLines.find(l => l.type === 'snapshot' && l.tick === 25);
  assert(Math.abs(snap25.player.pos[1] - snap15.player.pos[1]) < 0.01, 'Air dash must preserve altitude Y');
});

runTest('P2-FALL: Fall off island (Y < -10) -1 flame, lose all motes, 60t respawn + 90t invuln; 0 flames loses', () => {
  const { lines } = runCli({
    tag: 'fall',
    scenario: { player: { pos: [41, 0, 0], carried: 4, flames: 2, invuln_ticks: 90 }, random_motes: false, random_shades: false },
    ticks: 160,
    snapshotEvery: 10
  });
  const fallEvt = lines.find(l => l.type === 'event' && l.name === 'player_hit' && l.data.by === 'fall');
  assert(fallEvt, 'Fall event must bypass invuln');
  assert(fallEvt.data.flames === 1 && fallEvt.data.lost === 4 && fallEvt.data.dropped === 0, 'Fall event data mismatch');
  const snapAfter = lines.find(l => l.type === 'snapshot' && l.tick === 150);
  assert(snapAfter.player.pos[0] === 0 && snapAfter.player.pos[1] === 0, 'Player must respawn at (0,0,0) after 60 ticks');
  assert(snapAfter.player.invuln === true, 'Player must have invuln after respawn');

  // Instant loss on last flame
  const { lines: lossLines } = runCli({
    tag: 'fall_loss',
    scenario: { player: { pos: [41, -9, 0], flames: 1 }, random_motes: false, random_shades: false },
    ticks: 60
  });
  const over = lossLines.find(l => l.type === 'event' && l.name === 'game_over');
  assert(over && over.data.result === 'lost' && over.data.reason === 'no_flames', 'Last flame fall must trigger immediate loss');
});

runTest('P2-SAFE: Newly lit lantern pushes shade out of 6m safe_radius within 30 ticks without hitting player', () => {
  const { lines } = runCli({
    tag: 'safe',
    scenario: {
      player: { pos: [0, 0, 23.5], carried: 10, flames: 3 },
      shades: [{ id: 'S1', pos: [0, 0.8, 23.8], state: 'chase' }],
      lanterns: [{ id: 'L1', pos: [0, 0, 25], deposited: 0, lit: false }],
      random_motes: false,
      random_shades: false
    },
    inputs: { frames: [{ tick: 0, interact: true }, { tick: 2, interact: false }] },
    ticks: 35,
    snapshotEvery: 5
  });
  const hitEvt = lines.find(l => l.type === 'event' && l.name === 'player_hit');
  assert(!hitEvt, 'Shade pushed out by newly lit lantern must not damage player');
  const snap35 = lines.find(l => l.type === 'snapshot' && l.tick === 35);
  const s1 = snap35.shades[0];
  const distToL1 = Math.hypot(s1.pos[0] - 0, s1.pos[2] - 25);
  assert(distToL1 >= 5.99, `Expected shade pushed outside 6m safe_radius, got ${distToL1}`);
});

runTest('P2-MAP2: Night 2 Bridge & Launch Pad (20,0,18) launches to Island B (70,0,0)', () => {
  const { lines } = runCli({
    tag: 'night2_pad',
    night: 2,
    scenario: { player: { pos: [20, 0, 18] }, random_motes: false, random_shades: false },
    ticks: 100,
    snapshotEvery: 10
  });
  const snap100 = lines.find(l => l.type === 'snapshot' && l.tick === 100);
  const distB = Math.hypot(snap100.player.pos[0] - 70, snap100.player.pos[2]);
  assert(snap100.player.grounded === true && distB <= 28.0, `Expected launch pad to land on Island B (r<=28), dist=${distB}`);
});

runTest('P2-MAP3: Night 3 Cliff, Ramp 30deg, Launch Pad -> Tier 2, Bell Tower & Wind', () => {
  // Ramp ascent along 30 deg from r=30.5 inward
  const startX = 30.5 * Math.cos(Math.PI / 6);
  const startZ = 30.5 * Math.sin(Math.PI / 6);
  const { lines: rampLines } = runCli({
    tag: 'n3_ramp',
    night: 3,
    scenario: { player: { pos: [startX, 0, startZ] }, random_motes: false, random_shades: false },
    inputs: { frames: [{ tick: 0, move: [-Math.cos(Math.PI / 6), -Math.sin(Math.PI / 6)] }] },
    ticks: 80,
    snapshotEvery: 10
  });
  const snapRamp = rampLines.find(l => l.type === 'snapshot' && l.tick === 80);
  assert(snapRamp.player.pos[1] === 3, `Expected player to climb ramp to Y=3, got Y=${snapRamp.player.pos[1]}`);

  // Launch pad (0,3,13) -> Tier 2 (Y=6)
  const { lines: padLines } = runCli({
    tag: 'n3_pad',
    night: 3,
    scenario: { player: { pos: [0, 3, 13] }, random_motes: false, random_shades: false },
    ticks: 60,
    snapshotEvery: 10
  });
  const snapPad = padLines.find(l => l.type === 'snapshot' && l.tick === 60);
  assert(snapPad.player.pos[1] === 6 && snapPad.player.grounded === true, `Expected landing on Tier 2 Y=6, got Y=${snapPad.player.pos[1]}`);

  // Bell tower blocks center on Tier 2
  const { lines: towerLines } = runCli({
    tag: 'n3_tower',
    night: 3,
    scenario: { player: { pos: [0, 6, 3] }, random_motes: false, random_shades: false },
    inputs: { frames: [{ tick: 0, move: [0, -1] }] },
    ticks: 40,
    snapshotEvery: 10
  });
  const snapTower = towerLines.find(l => l.type === 'snapshot' && l.tick === 40);
  const rTower = Math.hypot(snapTower.player.pos[0], snapTower.player.pos[2]);
  assert(rTower >= 2.0, `Expected Bell Tower (r=2.0) to block player, r=${rTower}`);

  // Night 3 Wind active at tick 1800 pushes stationary player
  const { lines: windLines } = runCli({
    tag: 'n3_wind',
    night: 3,
    scenario: { player: { pos: [0, 0, -20] }, random_motes: false, random_shades: false, random_drifters: false },
    ticks: 1850,
    snapshotEvery: 50
  });
  const snap1850 = windLines.find(l => l.type === 'snapshot' && l.tick === 1850);
  assert(snap1850.wind.active === true, 'Expected wind active at tick 1850');
  assert(Math.hypot(snap1850.player.pos[0], snap1850.player.pos[2] + 20) > 1.0, 'Wind must push player');
});

runTest('P2-DRIFT: Drifter (Gió Lạc) chases when carried>=5, steals 3, Pulse causes drifter_drop', () => {
  const { lines } = runCli({
    tag: 'drifter',
    night: 2,
    scenario: {
      player: { pos: [0, 0, 0], carried: 6, flames: 3, invuln_ticks: 90 },
      drifters: [{ id: 'D1', pos: [0, 1.0, 2.5], state: 'idle' }],
      random_motes: false,
      random_shades: false,
      random_drifters: false
    },
    inputs: {
      frames: [
        { tick: 25, pulse: true },
        { tick: 30, pulse: false }
      ]
    },
    ticks: 155,
    snapshotEvery: 5
  });
  const stealEvt = lines.find(l => l.type === 'event' && l.name === 'drifter_steal');
  assert(stealEvt && stealEvt.data.amount === 3 && stealEvt.data.carried === 3, 'Expected drifter_steal amount=3 (even when invuln)');
  const dropEvt = lines.find(l => l.type === 'event' && l.name === 'drifter_drop');
  assert(dropEvt && dropEvt.data.amount === 3, 'Expected pulse on fleeing drifter to trigger drifter_drop');
  const snapEnd = lines.find(l => l.type === 'snapshot' && l.tick === 155);
  assert(snapEnd.drifters[0].state === 'removed', `Expected drifter removed 120 ticks after drop, got ${snapEnd.drifters[0].state}`);
});

runTest('P2-CHARM: Wind Charm grants 7.2 m/s speed & 0 dash cooldown for 600 ticks', () => {
  const { lines } = runCli({
    tag: 'charm',
    night: 2,
    scenario: {
      player: { pos: [34.5, 0, 0], carried: 0 },
      charms: [{ id: 'C1', pos: [35, 0, 0], available: true }],
      random_motes: false,
      random_shades: false,
      random_drifters: false
    },
    inputs: {
      frames: [
        { tick: 0, move: [1, 0] },
        { tick: 15, move: [0, 0], dash: true },
        { tick: 30, dash: false },
        { tick: 32, dash: true } // immediate second dash with 0 cooldown!
      ]
    },
    ticks: 40,
    snapshotEvery: 5
  });
  const charmEvt = lines.find(l => l.type === 'event' && l.name === 'charm_picked');
  assert(charmEvt && charmEvt.data.charm_id === 'C1' && charmEvt.data.charm_ticks === 600, 'Expected charm_picked');
  const dashes = lines.filter(l => l.type === 'event' && l.name === 'dash');
  assert(dashes.length === 2, `Expected 2 dashes with 0 cooldown, got ${dashes.length}`);
  const snap40 = lines.find(l => l.type === 'snapshot' && l.tick === 40);
  assert(snap40.charms[0].available === false && snap40.charms[0].respawn_s > 40, 'Charm should enter respawn timer');
});

runTest('P2-PAUSE: Pause increments tick while freezing sim_tick, time_left_s, and state="paused"', () => {
  const { lines } = runCli({
    tag: 'pause',
    night: 1,
    scenario: { random_motes: false, random_shades: false },
    inputs: {
      frames: [
        { tick: 5, pause: true },
        { tick: 6, pause: false },
        { tick: 25, pause: true },
        { tick: 26, pause: false }
      ]
    },
    ticks: 40,
    snapshotEvery: 5
  });
  const pausedEvt = lines.find(l => l.type === 'event' && l.name === 'paused');
  const resumedEvt = lines.find(l => l.type === 'event' && l.name === 'resumed');
  assert(pausedEvt && resumedEvt, 'Expected paused and resumed events');
  const snap10 = lines.find(l => l.type === 'snapshot' && l.tick === 10);
  const snap20 = lines.find(l => l.type === 'snapshot' && l.tick === 20);
  assert(snap10.state === 'paused' && snap20.state === 'paused', 'Snapshots while paused must record state="paused"');
  assert(snap10.sim_tick === snap20.sim_tick && snap10.time_left_s === snap20.time_left_s, 'sim_tick and time_left_s must freeze while paused');
});

runTest('P2-CONTRACT: Snapshot v1.1 schema + 3-Night Determinism + Invalid Night exit 2', () => {
  for (const n of [1, 2, 3]) {
    const r1 = runCli({ tag: `det_n${n}_a`, seed: 777, night: n, ticks: 120, snapshotEvery: 60 });
    const r2 = runCli({ tag: `det_n${n}_b`, seed: 777, night: n, ticks: 120, snapshotEvery: 60 });
    assert(r1.raw === r2.raw, `Determinism failed on Night ${n}`);
    const snap = r1.lines.find(l => l.type === 'snapshot' && l.tick === 120);
    assert(snap.night === n && snap.wind && typeof snap.wind.active === 'boolean', 'Missing v1.1 root/wind');
    assert(Array.isArray(snap.player.vel) && typeof snap.player.grounded === 'boolean', 'Missing v1.1 player fields');
    assert(Array.isArray(snap.motes) && Array.isArray(snap.drifters) && Array.isArray(snap.charms), 'Missing v1.1 entity arrays');
  }
  let exitCode = 0;
  try {
    execSync(`node "${cliPath}" --seed 1 --night 9 --ticks 10 --out "${path.resolve(tempDir, 'bad_night.jsonl')}"`, { stdio: 'pipe' });
  } catch (err) {
    exitCode = err.status;
  }
  assert(exitCode === 2, `Expected exit code 2 for invalid night, got ${exitCode}`);
});

runTest('P2-PERF: Full Night 3 simulation (18,000 ticks / 300s) finishes in <= 30s', () => {
  const t0 = performance.now();
  const { lines } = runCli({
    tag: 'perf_n3',
    seed: 2026,
    night: 3,
    scenario: { player: { pos: [0, 0, -12], flames: 999 } },
    ticks: 18000,
    snapshotEvery: 600
  });
  const elapsedMs = performance.now() - t0;
  console.log(`         [Benchmark] Night 3 (18,000 ticks) completed in ${elapsedMs.toFixed(1)} ms`);
  assert(elapsedMs <= 30000, `Took ${elapsedMs} ms, exceeded 30,000 ms limit`);
  const endLine = lines.find(l => l.type === 'end');
  assert(endLine && endLine.ticks === 18000, `Expected full 18,000 tick completion, got ${endLine?.ticks}`);
});

// 3. Phase 3 Feature Headless Scenarios (Contract v1.2)
runTest('P3-FUEL: Passive fuel decay (1/s), lantern_out at 0, relight costs 5 motes (+40 score)', () => {
  const { lines } = runCli({
    tag: 'p3_fuel',
    scenario: {
      player: { pos: [0, 0, 23.5], carried: 5 },
      lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: true, fuel: 1.0, ever_lit: true }],
      random_motes: false,
      random_shades: false
    },
    inputs: {
      frames: [
        { tick: 65, interact: true },
        { tick: 70, interact: false }
      ]
    },
    ticks: 80,
    snapshotEvery: 10
  });
  const outEvt = lines.find(l => l.type === 'event' && l.name === 'lantern_out');
  assert(outEvt && outEvt.tick === 60 && outEvt.data.lantern_id === 'L1', 'Expected L1 lantern_out at tick 60');
  const litEvt = lines.find(l => l.type === 'event' && l.name === 'lantern_lit');
  assert(litEvt && litEvt.data.relight === true, 'Expected relight: true for 5-mote relight');
  const snap80 = lines.find(l => l.type === 'snapshot' && l.tick === 80);
  const l1 = snap80.lanterns.find(l => l.id === 'L1');
  assert(l1.lit === true && l1.ever_lit === true && l1.relit_count === 1, 'Expected relit_count=1 and ever_lit=true');
  const endLine = lines.find(l => l.type === 'end');
  assert(endLine.score === 65, `Expected score 65 (5*5 + 40), got ${endLine.score}`);
});

runTest('P3-REFUEL: Refuel lit lantern (+10 fuel/mote), ignore full, knockback on crossing >= 30', () => {
  const { lines } = runCli({
    tag: 'p3_refuel',
    scenario: {
      player: { pos: [0, 0, 23.5], carried: 5 },
      lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: true, fuel: 25 }],
      shades: [{ id: 'S1', pos: [0, 0.8, 22], state: 'chase' }],
      random_motes: false,
      random_shades: false
    },
    inputs: {
      frames: [
        { tick: 0, interact: true },
        { tick: 5, interact: false }
      ]
    },
    ticks: 35,
    snapshotEvery: 5
  });
  const refEvt = lines.find(l => l.type === 'event' && l.name === 'refuel');
  assert(refEvt && refEvt.data.amount === 5 && refEvt.data.fuel > 70, 'Expected refuel 5 motes to ~75 fuel');
  const snap35 = lines.find(l => l.type === 'snapshot' && l.tick === 35);
  const distS1 = Math.hypot(snap35.shades[0].pos[0], snap35.shades[0].pos[2] - 25);
  assert(distS1 >= 5.99, `Expected shade pushed outside 6m safe_radius after refuel >= 30, got ${distS1}`);
});

runTest('P3-DRAIN: Low-fuel (<30) loses safe zone, Shade drains 5/s, fuel_drain every 60t, Pulse +15', () => {
  const { lines } = runCli({
    tag: 'p3_drain',
    scenario: {
      player: { pos: [0, 0, 0], carried: 3 },
      lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: true, fuel: 25 }],
      shades: [{ id: 'S1', pos: [0, 0.8, 26], state: 'wander' }],
      random_motes: false,
      random_shades: false
    },
    ticks: 70,
    snapshotEvery: 10
  });
  const drainEvt = lines.find(l => l.type === 'event' && l.name === 'fuel_drain');
  assert(drainEvt && drainEvt.data.lantern_id === 'L1' && drainEvt.data.shade_id === 'S1', 'Expected fuel_drain event at 60 ticks');
  const snap70 = lines.find(l => l.type === 'snapshot' && l.tick === 70);
  assert(snap70.shades[0].state === 'drain', `Expected S1 state drain, got ${snap70.shades[0].state}`);
  assert(snap70.lanterns[0].fuel < 20, `Expected fuel drained below 20, got ${snap70.lanterns[0].fuel}`);

  // Pulse hitting draining shade awards +15
  const { lines: pulseDrain } = runCli({
    tag: 'p3_pulse_drain',
    scenario: {
      player: { pos: [0, 0, 23], carried: 3 },
      lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: true, fuel: 25 }],
      shades: [{ id: 'S1', pos: [0, 0.8, 25.5], state: 'drain', target_lantern_id: 'L1' }],
      random_motes: false,
      random_shades: false
    },
    inputs: { frames: [{ tick: 0, pulse: true }, { tick: 2, pulse: false }] },
    ticks: 10
  });
  const endLine = pulseDrain.find(l => l.type === 'end');
  assert(endLine.score === 15, `Expected +15 score for pulsing draining shade, got ${endLine.score}`);
});

runTest('P3-WIN & P3-CAP: Dawn survival win (dawn_survived) + Progressive capacity 10..20', () => {
  const { lines: winLines } = runCli({
    tag: 'p3_dawn_win',
    night: 1,
    scenario: {
      player: { pos: [0, 0, 0], flames: 2, successful_lights: 3 },
      lanterns: [
        { id: 'L1', lit: true, fuel: 50 },
        { id: 'L2', lit: true, fuel: 50 },
        { id: 'L3', lit: true, fuel: 50 }
      ],
      random_motes: false,
      random_shades: false,
      time_left_s: 1.0
    },
    ticks: 60,
    snapshotEvery: 60
  });
  const snap0 = winLines.find(l => l.type === 'snapshot' && l.tick === 0);
  assert(snap0.player.capacity === 16, `Expected capacity 10 + 2*3 = 16, got ${snap0.player.capacity}`);
  const over = winLines.find(l => l.type === 'event' && l.name === 'game_over');
  assert(over && over.data.result === 'won' && over.data.reason === 'dawn_survived', 'Expected dawn_survived');
  const endLine = winLines.find(l => l.type === 'end');
  // 3 lit lanterns * (50 + floor(49)) = 297 + 2 flames * 50 = 397
  assert(endLine.score === 397, `Expected dawn bonus score 397, got ${endLine.score}`);

  // Insufficient lit lanterns -> dawn loss
  const { lines: lossLines } = runCli({
    tag: 'p3_dawn_loss',
    night: 1,
    scenario: {
      player: { pos: [0, 0, 0], flames: 3 },
      lanterns: [{ id: 'L1', lit: true, fuel: 50 }, { id: 'L2', lit: true, fuel: 50 }],
      random_motes: false,
      random_shades: false,
      time_left_s: 1.0
    },
    ticks: 60
  });
  const lossOver = lossLines.find(l => l.type === 'event' && l.name === 'game_over');
  assert(lossOver && lossOver.data.result === 'lost' && lossOver.data.reason === 'dawn', 'Expected dawn loss when < 3/5');
});

console.log(`\nTest results: ${passed}/${total} passed.`);
if (passed !== total) {
  process.exit(1);
} else {
  console.log('ALL TESTS PASSED SUCCESSFULLY!');
  process.exit(0);
}
