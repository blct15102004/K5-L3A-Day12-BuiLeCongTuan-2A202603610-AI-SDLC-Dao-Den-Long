import { GameEngine, distXZ } from '../core/game.js';
import { PALETTE } from '../core/constants.js';
import { getNightConfig } from '../core/maps.js';
import { addLeaderboardEntry, sortLeaderboard, formatIsoWithTimezone } from '../core/leaderboard.js';
import { WebGLRenderer } from './webgl-renderer.js';
import { SoundEffects } from './audio.js';

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
  volume: 0.7,
  sensitivity: 0.4,
  colorblind: false,
  reducedMotion: false,
  largeText: false,
  keybinds: { ...DEFAULT_KEYBINDS }
};

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
const screenFlash = document.getElementById('screen-flash');
const hudEl = document.getElementById('hud');
const bottomHudEl = document.getElementById('bottom-hud');
const controlsGuideEl = document.getElementById('controls-guide');
const hudFlames = document.getElementById('hud-flames');
const hudCharm = document.getElementById('hud-charm');
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
const subtitleBanner = document.getElementById('subtitle-banner');
const interactPrompt = document.getElementById('interact-prompt');
const lanternArrow = document.getElementById('lantern-arrow');
const shadeArrowsLayer = document.getElementById('shade-arrows-layer');

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

let listeningAction = null;

