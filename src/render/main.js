import { GameEngine, distXZ } from '../core/game.js';
import { PALETTE } from '../core/constants.js';
import { getNightConfig, getGroundHeight } from '../core/maps.js';
import { addLeaderboardEntry, sortLeaderboard, formatIsoWithTimezone } from '../core/leaderboard.js';
import { WebGLRenderer } from './webgl-renderer.js';
import { SoundEffects } from './audio.js';
import { SKILL_CATALOG, getShadeVariant, getMoteColor } from './entity-models.js';

const STORAGE_KEY = 'dao_den_long_settings_v2';
const LB_LOCAL_KEY = 'dao_den_long_leaderboard_v1';

const DEFAULT_KEYBINDS = {
  moveUp: 'KeyW',
  moveDown: 'KeyS',
  moveLeft: 'KeyA',
  moveRight: 'KeyD',
  jump: 'Space',
  dash: 'ShiftLeft',
  interact: 'KeyE',
  pulse: 'KeyQ',
  pause: 'KeyP'
};

const KEYBIND_LABELS = {
  moveUp: 'Đi lên',
  moveDown: 'Đi xuống',
  moveLeft: 'Sang trái',
  moveRight: 'Sang phải',
  jump: 'Nhảy',
  dash: 'Lướt',
  interact: 'Nạp đèn',
  pulse: 'Tỏa Sáng',
  pause: 'Tạm dừng'
};

const defaultSettings = {
  difficulty: 'normal',
  volume: 0.7,
  sensitivity: 0.4,
  colorblind: false,
  reducedMotion: false,
  largeText: false,
  keybinds: { ...DEFAULT_KEYBINDS }
};

const DIFFICULTY_PROFILES = {
  easy: {
    id: 'easy',
    label: '🌱 Dễ',
    desc: 'Ít quái vật sinh ra nhất · tốc độ quái chậm nhất, thư thái ngắm cảnh',
    maxShadesByNight: [3, 4, 5],
    shadeIntervalTicks: 660,
    shadeSpeedByNight: [2.30, 2.30, 2.55],
    wanderScale: 0.72,
    maxDrifters: 1
  },
  normal: {
    id: 'normal',
    label: '🌙 Trung bình',
    desc: 'Nhiều quái hơn mức Dễ một chút · tốc độ quái chậm như ở mức Dễ',
    maxShadesByNight: [5, 6, 7],
    shadeIntervalTicks: 510,
    shadeSpeedByNight: [2.30, 2.30, 2.55],
    wanderScale: 0.72,
    maxDrifters: 2
  },
  hard: {
    id: 'hard',
    label: '🔥 Khó',
    desc: 'Số lượng quái như mức Trung bình · tốc độ quái tăng cao đầy thử thách',
    maxShadesByNight: [5, 6, 7],
    shadeIntervalTicks: 510,
    shadeSpeedByNight: [3.45, 3.45, 3.80],
    wanderScale: 0.95,
    maxDrifters: 2
  }
};

function getDifficultyProfile(diffKey) {
  return DIFFICULTY_PROFILES[diffKey] || DIFFICULTY_PROFILES.normal;
}

function applyDifficultyToEngine(eng, diffKey) {
  if (!eng || eng.benchmarkMode) return;
  const prof = getDifficultyProfile(diffKey);
  const nIdx = Math.max(0, Math.min(2, (eng.night || 1) - 1));
  eng.map.maxShades = prof.maxShadesByNight[nIdx];
  eng.map.shadeIntervalTicks = prof.shadeIntervalTicks;
  eng.map.shadeSpeed = prof.shadeSpeedByNight[nIdx];
  if (eng.map.maxDrifters > 0) {
    eng.map.maxDrifters = prof.maxDrifters;
  }
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultSettings, keybinds: { ...DEFAULT_KEYBINDS } };
    const parsed = JSON.parse(raw);
    return {
      ...defaultSettings,
      ...parsed,
      keybinds: { ...DEFAULT_KEYBINDS, ...(parsed.keybinds || {}) }
    };
  } catch {
    return { ...defaultSettings, keybinds: { ...DEFAULT_KEYBINDS } };
  }
}

function saveSettings(s) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch { /* ignore */ }
}

function formatKeyCode(code) {
  if (!code) return '?';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code === 'Space') return 'Space';
  if (code === 'ShiftLeft' || code === 'ShiftRight') return 'Shift';
  return code;
}

const urlParams = new URLSearchParams(window.location.search);
const isBenchmarkMode = urlParams.get('bench') === '1';

const settings = loadSettings();
const canvas = document.getElementById('game-canvas');
const audio = new SoundEffects();
audio.setVolume(settings.volume);
const renderer = new WebGLRenderer(canvas);

// DOM Elements
const motionBlurOverlay = document.getElementById('motion-blur-overlay');
const screenFlash = document.getElementById('screen-flash');
const hudEl = document.getElementById('hud');
const bottomHudEl = document.getElementById('bottom-hud');
const controlsGuideEl = document.getElementById('controls-guide');
const hudFlames = document.getElementById('hud-flames');
const hudDifficulty = document.getElementById('hud-difficulty');
const hudCharm = document.getElementById('hud-charm');
const menuDiffDesc = document.getElementById('menu-diff-desc');
const diffButtons = Array.from(document.querySelectorAll('.diff-btn'));
const hudThreats = document.getElementById('hud-threats');
const hudNight = document.getElementById('hud-night');
const hudTimer = document.getElementById('hud-timer');
const hudWind = document.getElementById('hud-wind');
const hudLanterns = document.getElementById('hud-lanterns');
const hudScore = document.getElementById('hud-score');
const hudFps = document.getElementById('hud-fps');
const moteBar = document.getElementById('mote-bar');
const moteBarLabel = document.getElementById('mote-bar-label');
const lblDashKey = document.getElementById('lbl-dash-key');
const lblPulseKey = document.getElementById('lbl-pulse-key');
const cdDash = document.getElementById('cd-dash');
const cdPulse = document.getElementById('cd-pulse');
const skillCardBox = document.getElementById('skill-card-box');
const lblSkillCard = document.getElementById('lbl-skill-card');
const cdSkillCard = document.getElementById('cd-skill-card');
const monsterToastStack = document.getElementById('monster-toast-stack');
const subtitleBanner = document.getElementById('subtitle-banner');
const interactPrompt = document.getElementById('interact-prompt');

// Overlays
const menuOverlay = document.getElementById('menu-overlay');
const introOverlay = document.getElementById('intro-overlay');
const introTitle = document.getElementById('intro-title');
const introQuote = document.getElementById('intro-quote');
const pauseOverlay = document.getElementById('pause-overlay');
const settingsOverlay = document.getElementById('settings-overlay');
const leaderboardOverlay = document.getElementById('leaderboard-overlay');
const leaderboardTbody = document.getElementById('leaderboard-tbody');
const resultOverlay = document.getElementById('result-overlay');
const resultTitle = document.getElementById('result-title');
const resultDesc = document.getElementById('result-desc');
const saveScorePanel = document.getElementById('save-score-panel');
const playerNameInput = document.getElementById('player-name-input');
const btnSaveScore = document.getElementById('btn-save-score');
const saveScoreMsg = document.getElementById('save-score-msg');
const nextNightBtn = document.getElementById('next-night-btn');
const retryNightBtn = document.getElementById('retry-night-btn');

const volSlider = document.getElementById('setting-volume');
const sensSlider = document.getElementById('setting-sensitivity');
const colorblindToggle = document.getElementById('setting-colorblind');
const reducedMotionToggle = document.getElementById('setting-reduced-motion');
const largeTextToggle = document.getElementById('setting-large-text');
const volValLabel = document.getElementById('setting-volume-val');
const sensValLabel = document.getElementById('setting-sensitivity-val');
const keybindGrid = document.getElementById('keybind-grid');
const keybindAlert = document.getElementById('keybind-alert');

for (let i = 0; i < 20; i++) {
  const slot = document.createElement('div');
  slot.className = 'mote-slot';
  moteBar.appendChild(slot);
}

let lastMotionOpacity = 0;
const hudCache = {
  flames: null,
  charm: null,
  threats: null,
  night: null,
  timer: null,
  timerDanger: null,
  timerCb: null,
  wind: null,
  windCb: null,
  lanterns: null,
  score: null,
  fps: null,
  moteLabel: null,
  carried: -1,
  cap: -1,
  dashText: null,
  dashOnCd: null,
  pulseText: null,
  pulseOnCd: null,
  skillKey: null,
  subtitle: null,
  subtitleCb: null,
  interact: null
};

let listeningAction = null;

function applyAccessibilityClasses() {
  document.body.classList.toggle('large-text', !!settings.largeText);
  document.body.classList.toggle('reduced-motion', !!settings.reducedMotion);
  const kb = settings.keybinds;
  controlsGuideEl.innerHTML =
    `<div><span class="kbd">${formatKeyCode(kb.moveUp)}${formatKeyCode(kb.moveLeft)}${formatKeyCode(kb.moveDown)}${formatKeyCode(kb.moveRight)}</span> Chạy · <span class="kbd">${formatKeyCode(kb.jump)}</span> Nhảy · <span class="kbd">${formatKeyCode(kb.dash)}</span> Lướt</div>` +
    `<div><span class="kbd">${formatKeyCode(kb.interact)}</span> Nạp · <span class="kbd">${formatKeyCode(kb.pulse)}</span> Tỏa Sáng · <span class="kbd">Chuột Trái</span> Kỹ Năng · <span class="kbd">${formatKeyCode(kb.pause)}</span> Dừng</div>`;
  lblDashKey.innerText = `Lướt (${formatKeyCode(kb.dash)})`;
  lblPulseKey.innerText = `Tỏa Sáng (${formatKeyCode(kb.pulse)})`;
}

