#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { GameEngine } from '../core/game.js';

function parseArgs(args) {
  const options = {
    seed: 42,
    night: 1,
    scenarioPath: null,
    inputsPath: null,
    ticks: 600,
    outPath: null,
    snapshotEvery: 10
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--seed' && i + 1 < args.length) {
      options.seed = parseInt(args[++i], 10);
    } else if (arg === '--night' && i + 1 < args.length) {
      options.night = parseInt(args[++i], 10);
    } else if (arg === '--scenario' && i + 1 < args.length) {
      options.scenarioPath = args[++i];
    } else if (arg === '--inputs' && i + 1 < args.length) {
      options.inputsPath = args[++i];
    } else if (arg === '--ticks' && i + 1 < args.length) {
      options.ticks = parseInt(args[++i], 10);
    } else if (arg === '--out' && i + 1 < args.length) {
      options.outPath = args[++i];
    } else if (arg === '--snapshot-every' && i + 1 < args.length) {
      options.snapshotEvery = parseInt(args[++i], 10);
    }
  }

  return options;
}

function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (!options.outPath || isNaN(options.ticks) || isNaN(options.seed) || isNaN(options.snapshotEvery) || options.snapshotEvery <= 0) {
    console.error('Error: valid --ticks, --out, --seed, and --snapshot-every (> 0) are required.');
    process.exit(1);
  }

  if (![1, 2, 3].includes(options.night)) {
    console.error(`Error: invalid --night value (${options.night}). Must be 1, 2, or 3.`);
    process.exit(2);
  }

  let scenario = null;
  if (options.scenarioPath) {
    try {
      const scenarioContent = fs.readFileSync(options.scenarioPath, 'utf8');
      scenario = JSON.parse(scenarioContent);
    } catch (err) {
      console.error(`Error reading or parsing scenario file: ${err.message}`);
      process.exit(2);
    }
  }

  let inputs = null;
  if (options.inputsPath) {
    try {
      const inputsContent = fs.readFileSync(options.inputsPath, 'utf8');
      inputs = JSON.parse(inputsContent);
      if (!inputs || !Array.isArray(inputs.frames)) {
        console.error('Error: inputs file must have a "frames" array.');
        process.exit(2);
      }
    } catch (err) {
      console.error(`Error reading or parsing inputs file: ${err.message}`);
      process.exit(2);
    }
  }

  const framesMap = new Map();
  if (inputs && inputs.frames) {
    let lastTick = -1;
    for (const frame of inputs.frames) {
      if (typeof frame.tick !== 'number' || frame.tick <= lastTick) {
        console.error('Error: frame ticks must be strictly increasing.');
        process.exit(2);
      }
      lastTick = frame.tick;
      framesMap.set(frame.tick, frame);
    }
  }

  const engine = new GameEngine({
    seed: options.seed,
    night: options.night,
    scenario
  });

  const outputLines = [];

  // Snapshot tick 0 (state after scenario setup, before any input)
  outputLines.push(JSON.stringify(engine.getSnapshot()));
  outputLines.push(JSON.stringify({
    type: 'event',
    tick: 0,
    name: 'night_start',
    data: { night: options.night }
  }));

  let currentInput = {
    move: [0, 0],
    cam_yaw_deg: 0,
    jump: false,
    interact: false,
    pulse: false,
    dash: false,
    pause: false
  };

  const totalTicks = options.ticks;
  for (let k = 0; k < totalTicks; k++) {
    if (framesMap.has(k)) {
      const frame = framesMap.get(k);
      currentInput = {
        ...currentInput,
        ...frame
      };
    }

    const events = engine.step(currentInput);

    for (const evt of events) {
      outputLines.push(JSON.stringify(evt));
    }

    if (engine.tickCount % options.snapshotEvery === 0) {
      outputLines.push(JSON.stringify(engine.getSnapshot()));
    }

    if (engine.state === 'won' || engine.state === 'lost') {
      break;
    }
  }

  const endLine = {
    type: 'end',
    ticks: engine.tickCount,
    state: engine.state,
    score: engine.score
  };
  outputLines.push(JSON.stringify(endLine));

  const outDir = path.dirname(path.resolve(options.outPath));
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(options.outPath, outputLines.join('\n') + '\n', 'utf8');
  process.exit(0);
}

main();