function applyAccessibilityClasses() {
  document.body.classList.toggle('large-text', !!settings.largeText);
  document.body.classList.toggle('reduced-motion', !!settings.reducedMotion);
  const kb = settings.keybinds;
  controlsGuideEl.innerHTML =
    `<div><span class="kbd">${formatKeyCode(kb.moveUp)}${formatKeyCode(kb.moveLeft)}${formatKeyCode(kb.moveDown)}${formatKeyCode(kb.moveRight)}</span> Di chuyển · <span class="kbd">${formatKeyCode(kb.jump)}</span> Nhảy · <span class="kbd">${formatKeyCode(kb.dash)}</span> Lướt</div>` +
    `<div><span class="kbd">${formatKeyCode(kb.interact)}</span> Nạp đèn · <span class="kbd">${formatKeyCode(kb.pulse)}</span> Tỏa Sáng · <span class="kbd">Esc/${formatKeyCode(kb.pause)}</span> Tạm dừng</div>`;
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

function syncSettingsUI() {
  volSlider.value = Math.round(settings.volume * 100);
  volValLabel.innerText = `${volSlider.value}%`;
  sensSlider.value = settings.sensitivity.toFixed(2);
  sensValLabel.innerText = settings.sensitivity.toFixed(2);
  colorblindToggle.checked = !!settings.colorblind;
  reducedMotionToggle.checked = !!settings.reducedMotion;
  largeTextToggle.checked = !!settings.largeText;
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
let lastCountdownSec = -1;
let cameraShakeTicks = 0;
let subtitleState = { text: '', expiresAt: 0 };
const recentShadeAlerts = []; // { id, expiresAt }

const keys = {};
let isMouseDown = false;
let lastMouseX = 0;
let pauseKeyTriggered = false;
let lastPointerUnlockMs = 0;

function showSubtitle(text, durationMs = 2500) {
  const prefix = settings.colorblind ? '⚠ ' : '';
  subtitleState = { text: prefix + text, expiresAt: performance.now() + durationMs };
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
  controlsGuideEl.classList.toggle('hidden', !inGame);
  canvas.classList.toggle('hide-cursor', !isBenchmarkMode && screen === 'playing');
  if (screen !== 'playing') unlockPointer();
  if (!inGame) {
    interactPrompt.classList.add('hidden');
    lanternArrow.classList.add('hidden');
    subtitleBanner.classList.add('hidden');
    shadeArrowsLayer.innerHTML = '';
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
  const cfg = getNightConfig(night);
  introTitle.innerText = cfg.name;
  introQuote.innerText = cfg.introQuote;
  showScreen('intro');
}

function beginNightPlay() {
  audio.init();
  audio.startBgm();
  engine = new GameEngine({ seed: campaignSeed + currentNight - 1, night: currentNight });
  camYawDeg = 0;
  lastCountdownSec = -1;
  cameraShakeTicks = 0;
  recentShadeAlerts.length = 0;
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
  if (uiScreen === 'playing' && !isBenchmarkMode) lockPointer();
});

window.addEventListener('mouseup', () => { isMouseDown = false; });

window.addEventListener('mousemove', (e) => {
  if (uiScreen === 'playing' && !isBenchmarkMode) {
    if (document.pointerLockElement === canvas) {
      camYawDeg -= e.movementX * settings.sensitivity;
    } else if (isMouseDown) {
      const dx = e.clientX - lastMouseX;
      camYawDeg -= dx * settings.sensitivity;
      lastMouseX = e.clientX;
    }
  }
});

document.addEventListener('pointerlockchange', () => {
  if (!isBenchmarkMode && document.pointerLockElement !== canvas && uiScreen === 'playing' && engine.state === 'playing') {
    lastPointerUnlockMs = performance.now();
    engine.step({ pause: true });
    engine.prevButtons.pause = false;
    showScreen('paused');
  }
});

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

let fpsFrames = 0;
let fpsLastTime = performance.now();
let currentFps = 60;

function updateHUD(camera) {
  const now = performance.now();
  hudFlames.innerText = '🔥'.repeat(Math.max(0, engine.player.flames)) || '💀';
  if (engine.player.charmTicks > 0) {
    hudCharm.classList.remove('hidden');
    hudCharm.innerText = `🎐 Bùa Gió ${(engine.player.charmTicks / 60).toFixed(1)}s`;
  } else {
    hudCharm.classList.add('hidden');
  }

  hudNight.innerText = engine.map.name;
  const mins = Math.floor(engine.timeLeft / 60);
  const secs = Math.floor(engine.timeLeft % 60);
  const timerStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  const isDangerTime = engine.timeLeft <= 30.0;
  hudTimer.innerText = (isDangerTime && settings.colorblind ? '⚠ ' : '') + timerStr;
  hudTimer.classList.toggle('timer-danger', isDangerTime);
  hudTimer.classList.toggle('colorblind-alert', isDangerTime && settings.colorblind);

  if (engine.night === 3 && (engine.wind.warning || engine.wind.active)) {
    hudWind.classList.remove('hidden');
    const warnPrefix = settings.colorblind ? '⚠ ' : '';
    hudWind.innerText = engine.wind.warning ? `${warnPrefix}🍃 SẮP CÓ GIÓ MẠNH!` : `${warnPrefix}💨 GIÓ THỔI (${Math.round(engine.wind.dir_deg)}°)`;
    hudWind.classList.toggle('colorblind-alert', !!settings.colorblind);
  } else {
    hudWind.classList.add('hidden');
  }

  const litCount = engine.lanterns.filter(l => l.lit).length;
  const reqLit = Math.ceil(engine.tuning.win_ratio * engine.lanterns.length);
  hudLanterns.innerText = `${litCount} / ${engine.lanterns.length} (cần ${reqLit})`;
  hudScore.innerText = `${engine.score}`;
  hudFps.innerText = `${currentFps} FPS`;

  const cap = engine.getCarryCapacity();
  moteBarLabel.innerText = `Đom Đóm (${engine.player.carried} / ${cap})`;
  const slots = moteBar.children;
  for (let i = 0; i < 20; i++) {
    slots[i].classList.toggle('hidden', i >= cap);
    slots[i].classList.toggle('filled', i < engine.player.carried);
  }

  const dashSec = engine.player.dashCdTicks / 60;
  cdDash.innerText = engine.player.charmTicks > 0 ? '∞' : (dashSec > 0 ? `${dashSec.toFixed(1)}s` : 'Sẵn');
  cdDash.classList.toggle('on-cd', dashSec > 0 && engine.player.charmTicks === 0);

  const pulseSec = engine.player.pulseCdTicks / 60;
  const canPulse = pulseSec === 0 && engine.player.carried >= engine.tuning.pulse_cost;
  cdPulse.innerText = pulseSec > 0 ? `${pulseSec.toFixed(1)}s` : (canPulse ? 'Sẵn' : `${engine.player.carried}/3`);
  cdPulse.classList.toggle('on-cd', !canPulse);

  // Subtitles / Visual Cues (priority: active subtitle -> low-fuel lantern cue)
  const lowFuelLanterns = engine.lanterns.filter(l => l.lit && l.fuelUnits < 1800);
  if (subtitleState.text && now < subtitleState.expiresAt) {
    subtitleBanner.innerText = subtitleState.text;
    subtitleBanner.classList.toggle('colorblind-alert', !!settings.colorblind);
    subtitleBanner.classList.remove('hidden');
  } else if (lowFuelLanterns.length > 0 && uiScreen === 'playing') {
    const ids = lowFuelLanterns.map(l => l.id).join(', ');
    subtitleBanner.innerText = `${settings.colorblind ? '⚠ ' : ''}🏮 Đèn ${ids} sắp tắt (<30%)!`;
    subtitleBanner.classList.toggle('colorblind-alert', !!settings.colorblind);
    subtitleBanner.classList.remove('hidden');
  } else {
    subtitleBanner.classList.add('hidden');
  }

  // Directional edge arrows for newly spawned Ink Shades
  shadeArrowsLayer.innerHTML = '';
  for (let i = recentShadeAlerts.length - 1; i >= 0; i--) {
    const alert = recentShadeAlerts[i];
    if (now > alert.expiresAt) {
      recentShadeAlerts.splice(i, 1);
      continue;
    }
    const shade = engine.shades.find(s => s.id === alert.id);
    if (!shade) continue;
    const proj = renderer.projectToScreen(shade.pos, camera);
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const angle = Math.atan2(proj.screenY - cy, proj.screenX - cx);
    const rad = Math.min(cx, cy) - 55;
    const arrow = document.createElement('div');
    arrow.className = 'shade-arrow' + (settings.colorblind ? ' cb' : '');
    arrow.style.left = `${cx + Math.cos(angle) * rad}px`;
    arrow.style.top = `${cy + Math.sin(angle) * rad}px`;
    arrow.style.transform = `translate(-50%, -50%) rotate(${angle + Math.PI / 2}rad)`;
    shadeArrowsLayer.appendChild(arrow);
  }

  // Interact Prompt
  let nearLantern = null;
  for (const l of engine.lanterns) {
    const isValid = !l.lit || (l.lit && l.fuelUnits < 6000);
    if (isValid && distXZ(engine.player.pos, l.pos) <= engine.tuning.interact_radius && Math.abs(engine.player.pos[1] - l.pos[1]) <= 2.5) {
      nearLantern = l;
      break;
    }
  }
  const intKey = formatKeyCode(settings.keybinds.interact);
  if (nearLantern && uiScreen === 'playing') {
    interactPrompt.classList.remove('hidden');
    if (!nearLantern.lit) {
      const cost = nearLantern.everLit ? engine.tuning.relight_cost : engine.tuning.lantern_cost;
      interactPrompt.innerText = nearLantern.everLit
        ? `${intKey} — Thắp lại đèn (${nearLantern.deposited}/${cost})`
        : `${intKey} — Nạp ánh sáng (${nearLantern.deposited}/${cost})`;
    } else {
      interactPrompt.innerText = `${intKey} — Tiếp nhiên liệu (${Math.round(nearLantern.fuelUnits / 60)}%)`;
    }
  } else {
    interactPrompt.classList.add('hidden');
  }

  // Off-screen arrow pointing to nearest unlit or low-fuel lantern
  const urgent = engine.lanterns.filter(l => !l.lit || l.fuelUnits < 1800);
  if (urgent.length > 0 && uiScreen === 'playing') {
    urgent.sort((a, b) => distXZ(engine.player.pos, a.pos) - distXZ(engine.player.pos, b.pos));
    const nearest = urgent[0];
    const proj = renderer.projectToScreen([nearest.pos[0], nearest.pos[1] + 2.0, nearest.pos[2]], camera);
    if (!proj.onScreen) {
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const angle = Math.atan2(proj.screenY - cy, proj.screenX - cx);
      const rad = Math.min(cx, cy) - 75;
      lanternArrow.style.left = `${cx + Math.cos(angle) * rad}px`;
      lanternArrow.style.top = `${cy + Math.sin(angle) * rad}px`;
      lanternArrow.style.transform = `translate(-50%, -50%) rotate(${angle + Math.PI / 2}rad)`;
      lanternArrow.classList.remove('hidden');
    } else {
      lanternArrow.classList.add('hidden');
    }
  } else {
    lanternArrow.classList.add('hidden');
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

  function loop(now) {
    const delta = Math.min(100, now - lastTime);
    lastTime = now;
    accumulator += delta;

    fpsFrames++;
    if (now - fpsLastTime >= 500) {
      currentFps = Math.round((fpsFrames * 1000) / (now - fpsLastTime));
      fpsFrames = 0;
      fpsLastTime = now;
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
          const kb = settings.keybinds;
          let mx = 0, mz = 0;
          if (keys[kb.moveUp] || keys['ArrowUp']) mz += 1;
          if (keys[kb.moveDown] || keys['ArrowDown']) mz -= 1;
          if (keys[kb.moveRight] || keys['ArrowRight']) mx -= 1;
          if (keys[kb.moveLeft] || keys['ArrowLeft']) mx += 1;

          const input = {
            move: [mx, mz],
            cam_yaw_deg: camYawDeg,
            jump: !!keys[kb.jump],
            dash: !!(keys[kb.dash] || (kb.dash === 'ShiftLeft' && keys['ShiftRight'])),
            interact: !!keys[kb.interact],
            pulse: !!(keys[kb.pulse] || (kb.pulse === 'KeyQ' && keys['KeyF']))
          };

          const wasWindWarn = engine.wind.warning;
          const wasGrounded = engine.player.grounded;
          const events = engine.step(input);

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

          for (const evt of events) {
            if (evt.name === 'mote_picked') {
              audio.playMotePickup();
              renderer.spawnBurst(engine.player.pos, PALETTE.moteCore, 8, 2.2, 1.8);
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
              audio.playShadeSpawn();
              showSubtitle('🌑 Bóng Mực vừa xuất hiện!', 2400);
              recentShadeAlerts.push({ id: evt.data.id, expiresAt: performance.now() + 4000 });
            }
          }

          if (wasGrounded && !engine.player.grounded && engine.player.vel[1] > 0) audio.playJump();
          if (cameraShakeTicks > 0) cameraShakeTicks -= 1;
          if (engine.state === 'won' || engine.state === 'lost') handleGameEnd();
        }
      }
      accumulator -= tickInterval;
    }

    const yawRad = (camYawDeg * Math.PI) / 180;
    const px = engine.player.pos[0], py = engine.player.pos[1], pz = engine.player.pos[2];
    const shakeX = !settings.reducedMotion && cameraShakeTicks > 0 ? Math.sin(now * 0.08) * 0.35 : 0;
    const shakeY = !settings.reducedMotion && cameraShakeTicks > 0 ? Math.cos(now * 0.09) * 0.25 : 0;
    const camera = {
      eye: [px - Math.sin(yawRad) * 10.5 + shakeX, py + 6.5 + shakeY, pz - Math.cos(yawRad) * 10.5],
      target: [px, py + 1.4, pz]
    };

    renderer.render(engine, camera, delta / 1000, {
      colorblind: settings.colorblind,
      reducedMotion: settings.reducedMotion
    });
    if (uiScreen === 'playing' || uiScreen === 'paused') updateHUD(camera);

    requestAnimationFrame(loop);
  }

  showScreen('menu');
  requestAnimationFrame((t) => { lastTime = t; loop(t); });
}
