#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { GameEngine, round1 } from '../core/game.js';
import { PRNG } from '../core/prng.js';

function parseArgs(args) {
  const options = {
    seed: 7,
    nights: 10,
    outPath: null
  };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--seed' && i + 1 < args.length) {
      options.seed = parseInt(args[++i], 10);
    } else if (arg === '--nights' && i + 1 < args.length) {
      options.nights = parseInt(args[++i], 10);
    } else if (arg === '--out' && i + 1 < args.length) {
      options.outPath = args[++i];
    }
  }
  return options;
}

function getRssMb() {
  return round1(process.memoryUsage().rss / (1024 * 1024));
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.outPath || isNaN(options.seed) || isNaN(options.nights) || options.nights <= 0) {
    console.error('Error: valid --seed, --nights (> 0), and --out are required.');
    process.exit(1);
  }

  const startMs = performance.now();
  let crashes = 0;
  const results = [];
  let memStartMb = null;

  for (let i = 0; i < options.nights; i++) {
    const night = (i % 3) + 1;
    const nightSeed = options.seed + i;
    const inputPrng = new PRNG(((nightSeed + 1) * 2654435761) >>> 0);

    try {
      let engine = new GameEngine({ seed: nightSeed, night });
      if (i === 0) {
        memStartMb = getRssMb();
      }

      const maxTicks = engine.totalDuration * 60;
      const moveVec = [0, 0];
      const input = {
        move: moveVec,
        cam_yaw_deg: 0,
        jump: false,
        dash: false,
        pulse: false,
        interact: false,
        pause: false
      };

      for (let t = 0; t < maxTicks; t++) {
        if (t % 30 === 0) {
          const ang = inputPrng.range(0, Math.PI * 2);
          moveVec[0] = Math.cos(ang);
          moveVec[1] = Math.sin(ang);
        }
        input.jump = inputPrng.next() < 0.05;
        input.dash = inputPrng.next() < 0.03;
        input.pulse = inputPrng.next() < 0.02;
        input.interact = inputPrng.next() < 0.10;
        engine.step(input);
        if (engine.state === 'won' || engine.state === 'lost') {
          break;
        }
      }

      results.push(engine.state === 'won' ? 'won' : 'lost');
      engine = null;
    } catch (err) {
      crashes += 1;
      results.push('lost');
      console.error(`Soak crash on iteration ${i} (Night ${night}, seed ${nightSeed}): ${err.message}`);
    }
  }

  if (typeof global.gc === 'function') {
    global.gc();
  }
  const memEndMb = getRssMb();
  const durationS = round1((performance.now() - startMs) / 1000);

  const report = {
    nights: options.nights,
    crashes,
    results,
    mem_start_mb: memStartMb ?? memEndMb,
    mem_end_mb: memEndMb,
    duration_s: durationS
  };

  const outDir = path.dirname(path.resolve(options.outPath));
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  fs.writeFileSync(options.outPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
  process.exit(0);
}

main();