function renderKeybindGrid() {
  keybindGrid.innerHTML = '';
  for (const action of Object.keys(DEFAULT_KEYBINDS)) {
    const item = document.createElement('div');
    item.className = 'keybind-item';
    const label = document.createElement('span');
    label.innerText = KEYBIND_LABELS[action];
    const btn = document.createElement('button');
    btn.className = 'keybind-btn' + (listeningAction === action ? ' listening' : '');
    btn.innerText = listeningAction === action ? '...' : formatKeyCode(settings.keybinds[action]);
    btn.addEventListener('click', () => {
      listeningAction = action;
      keybindAlert.classList.add('hidden');
      renderKeybindGrid();
    });
    item.appendChild(label);
    item.appendChild(btn);
    keybindGrid.appendChild(item);
  }
}

function syncDifficultyUI() {
  const prof = getDifficultyProfile(settings.difficulty);
  for (const btn of diffButtons) {
    btn.classList.toggle('active', btn.dataset.diff === prof.id);
  }
  if (menuDiffDesc) menuDiffDesc.innerText = prof.desc;
  if (hudDifficulty) hudDifficulty.innerText = prof.label;
}

for (const btn of diffButtons) {
  btn.addEventListener('click', () => {
    const newDiff = btn.dataset.diff;
    if (!DIFFICULTY_PROFILES[newDiff]) return;
    settings.difficulty = newDiff;
    saveSettings(settings);
    syncDifficultyUI();
    applyDifficultyToEngine(engine, settings.difficulty);
  });
}

function syncSettingsUI() {
  volSlider.value = Math.round(settings.volume * 100);
  volValLabel.innerText = `${volSlider.value}%`;
  sensSlider.value = settings.sensitivity.toFixed(2);
  sensValLabel.innerText = settings.sensitivity.toFixed(2);
  colorblindToggle.checked = !!settings.colorblind;
  reducedMotionToggle.checked = !!settings.reducedMotion;
  largeTextToggle.checked = !!settings.largeText;
  syncDifficultyUI();
  applyAccessibilityClasses();
  renderKeybindGrid();
}
syncSettingsUI();

colorblindToggle.addEventListener('change', () => { settings.colorblind = colorblindToggle.checked; saveSettings(settings); });
reducedMotionToggle.addEventListener('change', () => { settings.reducedMotion = reducedMotionToggle.checked; applyAccessibilityClasses(); saveSettings(settings); });
largeTextToggle.addEventListener('change', () => { settings.largeText = largeTextToggle.checked; applyAccessibilityClasses(); saveSettings(settings); });
volSlider.addEventListener('input', () => {
  settings.volume = parseInt(volSlider.value, 10) / 100;
  volValLabel.innerText = `${volSlider.value}%`;
  audio.setVolume(settings.volume);
  saveSettings(settings);
});
sensSlider.addEventListener('input', () => {
  settings.sensitivity = parseFloat(sensSlider.value);
  sensValLabel.innerText = settings.sensitivity.toFixed(2);
  saveSettings(settings);
});
document.getElementById('btn-reset-keybinds').addEventListener('click', () => {
  listeningAction = null;
  settings.keybinds = { ...DEFAULT_KEYBINDS };
  keybindAlert.classList.add('hidden');
  saveSettings(settings);
  syncSettingsUI();
});

// Campaign state
let uiScreen = 'menu';
let currentNight = 1;
let totalCampaignScore = 0;
let campaignNightsWon = 0;
let campaignSeed = 101;
let scoreSavedThisRun = false;
let engine = new GameEngine({ seed: campaignSeed, night: 1 });
let camYawDeg = 0;
let prevCamYawDeg = 0;
let camYawVel = 0;
let camDist = 6.2;
let camHeight = 2.85;
let camFocusPos = [0, 0, 0];
let camFocusInit = false;
let camClipFrac = 1.0;
let dashCamOffset = 0;
let smoothMoveX = 0;
let smoothMoveZ = 0;
let prevPlayerPos = [0, 0, 0];
let renderPlayerPos = [0, 0, 0];
let lastCountdownSec = -1;
let cameraShakeTicks = 0;
let subtitleState = { text: '', expiresAt: 0 };
const knownDrifterIds = new Set();

// Live Gameplay Skill Cards & Auto-Aim Projectiles (strictly disabled in benchmarkMode)
let groundSkillCards = [];
let heldSkillCards = [];
let activeProjectiles = [];
let nextSkillSpawnTick = 180;
let skillCardRngState = 1337;

function nextSkillRand() {
  skillCardRngState = (Math.imul(skillCardRngState, 1664525) + 1013904223) >>> 0;
  return skillCardRngState / 4294967296;
}

function findBestAutoAimTarget() {
  if (!engine) return null;
  const px = engine.player.pos[0], py = engine.player.pos[1], pz = engine.player.pos[2];
  const yawRad = (camYawDeg * Math.PI) / 180;
  const lookX = Math.sin(yawRad), lookZ = Math.cos(yawRad);
  let best = null;
  let bestScore = Infinity;

  const evalCandidate = (kind, obj) => {
    const dx = obj.pos[0] - px;
    const dy = obj.pos[1] - py;
    const dz = obj.pos[2] - pz;
    const d = Math.hypot(dx, dy, dz);
    if (d > 42.0) return;
    const xzD = Math.hypot(dx, dz) || 1;
    const dot = (dx * lookX + dz * lookZ) / xzD;
    const rank = d - dot * 5.0; // slight preference for monsters in front of camera
    if (rank < bestScore) {
      bestScore = rank;
      best = { kind, id: obj.id, pos: obj.pos, ref: obj };
    }
  };

  for (let i = 0; i < engine.shades.length; i++) {
    evalCandidate('shade', engine.shades[i]);
  }
  for (let i = 0; i < engine.drifters.length; i++) {
    if (engine.drifters[i].state !== 'removed') {
      evalCandidate('drifter', engine.drifters[i]);
    }
  }
  return best;
}

function spawnRandomSkillCard() {
  if (groundSkillCards.length >= 3) return;
  const cfg = engine.map;
  for (let attempt = 0; attempt < 24; attempt++) {
    let x = 0, z = 0;
    if (engine.night === 2) {
      const cx = nextSkillRand() < 0.5 ? 0 : 70;
      const r = 6.0 + nextSkillRand() * 19.0;
      const a = nextSkillRand() * Math.PI * 2;
      x = cx + Math.cos(a) * r;
      z = Math.sin(a) * r;
    } else {
      const maxR = engine.night === 1 ? 35.0 : 39.0;
      const r = 5.0 + nextSkillRand() * (maxR - 5.0);
      const a = nextSkillRand() * Math.PI * 2;
      x = Math.cos(a) * r;
      z = Math.sin(a) * r;
    }
    const y = getGroundHeight(engine.night, x, z);
    if (y === null) continue;
    if (Math.hypot(x - engine.player.pos[0], z - engine.player.pos[2]) < 5.0) continue;
    if (cfg.lanterns.some(l => Math.hypot(x - l.pos[0], z - l.pos[2]) < 3.4)) continue;
    if (groundSkillCards.some(c => Math.hypot(x - c.pos[0], z - c.pos[2]) < 8.0)) continue;
    const skill = SKILL_CATALOG[Math.floor(nextSkillRand() * SKILL_CATALOG.length)];
    groundSkillCards.push({ id: `SC_${Date.now()}_${attempt}`, pos: [x, y, z], skill });
    renderer.spawnBurst([x, y + 0.5, z], skill.color, 10, 2.2, 2.0);
    return;
  }
}

function castHeldSkillCard() {
  if (isBenchmarkMode || uiScreen !== 'playing' || engine.state !== 'playing') return;
  if (engine.player.respawnTicks > 0 || engine.player.flames <= 0) return;
  if (heldSkillCards.length === 0) return;

  const target = findBestAutoAimTarget();
  if (!target) {
    showSubtitle('✨ Chưa có quái vật trong tầm ngắm!', 1400);
    return;
  }

  const skill = heldSkillCards.shift();
  const startPos = [
    renderer.mayLanternPos ? renderer.mayLanternPos[0] : engine.player.pos[0],
    renderer.mayLanternPos ? renderer.mayLanternPos[1] : engine.player.pos[1] + 1.2,
    renderer.mayLanternPos ? renderer.mayLanternPos[2] : engine.player.pos[2]
  ];
  const dx = target.pos[0] - startPos[0];
  const dy = (target.pos[1] + 0.15) - startPos[1];
  const dz = target.pos[2] - startPos[2];
  const d = Math.hypot(dx, dy, dz) || 1;
  activeProjectiles.push({
    pos: startPos,
    dir: [dx / d, dy / d, dz / d],
    speed: 28.0,
    skill,
    targetKind: target.kind,
    targetId: target.id,
    trail: []
  });
  audio.playSkillCast(skill.id);
  const cCss = `rgba(${Math.round(skill.color[0] * 255)}, ${Math.round(skill.color[1] * 255)}, ${Math.round(skill.color[2] * 255)}, 0.35)`;
  triggerFlash(cCss);
  showSubtitle(`${skill.icon} ${skill.name}!`, 1300);
}

const keys = {};
let isMouseDown = false;
let lastMouseX = 0;
let lastMouseY = 0;
let pauseKeyTriggered = false;
let lastPointerUnlockMs = 0;

function showSubtitle(text, durationMs = 2500) {
  const prefix = settings.colorblind ? '⚠ ' : '';
  subtitleState = { text: prefix + text, expiresAt: performance.now() + durationMs };
}

