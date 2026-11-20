import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

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

console.log('--- RUNNING SUITE: DAO DEN LONG TEST SUITE ---');

// Test 1: Movement and Camera Yaw
runTest('REQ-02: Player movement and camera yaw transformation', () => {
  const inputsFile = path.resolve(tempDir, 'in_move.json');
  fs.writeFileSync(inputsFile, JSON.stringify({
    frames: [
      { tick: 0, move: [0, 1], cam_yaw_deg: 90 }, // +Z facing 90 deg -> moves in +X
      { tick: 60, move: [0, 0] }
    ]
  }));
  const outFile = path.resolve(tempDir, 'out_move.jsonl');
  execSync(`node "${cliPath}" --seed 123 --night 1 --inputs "${inputsFile}" --ticks 60 --out "${outFile}"`);

  const lines = fs.readFileSync(outFile, 'utf8').trim().split('\n').map(l => JSON.parse(l));
  const finalSnap = lines.filter(l => l.type === 'snapshot').pop();
  
  // At yaw 90 deg, move [0, 1] gives x' = 0*cos(90) + 1*sin(90) = 1, z' = 0
  // Speed is 6.0 m/s for 1 sec (60 ticks) -> pos.x should be approx 6.0
  if (finalSnap.player.pos[0] < 5.8 || finalSnap.player.pos[0] > 6.2) {
    throw new Error(`Expected player.pos[0] around 6.0, got ${finalSnap.player.pos[0]}`);
  }
});

// Test 2: Mote pickup
runTest('REQ-03: Mote pickup within pickup_radius and score update', () => {
  const scenarioFile = path.resolve(__dirname, 'scenarios/scenario_pickup.json');
  const inputsFile = path.resolve(__dirname, 'scenarios/inputs_pickup.json');
  const outFile = path.resolve(tempDir, 'out_pickup.jsonl');
  execSync(`node "${cliPath}" --seed 123 --night 1 --scenario "${scenarioFile}" --inputs "${inputsFile}" --ticks 60 --out "${outFile}"`);

  const lines = fs.readFileSync(outFile, 'utf8').trim().split('\n').map(l => JSON.parse(l));
  const pickEvt = lines.find(l => l.type === 'event' && l.name === 'mote_picked');
  if (!pickEvt) throw new Error('mote_picked event not found');
  if (pickEvt.data.carried !== 1) throw new Error(`Expected carried 1, got ${pickEvt.data.carried}`);

  const endLine = lines.find(l => l.type === 'end');
  if (endLine.score < 10) throw new Error(`Expected score >= 10, got ${endLine.score}`);
});

// Test 3: Lantern deposit & lighting
runTest('REQ-04: Lantern deposit and lantern_lit event', () => {
  const scenarioFile = path.resolve(__dirname, 'scenarios/scenario_deposit.json');
  const inputsFile = path.resolve(__dirname, 'scenarios/inputs_deposit.json');
  const outFile = path.resolve(tempDir, 'out_deposit.jsonl');
  execSync(`node "${cliPath}" --seed 123 --night 1 --scenario "${scenarioFile}" --inputs "${inputsFile}" --ticks 30 --out "${outFile}"`);

  const lines = fs.readFileSync(outFile, 'utf8').trim().split('\n').map(l => JSON.parse(l));
  const depEvt = lines.find(l => l.type === 'event' && l.name === 'deposit');
  if (!depEvt) throw new Error('deposit event not found');
  if (depEvt.data.amount !== 3 || depEvt.data.deposited !== 3) {
    throw new Error(`Expected deposit amount 3, got ${depEvt.data.amount}`);
  }

  const litEvt = lines.find(l => l.type === 'event' && l.name === 'lantern_lit');
  if (!litEvt) throw new Error('lantern_lit event not found');
  if (litEvt.data.lantern_id !== 'L1') throw new Error(`Expected lantern L1, got ${litEvt.data.lantern_id}`);
});

// Test 4: Pulse xua đuổi & Stun
runTest('REQ-06: Pulse action stuns shade and pushes back', () => {
  const scenarioFile = path.resolve(__dirname, 'scenarios/scenario_pulse.json');
  const inputsFile = path.resolve(__dirname, 'scenarios/inputs_pulse.json');
  const outFile = path.resolve(tempDir, 'out_pulse.jsonl');
  execSync(`node "${cliPath}" --seed 123 --night 1 --scenario "${scenarioFile}" --inputs "${inputsFile}" --ticks 30 --out "${outFile}"`);

  const lines = fs.readFileSync(outFile, 'utf8').trim().split('\n').map(l => JSON.parse(l));
  const pulseEvt = lines.find(l => l.type === 'event' && l.name === 'pulse');
  if (!pulseEvt) throw new Error('pulse event not found');
  if (!pulseEvt.data.stunned_ids.includes('S1')) {
    throw new Error('S1 should be in stunned_ids');
  }

  const snap = lines.filter(l => l.type === 'snapshot').pop();
  const shade = snap.shades.find(s => s.id === 'S1');
  if (shade.state !== 'stunned') {
    throw new Error(`Expected S1 state "stunned", got ${shade.state}`);
  }
  // S1 was at [0, 0, 3], push distance is 4.0m -> Z should be approx 7.0
  if (shade.pos[2] < 6.5) {
    throw new Error(`Expected S1 pushed to z >= 6.5, got ${shade.pos[2]}`);
  }
});

