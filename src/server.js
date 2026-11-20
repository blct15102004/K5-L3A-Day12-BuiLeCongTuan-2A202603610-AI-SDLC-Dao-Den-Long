import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sortLeaderboard, addLeaderboardEntry } from './core/leaderboard.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const dataDir = path.join(rootDir, 'data');
const leaderboardPath = path.join(dataDir, 'leaderboard.json');

function readLeaderboard() {
  try {
    if (!fs.existsSync(leaderboardPath)) return [];
    const parsed = JSON.parse(fs.readFileSync(leaderboardPath, 'utf8'));
    return sortLeaderboard(parsed.entries || []);
  } catch {
    return [];
  }
}

function writeLeaderboard(entries) {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const sorted = sortLeaderboard(entries);
  fs.writeFileSync(leaderboardPath, JSON.stringify({ entries: sorted }, null, 2) + '\n', 'utf8');
  return sorted;
}

// Handle CLI flag: --export-leaderboard <out.json>
const args = process.argv.slice(2);
const exportIdx = args.indexOf('--export-leaderboard');
if (exportIdx !== -1) {
  const outPath = args[exportIdx + 1];
  if (!outPath) {
    console.error('Error: --export-leaderboard requires an output file path.');
    process.exit(1);
  }
  const entries = readLeaderboard();
  const resolvedOut = path.resolve(outPath);
  const outDir = path.dirname(resolvedOut);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  fs.writeFileSync(resolvedOut, JSON.stringify({ entries }, null, 2) + '\n', 'utf8');
  process.exit(0);
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  const reqPath = req.url.split('?')[0];

  if (reqPath === '/api/leaderboard') {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ entries: readLeaderboard() }));
      return;
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => {
        body += chunk;
        if (body.length > 16384) req.destroy();
      });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body);
          const result = addLeaderboardEntry(readLeaderboard(), payload);
          if (!result.ok) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: result.error }));
            return;
          }
          const saved = writeLeaderboard(result.entries);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ entries: saved, entry: result.entry }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
  }

  const staticPath = reqPath === '/' || reqPath === '' ? '/index.html' : reqPath;
  const filePath = path.resolve(rootDir, '.' + staticPath);
  if (!filePath.startsWith(rootDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  res.writeHead(200, {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*'
  });

  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`===============================================`);
  console.log(`   ĐẢO ĐÈN LỒNG - 3D GAME SERVER CHẠY THÀNH CÔNG`);
  console.log(`   Mở trình duyệt: http://127.0.0.1:${PORT}`);
  console.log(`===============================================`);
});