function getRelativeDirLabel(fromPos, toPos, yawDegVal) {
  const dx = toPos[0] - fromPos[0];
  const dz = toPos[2] - fromPos[2];
  const dist = Math.hypot(dx, dz);
  const yawRad = (yawDegVal * Math.PI) / 180;
  const fwd = dx * Math.sin(yawRad) + dz * Math.cos(yawRad);
  const right = -dx * Math.cos(yawRad) + dz * Math.sin(yawRad);
  let dirText = 'phía trước';
  if (Math.abs(fwd) >= Math.abs(right)) {
    dirText = fwd >= 0 ? 'phía trước' : 'phía sau';
  } else {
    dirText = right >= 0 ? 'bên phải' : 'bên trái';
  }
  return `${dirText}, ${Math.round(dist)}m`;
}

function pushMonsterToast(message, kind = 'shade', durationMs = 3400) {
  const toast = document.createElement('div');
  const cbClass = settings.colorblind ? ' cb' : '';
  toast.className = `monster-toast ${kind}${cbClass}`;
  toast.innerText = (settings.colorblind ? '⚠ ' : '') + message;
  monsterToastStack.appendChild(toast);
  while (monsterToastStack.children.length > 3) {
    monsterToastStack.removeChild(monsterToastStack.firstChild);
  }
  const fadeDelay = Math.max(400, durationMs - 300);
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }, fadeDelay);
}

function triggerFlash(rgba) {
  if (settings.reducedMotion) return;
  screenFlash.style.background = rgba;
  screenFlash.style.opacity = '0.55';
  setTimeout(() => { screenFlash.style.opacity = '0'; }, 60);
}

// Leaderboard API / localStorage helpers
async function fetchLeaderboard() {
  try {
    const res = await fetch('/api/leaderboard');
    if (res.ok) {
      const data = await res.json();
      return data.entries || [];
    }
  } catch { /* fallback */ }
  try {
    return sortLeaderboard(JSON.parse(localStorage.getItem(LB_LOCAL_KEY) || '[]'));
  } catch {
    return [];
  }
}

