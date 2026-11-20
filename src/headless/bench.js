#!/usr/bin/env node

import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

function parseArgs(args) {
  const options = {
    seed: 42,
    duration: 30,
    outPath: null
  };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--seed' && i + 1 < args.length) {
      options.seed = parseInt(args[++i], 10);
    } else if (arg === '--duration' && i + 1 < args.length) {
      options.duration = parseFloat(args[++i]);
    } else if (arg === '--out' && i + 1 < args.length) {
      options.outPath = args[++i];
    }
  }
  return options;
}

function findBrowserExecutable() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }
  const candidates = process.platform === 'win32'
    ? [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
      ]
    : process.platform === 'darwin'
      ? [
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
          '/Applications/Chromium.app/Contents/MacOS/Chromium'
        ]
      : [
          '/usr/bin/google-chrome',
          '/usr/bin/chromium',
          '/usr/bin/chromium-browser',
          '/usr/bin/microsoft-edge'
        ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  if (process.platform === 'linux') {
    for (const bin of ['google-chrome', 'chromium', 'chromium-browser', 'microsoft-edge']) {
      try {
        const found = execSync(`which ${bin}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
        if (found) return found;
      } catch { /* ignore */ }
    }
  }
  return null;
}

function sampleBrowserMemMb(procName, launchDate) {
  try {
    if (process.platform === 'win32') {
      const name = path.basename(procName, '.exe');
      const iso = launchDate.toISOString();
      const cmd = `powershell -NoProfile -Command "$t=[DateTime]::Parse('${iso}').AddSeconds(-2); $s=(Get-Process -Name '${name}' -ErrorAction SilentlyContinue | Where-Object { $_.StartTime -ge $t } | Measure-Object WorkingSet64 -Sum).Sum; if($s){[Math]::Round($s/1MB,1)}"`;
      const out = execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'], timeout: 1500 }).toString().trim();
      const val = parseFloat(out);
      return Number.isFinite(val) && val > 0 ? val : null;
    }
  } catch { /* ignore */ }
  return null;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.outPath || isNaN(options.seed) || isNaN(options.duration) || options.duration <= 0) {
    console.error('Error: valid --seed, --duration (> 0), and --out are required.');
    process.exit(1);
  }

  const browserBin = findBrowserExecutable();
  if (!browserBin) {
    console.error('Error: No Chromium/Chrome/Edge browser executable found (set CHROME_PATH if installed elsewhere).');
    process.exit(1);
  }

  let benchResult = null;
  let resolveDone;
  const donePromise = new Promise((res) => { resolveDone = res; });

  const server = http.createServer((req, res) => {
    const urlPath = req.url.split('?')[0];
    if (req.method === 'POST' && urlPath === '/__bench_result') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          benchResult = JSON.parse(body);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end('{"ok":true}');
          resolveDone();
        } catch (err) {
          res.writeHead(400);
          res.end(err.message);
        }
      });
      return;
    }

    const reqPath = urlPath === '/' || urlPath === '' ? '/index.html' : urlPath;
    const filePath = path.resolve(rootDir, '.' + reqPath);
    if (!filePath.startsWith(rootDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });

  await new Promise((res) => server.listen(0, '127.0.0.1', res));
  const port = server.address().port;
  const tmpProfileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-bench-'));
  const launchDate = new Date();
  const launchMs = launchDate.getTime();

  const targetUrl = `http://127.0.0.1:${port}/index.html?bench=1&seed=${options.seed}&duration=${options.duration}&t0=${launchMs}`;
  const args = [
    `--app=${targetUrl}`,
    '--window-size=1280,720',
    '--disable-gpu-vsync',
    '--disable-frame-rate-limit',
    `--user-data-dir=${tmpProfileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    '--autoplay-policy=no-user-gesture-required'
  ];

  if (process.platform === 'linux' && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
    args.push('--headless=new', '--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-webgl', '--ignore-gpu-blocklist');
  }

  const child = spawn(browserBin, args, { stdio: 'ignore' });
  let peakMemMb = null;

  // Sample RSS once during unmeasured warmup (1.8s) and once right after benchmark finishes
  // so no external process polling perturbs Chrome frame times during measurement.
  const warmupMemTimer = setTimeout(() => {
    const sample = sampleBrowserMemMb(browserBin, launchDate);
    if (sample !== null && (peakMemMb === null || sample > peakMemMb)) {
      peakMemMb = sample;
    }
  }, 1800);

  const timeoutMs = (options.duration + 45) * 1000;
  const timer = setTimeout(() => {
    console.error(`Error: Benchmark timed out after ${timeoutMs / 1000}s.`);
    clearTimeout(warmupMemTimer);
    try { child.kill(); } catch { /* ignore */ }
    server.close();
    process.exit(1);
  }, timeoutMs);

  await donePromise;
  clearTimeout(timer);
  clearTimeout(warmupMemTimer);

  const finalSample = sampleBrowserMemMb(browserBin, launchDate);
  if (finalSample !== null && (peakMemMb === null || finalSample > peakMemMb)) {
    peakMemMb = finalSample;
  }

  try { child.kill(); } catch { /* ignore */ }
  server.close();
  setTimeout(() => {
    try { fs.rmSync(tmpProfileDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }, 300);

  const report = {
    contract_version: '1.3',
    avg_fps: benchResult.avg_fps,
    p1_low_fps: benchResult.p1_low_fps,
    frame_ms_p95: benchResult.frame_ms_p95,
    frames: benchResult.frames,
    load_ms: benchResult.load_ms,
    peak_mem_mb: peakMemMb,
    vsync_off: true,
    renderer: benchResult.renderer || 'Custom WebGL 1.0 Renderer',
    os: `${os.type()} ${os.release()} (${os.arch()})`
  };

  const outDir = path.dirname(path.resolve(options.outPath));
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  fs.writeFileSync(options.outPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

main();