// Test 5: Shade hit player & Lose life
runTest('REQ-05: Shade hit player reduces flame and drops motes', () => {
  const scenarioFile = path.resolve(__dirname, 'scenarios/scenario_hit.json');
  const outFile = path.resolve(tempDir, 'out_hit.jsonl');
  execSync(`node "${cliPath}" --seed 123 --night 1 --scenario "${scenarioFile}" --ticks 10 --out "${outFile}"`);

  const lines = fs.readFileSync(outFile, 'utf8').trim().split('\n').map(l => JSON.parse(l));
  const hitEvt = lines.find(l => l.type === 'event' && l.name === 'player_hit');
  if (!hitEvt) throw new Error('player_hit event not found');
  if (hitEvt.data.by !== 'shade') throw new Error(`Expected hit by shade, got ${hitEvt.data.by}`);
  if (hitEvt.data.flames !== 2) throw new Error(`Expected flames 2, got ${hitEvt.data.flames}`);
  if (hitEvt.data.dropped !== 2) throw new Error(`Expected dropped 2 (50% of 4), got ${hitEvt.data.dropped}`);
});

// Test 6: Win condition on all lanterns lit
runTest('REQ-08: Win game when all lanterns lit', () => {
  const scenarioFile = path.resolve(__dirname, 'scenarios/scenario_win.json');
  const inputsFile = path.resolve(__dirname, 'scenarios/inputs_deposit.json');
  const outFile = path.resolve(tempDir, 'out_win.jsonl');
  execSync(`node "${cliPath}" --seed 123 --night 1 --scenario "${scenarioFile}" --inputs "${inputsFile}" --ticks 30 --out "${outFile}"`);

  const lines = fs.readFileSync(outFile, 'utf8').trim().split('\n').map(l => JSON.parse(l));
  const winEvt = lines.find(l => l.type === 'event' && l.name === 'game_over' && l.data.result === 'won');
  if (!winEvt) throw new Error('game_over won event not found');
  if (winEvt.data.reason !== 'all_lit') throw new Error(`Expected reason all_lit, got ${winEvt.data.reason}`);

  const endLine = lines.find(l => l.type === 'end');
  if (endLine.state !== 'won') throw new Error(`Expected end state "won", got ${endLine.state}`);
});

// Test 7: Determinism check (identical output byte-for-byte)
runTest('REQ-09: Pure determinism across repeated executions', () => {
  const out1 = path.resolve(tempDir, 'out_det1.jsonl');
  const out2 = path.resolve(tempDir, 'out_det2.jsonl');
  execSync(`node "${cliPath}" --seed 999 --night 1 --ticks 200 --out "${out1}"`);
  execSync(`node "${cliPath}" --seed 999 --night 1 --ticks 200 --out "${out2}"`);

  const content1 = fs.readFileSync(out1, 'utf8');
  const content2 = fs.readFileSync(out2, 'utf8');
  if (content1 !== content2) {
    throw new Error('Deterministic outputs differ between runs with identical seed!');
  }
});

// Test 8: Exit code 2 on invalid scenario
runTest('Contract: Exit code 2 on invalid JSON scenario', () => {
  const badScenario = path.resolve(tempDir, 'bad_scenario.json');
  fs.writeFileSync(badScenario, '{ this is not valid json }');
  const outFile = path.resolve(tempDir, 'out_bad.jsonl');
  try {
    execSync(`node "${cliPath}" --seed 1 --night 1 --scenario "${badScenario}" --ticks 10 --out "${outFile}"`, { stdio: 'pipe' });
    throw new Error('Expected process to fail with exit code 2, but succeeded');
  } catch (err) {
    if (err.status !== 2) {
      throw new Error(`Expected exit status 2, got ${err.status}`);
    }
  }
});

console.log(`\nTest results: ${passed}/${total} passed.`);
if (passed !== total) {
  process.exit(1);
} else {
  console.log('ALL TESTS PASSED SUCCESSFULLY!');
  process.exit(0);
}