async function submitLeaderboardScore(name) {
  const payload = {
    name,
    score: totalCampaignScore,
    nights_won: campaignNightsWon,
    achieved_at: formatIsoWithTimezone(new Date()),
    seed: campaignSeed
  };
  try {
    const res = await fetch('/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error || 'Lỗi lưu điểm.' };
    try { localStorage.setItem(LB_LOCAL_KEY, JSON.stringify(data.entries)); } catch { /* ignore */ }
    return { ok: true, entries: data.entries };
  } catch {
    const existing = await fetchLeaderboard();
    const res = addLeaderboardEntry(existing, payload);
    if (res.ok) localStorage.setItem(LB_LOCAL_KEY, JSON.stringify(res.entries));
    return res;
  }
}

async function openLeaderboard() {
  const entries = await fetchLeaderboard();
  leaderboardTbody.innerHTML = '';
  if (entries.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="5" style="text-align:center;color:#8FA3B8;">Chưa có kỷ lục nào.</td>';
    leaderboardTbody.appendChild(tr);
  } else {
    entries.forEach((e, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${idx + 1}</td><td>${e.name}</td><td style="color:#F2C14E;font-weight:700;">${e.score}</td><td>${e.nights_won}/3</td><td>${e.seed}</td>`;
      leaderboardTbody.appendChild(tr);
    });
  }
  leaderboardOverlay.classList.remove('hidden');
}

document.getElementById('btn-open-leaderboard').addEventListener('click', openLeaderboard);
document.getElementById('btn-close-leaderboard').addEventListener('click', () => leaderboardOverlay.classList.add('hidden'));

btnSaveScore.addEventListener('click', async () => {
  if (scoreSavedThisRun) return;
  const res = await submitLeaderboardScore(playerNameInput.value);
  saveScoreMsg.classList.remove('hidden');
  if (!res.ok) {
    saveScoreMsg.style.color = settings.colorblind ? '#FFFFFF' : '#FF5A5F';
    saveScoreMsg.innerText = (settings.colorblind ? '⚠ ' : '') + res.error;
  } else {
    scoreSavedThisRun = true;
    btnSaveScore.disabled = true;
    saveScoreMsg.style.color = '#F2C14E';
    saveScoreMsg.innerText = 'Đã lưu vào Bảng Xếp Hạng!';
  }
});

let settingsReturnScreen = 'menu';
function openSettings(fromScreen) {
  settingsReturnScreen = fromScreen;
  listeningAction = null;
  keybindAlert.classList.add('hidden');
  syncSettingsUI();
  settingsOverlay.classList.remove('hidden');
}

function lockPointer() {
  if (isBenchmarkMode) return;
  try {
    if (canvas.requestPointerLock && document.pointerLockElement !== canvas) {
      const p = canvas.requestPointerLock();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    }
  } catch { /* ignore */ }
}

function unlockPointer() {
  try {
    if (document.pointerLockElement === canvas && document.exitPointerLock) {
      document.exitPointerLock();
    }
  } catch { /* ignore */ }
}

function showScreen(screen) {
  uiScreen = screen;
  menuOverlay.classList.toggle('hidden', screen !== 'menu');
  introOverlay.classList.toggle('hidden', screen !== 'intro');
  pauseOverlay.classList.toggle('hidden', screen !== 'paused');
  resultOverlay.classList.toggle('hidden', screen !== 'result' && screen !== 'dawn');
  const inGame = !isBenchmarkMode && (screen === 'playing' || screen === 'paused');
  hudEl.classList.toggle('hidden', !inGame);
  bottomHudEl.classList.toggle('hidden', !inGame);
  monsterToastStack.classList.toggle('hidden', !inGame);
  canvas.classList.toggle('hide-cursor', !isBenchmarkMode && screen === 'playing');
  if (screen !== 'playing') {
    unlockPointer();
    audio.stopAmbientLoops();
    if (motionBlurOverlay && lastMotionOpacity !== 0) {
      motionBlurOverlay.style.opacity = '0';
      lastMotionOpacity = 0;
    }
  }
  if (!inGame) {
    interactPrompt.classList.add('hidden');
    subtitleBanner.classList.add('hidden');
    monsterToastStack.innerHTML = '';
    hudCache.flames = null;
    hudCache.charm = null;
    hudCache.threats = null;
    hudCache.night = null;
    hudCache.timer = null;
    hudCache.wind = null;
    hudCache.lanterns = null;
    hudCache.score = null;
    hudCache.fps = null;
    hudCache.moteLabel = null;
    hudCache.carried = -1;
    hudCache.cap = -1;
    hudCache.dashText = null;
    hudCache.pulseText = null;
    hudCache.skillKey = null;
    hudCache.subtitle = null;
    hudCache.interact = null;
  }
}

function startNightIntro(night, resetCampaign = false) {
  audio.init();
  if (resetCampaign) {
    totalCampaignScore = 0;
    campaignNightsWon = 0;
    campaignSeed = Date.now() & 0xfffffff;
  }
  currentNight = night;
  if (!isBenchmarkMode && engine.night !== night) {
    engine = new GameEngine({ seed: campaignSeed + night - 1, night });
    applyDifficultyToEngine(engine, settings.difficulty);
  }
  if (!isBenchmarkMode) {
    renderer.getNightScenery(night);
  }
  const cfg = getNightConfig(night);
  introTitle.innerText = cfg.name;
  introQuote.innerText = cfg.introQuote;
  showScreen('intro');
}

const prevMotesPool = [];
const remainingMoteIdSet = new Set();
const preShadePosMap = new Map();
const preDrifterPosMap = new Map();

function beginNightPlay() {
  audio.init();
  audio.startBgm();
  engine = new GameEngine({ seed: campaignSeed + currentNight - 1, night: currentNight });
  applyDifficultyToEngine(engine, settings.difficulty);
  renderer.resetVisualTrails();
  preShadePosMap.clear();
  preDrifterPosMap.clear();
  lowFpsStreak = 0;
  camYawDeg = 0;
  prevCamYawDeg = 0;
  camYawVel = 0;
  camClipFrac = 1.0;
  dashCamOffset = 0;
  if (motionBlurOverlay) {
    motionBlurOverlay.style.opacity = '0';
    lastMotionOpacity = 0;
  }
  camHeight = 2.85;
  camFocusInit = false;
  smoothMoveX = 0;
  smoothMoveZ = 0;
  prevPlayerPos = [...engine.player.pos];
  renderPlayerPos = [...engine.player.pos];
  lastCountdownSec = -1;
  cameraShakeTicks = 0;
  knownDrifterIds.clear();
  groundSkillCards.length = 0;
  heldSkillCards.length = 0;
  activeProjectiles.length = 0;
  nextSkillSpawnTick = 180;
  skillCardRngState = (campaignSeed + currentNight * 7919) >>> 0;
  audio.stopAmbientLoops();
  monsterToastStack.innerHTML = '';
  subtitleState = { text: '', expiresAt: 0 };
  showScreen('playing');
  lockPointer();
}

document.getElementById('btn-play-campaign').addEventListener('click', () => startNightIntro(1, true));
document.getElementById('btn-select-n1').addEventListener('click', () => startNightIntro(1, true));
document.getElementById('btn-select-n2').addEventListener('click', () => startNightIntro(2, true));
document.getElementById('btn-select-n3').addEventListener('click', () => startNightIntro(3, true));
document.getElementById('btn-menu-settings').addEventListener('click', () => openSettings('menu'));
document.getElementById('btn-start-night').addEventListener('click', beginNightPlay);

document.getElementById('btn-resume').addEventListener('click', () => {
  if (engine.state === 'paused') {
    engine.step({ pause: true });
    engine.prevButtons.pause = false;
  }
  showScreen('playing');
  lockPointer();
});
document.getElementById('btn-pause-restart').addEventListener('click', beginNightPlay);
document.getElementById('btn-pause-settings').addEventListener('click', () => openSettings('paused'));
document.getElementById('btn-pause-menu').addEventListener('click', () => { audio.stopBgm(); showScreen('menu'); });

document.getElementById('btn-close-settings').addEventListener('click', () => {
  listeningAction = null;
  settingsOverlay.classList.add('hidden');
  showScreen(settingsReturnScreen);
});

nextNightBtn.addEventListener('click', () => startNightIntro(currentNight + 1, false));
retryNightBtn.addEventListener('click', beginNightPlay);
document.getElementById('btn-result-menu').addEventListener('click', () => { audio.stopBgm(); showScreen('menu'); });

window.addEventListener('keydown', (e) => {
  if (listeningAction) {
    e.preventDefault();
    if (e.code === 'Escape') {
      listeningAction = null;
      renderKeybindGrid();
      return;
    }
    const conflict = Object.entries(settings.keybinds).find(([act, k]) => act !== listeningAction && k === e.code);
    if (conflict) {
      keybindAlert.classList.remove('hidden');
      keybindAlert.innerText = `⚠ Phím ${formatKeyCode(e.code)} đã được gán cho "${KEYBIND_LABELS[conflict[0]]}"!`;
      return;
    }
    settings.keybinds[listeningAction] = e.code;
    listeningAction = null;
    keybindAlert.classList.add('hidden');
    saveSettings(settings);
    syncSettingsUI();
    return;
  }

  if (document.activeElement === playerNameInput) return;

  if (e.code === 'Escape' && !e.repeat) {
    if (!settingsOverlay.classList.contains('hidden')) {
      listeningAction = null;
      settingsOverlay.classList.add('hidden');
      showScreen(settingsReturnScreen);
      return;
    }
    if (!leaderboardOverlay.classList.contains('hidden')) {
      leaderboardOverlay.classList.add('hidden');
      return;
    }
  }

  if (uiScreen === 'playing' && ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
    e.preventDefault();
  }
  keys[e.code] = true;
  if ((e.code === 'Escape' || e.code === settings.keybinds.pause) && !e.repeat) {
    if (e.code === 'Escape' && performance.now() - lastPointerUnlockMs < 150) return;
    if (uiScreen === 'playing' || uiScreen === 'paused') {
      pauseKeyTriggered = true;
    }
  }
});

window.addEventListener('keyup', (e) => { keys[e.code] = false; });

canvas.addEventListener('mousedown', (e) => {
  isMouseDown = true;
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
  if (uiScreen === 'playing' && !isBenchmarkMode) {
    lockPointer();
    if (e.button === 0) castHeldSkillCard();
  }
});

window.addEventListener('mouseup', () => { isMouseDown = false; });

window.addEventListener('mousemove', (e) => {
  if (uiScreen === 'playing' && !isBenchmarkMode) {
    if (document.pointerLockElement === canvas) {
      camYawDeg -= e.movementX * settings.sensitivity;
      camHeight = Math.max(1.4, Math.min(5.8, camHeight + e.movementY * settings.sensitivity * 0.035));
    } else if (isMouseDown) {
      const dx = e.clientX - lastMouseX;
      const dy = e.clientY - lastMouseY;
      camYawDeg -= dx * settings.sensitivity;
      camHeight = Math.max(1.4, Math.min(5.8, camHeight + dy * settings.sensitivity * 0.035));
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    }
  }
});

window.addEventListener('wheel', (e) => {
  if (uiScreen === 'playing' && !isBenchmarkMode) {
    camDist = Math.max(3.8, Math.min(10.8, camDist + Math.sign(e.deltaY) * 0.55));
  }
}, { passive: true });

document.addEventListener('pointerlockchange', () => {
  if (!isBenchmarkMode && document.pointerLockElement !== canvas && uiScreen === 'playing' && engine.state === 'playing') {
    lastPointerUnlockMs = performance.now();
    engine.step({ pause: true });
    engine.prevButtons.pause = false;
    showScreen('paused');
  }
});

canvas.addEventListener('webglcontextlost', (e) => e.preventDefault());

const initialRendererInfo = renderer.getRendererInfo ? renderer.getRendererInfo() : '';
let dynScale = (!isBenchmarkMode && /Intel|SwiftShader/i.test(initialRendererInfo)) ? 0.82 : 1.0;

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (isBenchmarkMode) {
    canvas.width = w;
    canvas.height = h;
  } else {
    const maxPixels = 1280 * 720;
    const curPixels = Math.max(1, w * h);
    const baseScale = curPixels > maxPixels ? Math.sqrt(maxPixels / curPixels) : 1.0;
    const effScale = baseScale * dynScale;
    canvas.width = Math.max(320, Math.round(w * effScale));
    canvas.height = Math.max(180, Math.round(h * effScale));
  }
}
window.addEventListener('resize', resize);
resize();

let fpsFrames = 0;
let fpsLastTime = performance.now();
let currentFps = 60;
let lastAdaptTime = performance.now();
let lowFpsStreak = 0;

function updateHUD(camera) {
  const now = performance.now();
  const flamesStr = '🔥'.repeat(Math.max(0, engine.player.flames)) || '💀';
  if (hudCache.flames !== flamesStr) {
    hudCache.flames = flamesStr;
    hudFlames.innerText = flamesStr;
  }

  const charmStr = engine.player.charmTicks > 0 ? `🎐 Bùa Gió ${(engine.player.charmTicks / 60).toFixed(1)}s` : '';
  if (hudCache.charm !== charmStr) {
    hudCache.charm = charmStr;
    if (charmStr) {
      hudCharm.classList.remove('hidden');
      hudCharm.innerText = charmStr;
    } else {
      hudCharm.classList.add('hidden');
    }
  }

  const activeShadeCount = engine.shades.length;
  let activeDrifterCount = 0;
  for (let i = 0; i < engine.drifters.length; i++) {
    if (engine.drifters[i].state !== 'removed') activeDrifterCount++;
  }
  const threatStr = activeShadeCount + activeDrifterCount > 0
    ? (activeDrifterCount > 0 ? `🌑 ${activeShadeCount} · 💨 ${activeDrifterCount}` : `🌑 ${activeShadeCount}`)
    : '';
  if (hudCache.threats !== threatStr) {
    hudCache.threats = threatStr;
    if (threatStr) {
      hudThreats.classList.remove('hidden');
      hudThreats.innerText = threatStr;
    } else {
      hudThreats.classList.add('hidden');
    }
  }

  if (hudCache.night !== engine.map.name) {
    hudCache.night = engine.map.name;
    hudNight.innerText = engine.map.name;
  }
  const mins = Math.floor(engine.timeLeft / 60);
  const secs = Math.floor(engine.timeLeft % 60);
  const timerStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  const isDangerTime = engine.timeLeft <= 30.0;
  const fullTimerStr = (isDangerTime && settings.colorblind ? '⚠ ' : '') + timerStr;
  if (hudCache.timer !== fullTimerStr) {
    hudCache.timer = fullTimerStr;
    hudTimer.innerText = fullTimerStr;
  }
  if (hudCache.timerDanger !== isDangerTime) {
    hudCache.timerDanger = isDangerTime;
    hudTimer.classList.toggle('timer-danger', isDangerTime);
  }
  const timerCb = isDangerTime && !!settings.colorblind;
  if (hudCache.timerCb !== timerCb) {
    hudCache.timerCb = timerCb;
    hudTimer.classList.toggle('colorblind-alert', timerCb);
  }

  let windStr = '';
  if (engine.night === 3 && (engine.wind.warning || engine.wind.active)) {
    const warnPrefix = settings.colorblind ? '⚠ ' : '';
    windStr = engine.wind.warning ? `${warnPrefix}🍃 SẮP CÓ GIÓ MẠNH!` : `${warnPrefix}💨 GIÓ THỔI (${Math.round(engine.wind.dir_deg)}°)`;
  }
  if (hudCache.wind !== windStr || hudCache.windCb !== !!settings.colorblind) {
    hudCache.wind = windStr;
    hudCache.windCb = !!settings.colorblind;
    if (windStr) {
      hudWind.classList.remove('hidden');
      hudWind.innerText = windStr;
      hudWind.classList.toggle('colorblind-alert', !!settings.colorblind);
    } else {
      hudWind.classList.add('hidden');
    }
  }

  let litCount = 0;
  for (let i = 0; i < engine.lanterns.length; i++) {
    if (engine.lanterns[i].lit) litCount++;
  }
  const reqLit = Math.ceil(engine.tuning.win_ratio * engine.lanterns.length);
  const lanStr = `${litCount} / ${engine.lanterns.length} (cần ${reqLit})`;
  if (hudCache.lanterns !== lanStr) {
    hudCache.lanterns = lanStr;
    hudLanterns.innerText = lanStr;
  }
  if (hudCache.score !== engine.score) {
    hudCache.score = engine.score;
    hudScore.innerText = `${engine.score}`;
  }
  if (hudCache.fps !== currentFps) {
    hudCache.fps = currentFps;
    hudFps.innerText = `${currentFps} FPS`;
  }

  const cap = engine.getCarryCapacity();
  if (hudCache.carried !== engine.player.carried || hudCache.cap !== cap) {
    hudCache.carried = engine.player.carried;
    hudCache.cap = cap;
    moteBarLabel.innerText = `Đom Đóm (${engine.player.carried} / ${cap})`;
    const slots = moteBar.children;
    for (let i = 0; i < 20; i++) {
      slots[i].classList.toggle('hidden', i >= cap);
      slots[i].classList.toggle('filled', i < engine.player.carried);
    }
  }

  const dashSec = engine.player.dashCdTicks / 60;
  const dashStr = engine.player.charmTicks > 0 ? '∞' : (dashSec > 0 ? `${dashSec.toFixed(1)}s` : 'Sẵn');
  const dashOnCd = dashSec > 0 && engine.player.charmTicks === 0;
  if (hudCache.dashText !== dashStr) {
    hudCache.dashText = dashStr;
    cdDash.innerText = dashStr;
  }
  if (hudCache.dashOnCd !== dashOnCd) {
    hudCache.dashOnCd = dashOnCd;
    cdDash.classList.toggle('on-cd', dashOnCd);
  }

  const pulseSec = engine.player.pulseCdTicks / 60;
  const canPulse = pulseSec === 0 && engine.player.carried >= engine.tuning.pulse_cost;
  const pulseStr = pulseSec > 0 ? `${pulseSec.toFixed(1)}s` : (canPulse ? 'Sẵn' : `${engine.player.carried}/3`);
  const pulseOnCd = !canPulse;
  if (hudCache.pulseText !== pulseStr) {
    hudCache.pulseText = pulseStr;
    cdPulse.innerText = pulseStr;
  }
  if (hudCache.pulseOnCd !== pulseOnCd) {
    hudCache.pulseOnCd = pulseOnCd;
    cdPulse.classList.toggle('on-cd', pulseOnCd);
  }

  if (skillCardBox && lblSkillCard && cdSkillCard) {
    const skillKey = heldSkillCards.length > 0 ? `${heldSkillCards[0].id}_${heldSkillCards.length}` : 'empty';
    if (hudCache.skillKey !== skillKey) {
      hudCache.skillKey = skillKey;
      if (heldSkillCards.length > 0) {
        const topSkill = heldSkillCards[0];
        const colCss = `rgb(${Math.round(topSkill.color[0] * 255)},${Math.round(topSkill.color[1] * 255)},${Math.round(topSkill.color[2] * 255)})`;
        skillCardBox.classList.add('ready');
        skillCardBox.style.borderColor = colCss;
        lblSkillCard.innerText = `${topSkill.icon} ${topSkill.name} (${heldSkillCards.length}/3)`;
        cdSkillCard.innerText = 'Chuột Trái 🎯';
        cdSkillCard.classList.remove('on-cd');
        cdSkillCard.style.color = colCss;
      } else {
        skillCardBox.classList.remove('ready');
        skillCardBox.style.borderColor = '';
        lblSkillCard.innerText = 'Thẻ Kỹ Năng (0/3)';
        cdSkillCard.innerText = 'Nhặt trên đất';
        cdSkillCard.classList.add('on-cd');
        cdSkillCard.style.color = '';
      }
    }
  }

  // Subtitles / Visual Cues (priority: active subtitle -> low-fuel lantern cue)
  let subStr = '';
  if (subtitleState.text && now < subtitleState.expiresAt) {
    subStr = subtitleState.text;
  } else if (uiScreen === 'playing') {
    let lowIds = '';
    for (let i = 0; i < engine.lanterns.length; i++) {
      const l = engine.lanterns[i];
      if (l.lit && l.fuelUnits < 1800) lowIds = lowIds ? `${lowIds}, ${l.id}` : l.id;
    }
    if (lowIds) subStr = `${settings.colorblind ? '⚠ ' : ''}🏮 Đèn ${lowIds} sắp tắt (<30%)!`;
  }
  if (hudCache.subtitle !== subStr || hudCache.subtitleCb !== !!settings.colorblind) {
    hudCache.subtitle = subStr;
    hudCache.subtitleCb = !!settings.colorblind;
    if (subStr) {
      subtitleBanner.innerText = subStr;
      subtitleBanner.classList.toggle('colorblind-alert', !!settings.colorblind);
      subtitleBanner.classList.remove('hidden');
    } else {
      subtitleBanner.classList.add('hidden');
    }
  }

  // Interact Prompt
  let nearLantern = null;
  for (let i = 0; i < engine.lanterns.length; i++) {
    const l = engine.lanterns[i];
    const isValid = !l.lit || (l.lit && l.fuelUnits < 6000);
    if (isValid && distXZ(engine.player.pos, l.pos) <= engine.tuning.interact_radius && Math.abs(engine.player.pos[1] - l.pos[1]) <= 2.5) {
      nearLantern = l;
      break;
    }
  }
  const intKey = formatKeyCode(settings.keybinds.interact);
  let intStr = '';
  if (nearLantern && uiScreen === 'playing') {
    if (!nearLantern.lit) {
      const cost = nearLantern.everLit ? engine.tuning.relight_cost : engine.tuning.lantern_cost;
      intStr = nearLantern.everLit
        ? `${intKey} — Thắp lại đèn (${nearLantern.deposited}/${cost})`
        : `${intKey} — Nạp ánh sáng (${nearLantern.deposited}/${cost})`;
    } else {
      intStr = `${intKey} — Tiếp nhiên liệu (${Math.round(nearLantern.fuelUnits / 60)}%)`;
    }
  }
  if (hudCache.interact !== intStr) {
    hudCache.interact = intStr;
    if (intStr) {
      interactPrompt.classList.remove('hidden');
      interactPrompt.innerText = intStr;
    } else {
      interactPrompt.classList.add('hidden');
    }
  }
}

function showNamePrompt() {
  scoreSavedThisRun = false;
  btnSaveScore.disabled = false;
  saveScoreMsg.classList.add('hidden');
  saveScorePanel.classList.remove('hidden');
}

function handleGameEnd() {
  if (engine.state === 'won') {
    audio.playWin();
    totalCampaignScore += engine.score;
    campaignNightsWon += 1;
    if (currentNight < 3) {
      resultTitle.innerText = `🌟 HOÀN THÀNH ĐÊM ${currentNight}! 🌟`;
      resultTitle.style.color = '#F2C14E';
      resultDesc.innerText = `Điểm Đêm ${currentNight}: ${engine.score}\nTổng điểm chiến dịch: ${totalCampaignScore}`;
      saveScorePanel.classList.add('hidden');
      nextNightBtn.classList.remove('hidden');
      retryNightBtn.classList.add('hidden');
      showScreen('result');
    } else {
      resultTitle.innerText = '☀️ BÌNH MINH ĐÃ TỚI! ☀️';
      resultTitle.style.color = '#FFE9B0';
      resultDesc.innerText = `Chúc mừng! Mây đã giữ ánh sáng qua cả ba đêm!\nĐiểm Đêm 3: ${engine.score}\nTỔNG ĐIỂM TOÀN CHẶNG: ${totalCampaignScore}`;
      showNamePrompt();
      nextNightBtn.classList.add('hidden');
      retryNightBtn.classList.remove('hidden');
      showScreen('dawn');
    }
  } else if (engine.state === 'lost') {
    audio.playLose();
    resultTitle.innerText = '🌑 ĐÊM CHƯA QUA...';
    resultTitle.style.color = settings.colorblind ? '#FFFFFF' : '#FF5A5F';
    const reason = engine.gameOverReason === 'dawn' ? 'Đã hết thời gian nhưng số đèn sáng chưa đủ' : 'Mây đã mất hết Ngọn Lửa sinh mệnh';
    resultDesc.innerText = `${reason}.\nĐiểm Đêm ${currentNight}: ${engine.score}\nTổng điểm chiến dịch: ${totalCampaignScore}`;
    showNamePrompt();
    nextNightBtn.classList.add('hidden');
    retryNightBtn.classList.remove('hidden');
    showScreen('result');
  }
}

function runBenchmarkDriver() {
  document.body.classList.add('benchmark-mode');
  const seed = parseInt(urlParams.get('seed') || '42', 10);
  const durationSec = parseFloat(urlParams.get('duration') || '30');
  const t0 = parseFloat(urlParams.get('t0') || String(Date.now()));

  engine = new GameEngine({ seed, night: 1, benchmark: true });
  showScreen('benchmark');

  let firstFrameDone = false;
  let loadMs = 0;
  let warmupEndPerf = 0;
  let measureEndPerf = 0;
  let prevPerf = performance.now();
  let accumulator = 0;
  let reported = false;
  const dtList = [];
  const camera = { eye: [30, 15, 0], target: [0, 0, 0] };

  function benchLoop(now) {
    if (!firstFrameDone) {
      firstFrameDone = true;
      loadMs = Math.max(1, Math.round(Date.now() - t0));
      warmupEndPerf = now + 3000;
      measureEndPerf = warmupEndPerf + durationSec * 1000;
      prevPerf = now;
    }

    const dt = now - prevPerf;
    prevPerf = now;

    if (now >= warmupEndPerf && now <= measureEndPerf && dt > 0) {
      dtList.push(dt);
    }

    accumulator += Math.min(100, dt);
    while (accumulator >= 1000 / 60) {
      engine.step({});
      accumulator -= 1000 / 60;
    }

    const elapsedOrbitSec = (engine.simTick / 60);
    const angle = (elapsedOrbitSec / 15.0) * Math.PI * 2;
    camera.eye[0] = 30 * Math.cos(angle);
    camera.eye[1] = 15;
    camera.eye[2] = -30 * Math.sin(angle);

    renderer.render(engine, camera, dt / 1000, { benchmarkMode: true });
    if (renderer.gl) renderer.gl.finish();

    if (now >= measureEndPerf && !reported) {
      reported = true;
      const n = Math.max(1, dtList.length);
      const sumDt = dtList.reduce((a, b) => a + b, 0) || 1;
      const avgFps = Math.round((1000 * n / sumDt) * 10) / 10;
      const sortedDesc = [...dtList].sort((a, b) => b - a);
      const k = Math.max(1, Math.ceil(0.01 * n));
      const worstMean = sortedDesc.slice(0, k).reduce((a, b) => a + b, 0) / k;
      const p1LowFps = Math.round((1000 / Math.max(0.001, worstMean)) * 10) / 10;
      const sortedAsc = [...sortedDesc].reverse();
      const p95Idx = Math.min(n - 1, Math.floor(0.95 * (n - 1)));
      const p95Ms = Math.round(sortedAsc[p95Idx] * 10) / 10;

      fetch('/__bench_result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          avg_fps: avgFps,
          p1_low_fps: p1LowFps,
          frame_ms_p95: p95Ms,
          frames: n,
          load_ms: loadMs,
          renderer: renderer.getRendererInfo()
        })
      }).catch(() => {});
      return;
    }
    requestAnimationFrame(benchLoop);
  }
  requestAnimationFrame(benchLoop);
}

if (isBenchmarkMode) {
  runBenchmarkDriver();
} else {
  let lastTime = performance.now();
  const tickInterval = 1000 / 60;
  let accumulator = 0;

  function resolveSceneryCollisions() {
    if (engine.player.respawnTicks > 0 || engine.player.flames <= 0) return;
    const sceneryData = renderer.getNightScenery(engine.night);
    const colliders = sceneryData ? sceneryData.colliders : [];
    const playerR = 0.36;
    const py = engine.player.pos[1];

    const pushOut = (cx, cy, cz, r, h) => {
      if (py >= cy + h || py + 1.45 <= cy - 0.1) return;
      const dx = engine.player.pos[0] - cx;
      const dz = engine.player.pos[2] - cz;
      const d = Math.hypot(dx, dz);
      const minD = r + playerR;
      if (d < minD) {
        const ux = d > 0.0001 ? dx / d : 1;
        const uz = d > 0.0001 ? dz / d : 0;
        const nx = cx + ux * minD;
        const nz = cz + uz * minD;
        const gh = getGroundHeight(engine.night, nx, nz);
        if (gh !== null && Math.abs(gh - py) <= 1.2) {
          engine.player.pos[0] = nx;
          engine.player.pos[2] = nz;
        }
      }
    };

    const ox = 2.8, oz = engine.night === 3 ? -14.5 : -2.5;
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < colliders.length; i++) {
        const c = colliders[i];
        pushOut(c.x, c.y, c.z, c.r, c.h);
      }
      for (let i = 0; i < engine.lanterns.length; i++) {
        const l = engine.lanterns[i];
        pushOut(l.pos[0], l.pos[1], l.pos[2], 0.85, 4.2);
      }
      pushOut(ox, 0, oz, 0.52, 2.0);
    }
  }

  function computeCameraObstructionFraction(target, desiredEye) {
    const tx = target[0], ty = target[1], tz = target[2];
    const dx = desiredEye[0] - tx;
    const dy = desiredEye[1] - ty;
    const dz = desiredEye[2] - tz;
    const distXZVal = Math.hypot(dx, dz);
    if (distXZVal < 0.05) return 1.0;

    let minT = 1.0;
    const camPaddingR = 0.28;

    // 1. Check cylinder obstacle intersection along camera ray (trees, rocks, lanterns, pillars, sacred center tree)
    const testCylinder = (cx, cy, cz, r, h) => {
      const effR = r + camPaddingR;
      const fx = tx - cx;
      const fz = tz - cz;
      const a = dx * dx + dz * dz;
      const b = 2 * (fx * dx + fz * dz);
      const c = fx * fx + fz * fz - effR * effR;
      const disc = b * b - 4 * a * c;
      if (disc <= 0) return;
      const sqrtD = Math.sqrt(disc);
      const tHit = (-b - sqrtD) / (2 * a);
      const tExit = (-b + sqrtD) / (2 * a);
      if (tExit <= 0.12 || tHit >= minT) return;
      const tCheck = Math.max(0.15, tHit);
      const hitY = ty + dy * tCheck;
      if (hitY >= cy - 0.15 && hitY <= cy + h + 0.25) {
        minT = Math.min(minT, Math.max(0.22, tHit - 0.04));
      }
    };

    const sceneryData = renderer.getNightScenery(engine.night);
    const colliders = sceneryData ? sceneryData.colliders : [];
    for (let i = 0; i < colliders.length; i++) {
      const col = colliders[i];
      if (col.r >= 0.42 && col.h >= 1.4) {
        testCylinder(col.x, col.y, col.z, col.r, col.h);
      }
    }
    for (let i = 0; i < engine.lanterns.length; i++) {
      const l = engine.lanterns[i];
      testCylinder(l.pos[0], l.pos[1], l.pos[2], 0.78, 4.1);
    }
    if (engine.night === 3) {
      testCylinder(0, 6.0, 0, 1.55, 11.5);
    }

    // 2. Check cliff walls / elevated terrain platforms along camera ray
    const steps = 10;
    for (let s = 2; s <= steps; s++) {
      const t = s / steps;
      if (t >= minT) break;
      const sx = tx + dx * t;
      const sy = ty + dy * t;
      const sz = tz + dz * t;
      const gY = getGroundHeight(engine.night, sx, sz);
      if (gY !== null && gY > sy - 0.38) {
        // If terrain jumps abruptly above player target (a vertical cliff wall), pull camera in front of wall
        if (gY > ty + 0.45) {
          minT = Math.min(minT, Math.max(0.22, (s - 1.2) / steps));
          break;
        }
      }
    }

    return minT;
  }

  function loop(now) {
    const delta = Math.min(100, now - lastTime);
    lastTime = now;
    accumulator += delta;

    fpsFrames++;
    if (now - fpsLastTime >= 500) {
      currentFps = Math.round((fpsFrames * 1000) / (now - fpsLastTime));
      fpsFrames = 0;
      fpsLastTime = now;
      if (!isBenchmarkMode && uiScreen === 'playing' && now - lastAdaptTime >= 1000) {
        lastAdaptTime = now;
        if (currentFps < 56 && dynScale > 0.70) {
          lowFpsStreak++;
          if (lowFpsStreak >= 2) {
            lowFpsStreak = 0;
            dynScale = Math.max(0.70, Math.round((dynScale - 0.06) * 100) / 100);
            resize();
          }
        } else {
          lowFpsStreak = 0;
        }
      }
    }

    while (accumulator >= tickInterval) {
      if (uiScreen === 'playing' || uiScreen === 'paused') {
        if (pauseKeyTriggered) {
          pauseKeyTriggered = false;
          engine.step({ pause: true });
          engine.prevButtons.pause = false;
          showScreen(engine.state === 'paused' ? 'paused' : 'playing');
          if (uiScreen === 'playing') lockPointer();
        } else if (uiScreen === 'playing' && engine.state === 'playing') {
          prevPlayerPos[0] = engine.player.pos[0];
          prevPlayerPos[1] = engine.player.pos[1];
          prevPlayerPos[2] = engine.player.pos[2];

          const kb = settings.keybinds;
          let targetMx = 0, targetMz = 0;
          if (keys[kb.moveUp] || keys['ArrowUp']) targetMz += 1;
          if (keys[kb.moveDown] || keys['ArrowDown']) targetMz -= 1;
          if (keys[kb.moveRight] || keys['ArrowRight']) targetMx -= 1;
          if (keys[kb.moveLeft] || keys['ArrowLeft']) targetMx += 1;
          const targetMag = Math.hypot(targetMx, targetMz);
          if (targetMag > 1.0) {
            targetMx /= targetMag;
            targetMz /= targetMag;
          }

          const hasMove = targetMag > 0.001;
          const moveBlend = hasMove ? 0.28 : 0.24;
          smoothMoveX += (targetMx - smoothMoveX) * moveBlend;
          smoothMoveZ += (targetMz - smoothMoveZ) * moveBlend;
          if (!hasMove && Math.hypot(smoothMoveX, smoothMoveZ) < 0.015) {
            smoothMoveX = 0;
            smoothMoveZ = 0;
          }

          const input = {
            move: [smoothMoveX, smoothMoveZ],
            cam_yaw_deg: camYawDeg,
            jump: !!keys[kb.jump],
            dash: !!(keys[kb.dash] || (kb.dash === 'ShiftLeft' && keys['ShiftRight'])),
            interact: !!keys[kb.interact],
            pulse: !!(keys[kb.pulse] || (kb.pulse === 'KeyQ' && keys['KeyF']))
          };

          const prevMoteCount = engine.motes.length;
          for (let i = 0; i < prevMoteCount; i++) {
            const m = engine.motes[i];
            let rec = prevMotesPool[i];
            if (!rec) {
              rec = { id: '', x: 0, y: 0, z: 0 };
              prevMotesPool.push(rec);
            }
            rec.id = m.id;
            rec.x = m.pos[0];
            rec.y = m.pos[1];
            rec.z = m.pos[2];
          }
          const diffProf = getDifficultyProfile(settings.difficulty);
          for (let i = 0; i < engine.shades.length; i++) {
            const sh = engine.shades[i];
            let rec = preShadePosMap.get(sh.id);
            if (!rec) {
              rec = { x: 0, z: 0, state: '' };
              preShadePosMap.set(sh.id, rec);
            }
            rec.x = sh.pos[0];
            rec.z = sh.pos[2];
            rec.state = sh.state;
          }
          for (let i = 0; i < engine.drifters.length; i++) {
            const dr = engine.drifters[i];
            if (dr.state === 'removed') continue;
            let rec = preDrifterPosMap.get(dr.id);
            if (!rec) {
              rec = { x: 0, z: 0 };
              preDrifterPosMap.set(dr.id, rec);
            }
            rec.x = dr.pos[0];
            rec.z = dr.pos[2];
          }

          const wasWindWarn = engine.wind.warning;
          const wasGrounded = engine.player.grounded;
          const events = engine.step(input);

          // Per-difficulty monster count & non-chase movement scaling (keeps src/core untouched)
          if (diffProf.id === 'easy' && engine.simTick === 300 && engine.shades.length > 1) {
            const removed = engine.shades.pop();
            if (removed) {
              for (let ei = events.length - 1; ei >= 0; ei--) {
                if (events[ei].name === 'shade_spawned' && events[ei].data && events[ei].data.id === removed.id) {
                  events.splice(ei, 1);
                }
              }
            }
          }
          for (let i = 0; i < engine.shades.length; i++) {
            const sh = engine.shades[i];
            const prev = preShadePosMap.get(sh.id);
            if (prev && sh.state === 'wander' && prev.state === 'wander') {
              sh.pos[0] = prev.x + (sh.pos[0] - prev.x) * diffProf.wanderScale;
              sh.pos[2] = prev.z + (sh.pos[2] - prev.z) * diffProf.wanderScale;
            }
          }
          for (let i = 0; i < engine.drifters.length; i++) {
            const dr = engine.drifters[i];
            const prev = preDrifterPosMap.get(dr.id);
            if (prev && dr.state !== 'removed') {
              dr.pos[0] = prev.x + (dr.pos[0] - prev.x) * diffProf.wanderScale;
              dr.pos[2] = prev.z + (dr.pos[2] - prev.z) * diffProf.wanderScale;
            }
          }

          resolveSceneryCollisions();

          // Live Gameplay Skill Card spawning, pickup & auto-aim projectile elimination
          if (engine.simTick >= nextSkillSpawnTick) {
            spawnRandomSkillCard();
            nextSkillSpawnTick = engine.simTick + 900; // Every 15s
          }
          if (engine.player.respawnTicks === 0 && engine.player.flames > 0 && heldSkillCards.length < 3) {
            for (let i = groundSkillCards.length - 1; i >= 0; i--) {
              const card = groundSkillCards[i];
              if (
                distXZ(engine.player.pos, card.pos) <= 1.65 &&
                Math.abs(engine.player.pos[1] - card.pos[1]) <= 1.6
              ) {
                groundSkillCards.splice(i, 1);
                heldSkillCards.push(card.skill);
                audio.playSkillCardPickup();
                renderer.spawnBurst(card.pos, card.skill.color, 16, 3.4, 2.4);
                showSubtitle(`${card.skill.icon} Nhặt Thẻ: ${card.skill.name} — Click Chuột Trái để dùng!`, 2800);
                if (heldSkillCards.length >= 3) break;
              }
            }
          }

          for (let i = activeProjectiles.length - 1; i >= 0; i--) {
            const proj = activeProjectiles[i];
            let targetObj = proj.targetKind === 'shade'
              ? engine.shades.find(s => s.id === proj.targetId)
              : engine.drifters.find(d => d.id === proj.targetId && d.state !== 'removed');
            if (!targetObj) {
              const fallback = findBestAutoAimTarget();
              if (fallback) {
                proj.targetKind = fallback.kind;
                proj.targetId = fallback.id;
                targetObj = fallback.ref;
              } else {
                activeProjectiles.splice(i, 1);
                continue;
              }
            }
            const tx = targetObj.pos[0], ty = targetObj.pos[1] + 0.15, tz = targetObj.pos[2];
            const dx = tx - proj.pos[0], dy = ty - proj.pos[1], dz = tz - proj.pos[2];
            const dist = Math.hypot(dx, dy, dz);
            const stepDist = proj.speed * (1 / 60);
            if (dist <= Math.max(1.05, stepDist * 1.15)) {
              const hitPos = [tx, targetObj.pos[1], tz];
              if (proj.targetKind === 'shade') {
                const idx = engine.shades.findIndex(s => s.id === proj.targetId);
                if (idx !== -1) engine.shades.splice(idx, 1);
                if (proj.skill.id === 'thunder') {
                  for (const other of engine.shades) {
                    if (Math.hypot(other.pos[0] - tx, other.pos[2] - tz) <= 5.5) {
                      other.state = 'stunned';
                      other.stateTicksLeft = 60;
                    }
                  }
                }
              } else {
                if (targetObj.stolen > 0) {
                  const gY = getGroundHeight(engine.night, tx, tz) ?? engine.player.pos[1];
                  for (let k = 0; k < targetObj.stolen; k++) {
                    const ang = (k * Math.PI * 2) / targetObj.stolen;
                    engine.motes.push({
                      id: `M${engine.moteCounter++}`,
                      pos: [tx + Math.cos(ang) * 0.5, gY, tz + Math.sin(ang) * 0.5],
                      kind: 'dropped',
                      ttlTicks: 900,
                      spawnTick: engine.simTick
                    });
                  }
                }
                targetObj.state = 'removed';
                targetObj.stolen = 0;
              }
              engine.score += proj.skill.bonusScore;
              renderer.triggerSkillImpactVfx(hitPos, proj.skill.color, proj.skill.core);
              audio.playMonsterDeath(proj.skill.id);
              const fCss = `rgba(${Math.round(proj.skill.color[0] * 255)}, ${Math.round(proj.skill.color[1] * 255)}, ${Math.round(proj.skill.color[2] * 255)}, 0.45)`;
              triggerFlash(fCss);
              pushMonsterToast(`${proj.skill.icon} Tiêu diệt quái bằng ${proj.skill.name}! (+${proj.skill.bonusScore})`, 'shade', 2400);
              activeProjectiles.splice(i, 1);
            } else {
              proj.trail.unshift([proj.pos[0], proj.pos[1], proj.pos[2]]);
              if (proj.trail.length > 6) proj.trail.pop();
              proj.dir[0] = dx / dist;
              proj.dir[1] = dy / dist;
              proj.dir[2] = dz / dist;
              proj.pos[0] += proj.dir[0] * stepDist;
              proj.pos[1] += proj.dir[1] * stepDist;
              proj.pos[2] += proj.dir[2] * stepDist;
            }
          }

          let pickedMote = false;
          for (let ei = 0; ei < events.length; ei++) {
            if (events[ei].name === 'mote_picked') { pickedMote = true; break; }
          }
          if (pickedMote) {
            remainingMoteIdSet.clear();
            for (let i = 0; i < engine.motes.length; i++) {
              remainingMoteIdSet.add(engine.motes[i].id);
            }
            for (let i = 0; i < prevMoteCount; i++) {
              const pm = prevMotesPool[i];
              if (!remainingMoteIdSet.has(pm.id)) {
                renderer.triggerMotePickupVfx([pm.x, pm.y, pm.z], getMoteColor(pm.id));
              }
            }
          }

          if (!wasWindWarn && engine.wind.warning) {
            audio.playWindWarning();
            showSubtitle('🍃 Sắp có gió mạnh!', 2200);
          }
          const secCeil = Math.ceil(engine.timeLeft);
          if (secCeil <= 10 && secCeil > 0 && secCeil !== lastCountdownSec) {
            lastCountdownSec = secCeil;
            audio.playCountdownTick();
            showSubtitle(`⏱ Còn ${secCeil}s tới bình minh!`, 950);
          }

          const spawnedShades = [];
          for (const evt of events) {
            if (evt.name === 'mote_picked') {
              audio.playMotePickup();
            } else if (evt.name === 'charm_picked') {
              audio.playCharmPickup();
              renderer.spawnBurst(engine.player.pos, PALETTE.goldUi, 14, 3.0, 2.4);
              showSubtitle('🎐 Đã nhặt Bùa Gió! (+Tốc độ, 0s Lướt)', 2200);
            } else if (evt.name === 'deposit' || evt.name === 'refuel') {
              audio.playDeposit();
              const l = engine.lanterns.find(x => x.id === evt.data.lantern_id);
              if (l) renderer.spawnStream(engine.player.pos, l.pos, PALETTE.lanternLit, 10);
            } else if (evt.name === 'lantern_lit') {
              audio.playLanternLit();
              triggerFlash('rgba(255, 233, 176, 0.4)');
              const l = engine.lanterns.find(x => x.id === evt.data.lantern_id);
              if (l) renderer.spawnBurst([l.pos[0], l.pos[1] + 2.4, l.pos[2]], PALETTE.lanternCore, 20, 3.8, 3.2);
              showSubtitle(`🏮 Đèn ${evt.data.lantern_id} đã rực sáng!`, 2000);
            } else if (evt.name === 'lantern_out') {
              audio.playLanternOut();
              const l = engine.lanterns.find(x => x.id === evt.data.lantern_id);
              if (l) renderer.spawnBurst([l.pos[0], l.pos[1] + 2.2, l.pos[2]], PALETTE.lanternOff, 14, 2.4, 1.5);
              showSubtitle(`🌑 Đèn ${evt.data.lantern_id} đã cạn nhiên liệu!`, 2500);
            } else if (evt.name === 'pulse') {
              audio.playPulse();
              renderer.triggerPulseWave(engine.player.pos);
              triggerFlash('rgba(255, 179, 71, 0.35)');
            } else if (evt.name === 'player_hit') {
              audio.playPlayerHit();
              cameraShakeTicks = settings.reducedMotion ? 0 : 12;
              triggerFlash('rgba(255, 90, 95, 0.5)');
              renderer.spawnBurst(engine.player.pos, PALETTE.lanternCore, 12, 3.2, 1.2);
            } else if (evt.name === 'dash') {
              audio.playDash();
            } else if (evt.name === 'shade_spawned') {
              spawnedShades.push(evt.data.id);
            }
          }

          if (spawnedShades.length > 0) {
            audio.playShadeSpawn();
            const burstCol = settings.colorblind ? PALETTE.shadeRimColorblind : PALETTE.shadeRim;
            let firstShade = null;
            for (const sid of spawnedShades) {
              const sh = engine.shades.find(s => s.id === sid);
              if (sh) {
                if (!firstShade) firstShade = sh;
                renderer.spawnBurst([sh.pos[0], sh.pos[1] - 0.5, sh.pos[2]], burstCol, 14, 3.0, 2.0);
              }
            }
            const locSuffix = firstShade ? ` (${getRelativeDirLabel(engine.player.pos, firstShade.pos, camYawDeg)})` : '';
            const msg = spawnedShades.length > 1
              ? `🌑 ${spawnedShades.length} Bóng Mực vừa xuất hiện${locSuffix}!`
              : `🌑 Bóng Mực vừa xuất hiện${locSuffix}!`;
            pushMonsterToast(msg, 'shade', 3400);
          }

          for (const d of engine.drifters) {
            if (d.state !== 'removed' && !knownDrifterIds.has(d.id)) {
              knownDrifterIds.add(d.id);
              renderer.spawnBurst(d.pos, PALETTE.drifter, 12, 2.8, 1.6);
              const locSuffix = ` (${getRelativeDirLabel(engine.player.pos, d.pos, camYawDeg)})`;
              pushMonsterToast(`💨 Gió Lạc vừa xuất hiện${locSuffix}!`, 'drifter', 3400);
            }
          }

          if (wasGrounded && !engine.player.grounded && engine.player.vel[1] > 0) audio.playJump();
          if (cameraShakeTicks > 0) cameraShakeTicks -= 1;
          if (engine.state === 'won' || engine.state === 'lost') handleGameEnd();
        }
      }
      accumulator -= tickInterval;
    }

    let camera;
    if (uiScreen === 'menu' || uiScreen === 'intro') {
      const menuAng = settings.reducedMotion ? 0.45 : now * 0.00018;
      const cx = currentNight === 2 ? 35 : 0;
      camera = {
        eye: [cx + Math.cos(menuAng) * 26.0, 9.5, Math.sin(menuAng) * 26.0],
        target: [cx, 2.2, 0]
      };
    } else {
      const alpha = uiScreen === 'playing' && engine.state === 'playing'
        ? Math.max(0, Math.min(1, accumulator / tickInterval))
        : 1.0;
      const jumpDist = Math.hypot(engine.player.pos[0] - prevPlayerPos[0], engine.player.pos[2] - prevPlayerPos[2]);
      if (engine.player.respawnTicks > 0 || jumpDist > 4.0) {
        renderPlayerPos[0] = engine.player.pos[0];
        renderPlayerPos[1] = engine.player.pos[1];
        renderPlayerPos[2] = engine.player.pos[2];
      } else {
        renderPlayerPos[0] = prevPlayerPos[0] + (engine.player.pos[0] - prevPlayerPos[0]) * alpha;
        renderPlayerPos[1] = prevPlayerPos[1] + (engine.player.pos[1] - prevPlayerPos[1]) * alpha;
        renderPlayerPos[2] = prevPlayerPos[2] + (engine.player.pos[2] - prevPlayerPos[2]) * alpha;
      }

      const yawRad = (camYawDeg * Math.PI) / 180;
      const px = renderPlayerPos[0], py = renderPlayerPos[1], pz = renderPlayerPos[2];
      if (!camFocusInit || Math.hypot(px - camFocusPos[0], pz - camFocusPos[2]) > 8.0) {
        camFocusPos[0] = px; camFocusPos[1] = py; camFocusPos[2] = pz;
        camFocusInit = true;
      } else {
        const k = Math.min(1.0, delta * 0.022);
        camFocusPos[0] += (px - camFocusPos[0]) * k;
        camFocusPos[1] += (py - camFocusPos[1]) * k;
        camFocusPos[2] += (pz - camFocusPos[2]) * k;
      }
      const dtSec = Math.max(0.001, delta / 1000);
      const targetDashOffset = (engine.player.dashTicks > 0 && !settings.reducedMotion) ? 0.52 : 0;
      dashCamOffset += (targetDashOffset - dashCamOffset) * (1 - Math.exp(-11.5 * dtSec));
      const effDist = camDist + dashCamOffset;
      const shakeX = !settings.reducedMotion && cameraShakeTicks > 0 ? Math.sin(now * 0.08) * 0.35 : 0;
      const shakeY = !settings.reducedMotion && cameraShakeTicks > 0 ? Math.cos(now * 0.09) * 0.25 : 0;
      const camTarget = [camFocusPos[0], camFocusPos[1] + 1.36, camFocusPos[2]];
      const desiredEye = [
        camFocusPos[0] - Math.sin(yawRad) * effDist + shakeX,
        camFocusPos[1] + camHeight + shakeY,
        camFocusPos[2] - Math.cos(yawRad) * effDist
      ];
      const rawClip = computeCameraObstructionFraction(camTarget, desiredEye);
      const clipRate = rawClip < camClipFrac ? 24.0 : 9.5;
      camClipFrac += (rawClip - camClipFrac) * (1 - Math.exp(-clipRate * dtSec));
      const eyeX = camTarget[0] + (desiredEye[0] - camTarget[0]) * camClipFrac;
      let eyeY = camTarget[1] + (desiredEye[1] - camTarget[1]) * camClipFrac;
      const eyeZ = camTarget[2] + (desiredEye[2] - camTarget[2]) * camClipFrac;
      const eyeG = getGroundHeight(engine.night, eyeX, eyeZ);
      if (eyeG !== null && eyeY < eyeG + 0.55) {
        eyeY = eyeG + 0.55;
      }
      camera = {
        eye: [eyeX, eyeY, eyeZ],
        target: camTarget
      };

      // Zero-cost GPU compositor edge motion-blur pulse when turning camera
      const yawDelta = Math.abs(camYawDeg - prevCamYawDeg);
      prevCamYawDeg = camYawDeg;
      const instYawSpeed = Math.min(24.0, yawDelta / Math.max(0.004, dtSec) * 0.016);
      camYawVel += (instYawSpeed - camYawVel) * (1 - Math.exp(-16.0 * dtSec));
      if (motionBlurOverlay) {
        const targetOp = (!settings.reducedMotion && uiScreen === 'playing' && camYawVel > 0.35)
          ? Math.min(0.65, (camYawVel - 0.35) * 0.12)
          : 0;
        if (Math.abs(targetOp - lastMotionOpacity) > 0.015 || (targetOp === 0 && lastMotionOpacity !== 0)) {
          lastMotionOpacity = targetOp < 0.015 ? 0 : targetOp;
          motionBlurOverlay.style.opacity = lastMotionOpacity === 0 ? '0' : lastMotionOpacity.toFixed(2);
        }
      }
    }

    if (!document.hidden) {
      let skillState = null;
      if (uiScreen === 'playing' || uiScreen === 'paused') {
        const lockTarget = heldSkillCards.length > 0 ? findBestAutoAimTarget() : null;
        const lockGroundY = lockTarget
          ? (getGroundHeight(engine.night, lockTarget.pos[0], lockTarget.pos[2]) ?? lockTarget.pos[1]) + 0.08
          : 0;
        skillState = {
          cards: groundSkillCards,
          projectiles: activeProjectiles,
          lockTargetPos: lockTarget ? [lockTarget.pos[0], lockGroundY, lockTarget.pos[2]] : null,
          lockColor: heldSkillCards.length > 0 ? heldSkillCards[0].color : null
        };
      }

      if (uiScreen === 'playing' && engine.state === 'playing') {
        const yawRadA = (camYawDeg * Math.PI) / 180;
        let nearDist = null;
        let nearPan = 0;
        let nearArch = 0;
        const scanAudio = (pos, arch) => {
          const dx = pos[0] - engine.player.pos[0];
          const dz = pos[2] - engine.player.pos[2];
          const d = Math.hypot(dx, pos[1] - engine.player.pos[1], dz);
          if (nearDist === null || d < nearDist) {
            nearDist = d;
            const right = -dx * Math.cos(yawRadA) + dz * Math.sin(yawRadA);
            nearPan = Math.max(-1, Math.min(1, right / Math.max(2.0, Math.hypot(dx, dz))));
            nearArch = arch;
          }
        };
        for (let i = 0; i < engine.shades.length; i++) {
          const sh = engine.shades[i];
          scanAudio(sh.pos, getShadeVariant(engine.seed, sh.id, false).archetype);
        }
        for (let i = 0; i < engine.drifters.length; i++) {
          const dr = engine.drifters[i];
          if (dr.state !== 'removed') scanAudio(dr.pos, 4);
        }
        audio.updateMonsterProximityAudio(nearDist, nearPan, nearArch, now);
        audio.updateWindAudio(engine.night === 3 && engine.wind.active, engine.night === 3 && engine.wind.warning);
      } else {
        audio.stopAmbientLoops();
      }

      renderer.render(engine, camera, delta / 1000, {
        colorblind: settings.colorblind,
        reducedMotion: settings.reducedMotion,
        renderPlayerPos: (uiScreen === 'playing' || uiScreen === 'paused') ? renderPlayerPos : undefined,
        skillState
      });
      if (uiScreen === 'playing' || uiScreen === 'paused') updateHUD(camera);
    }

    requestAnimationFrame(loop);
  }

  showScreen('menu');
  requestAnimationFrame((t) => { lastTime = t; loop(t); });
}
