import { GameEngine, distXZ } from '../core/game.js';
import { getNightConfig } from '../core/maps.js';
import { WebGLRenderer } from './webgl-renderer.js';
import { SoundEffects } from './audio.js';

const STORAGE_KEY = 'dao_den_long_settings_v1';
const defaultSettings = { volume: 0.7, sensitivity: 0.4, colorblind: false };

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...defaultSettings, ...JSON.parse(raw) } : { ...defaultSettings };
  } catch {
    return { ...defaultSettings };
  }
}

function saveSettings(s) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch { /* ignore */ }
}

const settings = loadSettings();
const canvas = document.getElementById('game-canvas');
const audio = new SoundEffects();
audio.setVolume(settings.volume);
const renderer = new WebGLRenderer(canvas);

// Campaign & UI flow state: 'menu' | 'intro' | 'playing' | 'paused' | 'result' | 'dawn'
let uiScreen = 'menu';
let currentNight = 1;
let totalCampaignScore = 0;
let engine = new GameEngine({ seed: 101, night: 1 });
let camYawDeg = 0;
let lastCountdownSec = -1;

// Input tracking
const keys = {};
let isMouseDown = false;
let lastMouseX = 0;
let pauseKeyTriggered = false;
let lastPointerUnlockMs = 0;

// DOM Elements
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
const cdDash = document.getElementById('cd-dash');
const cdPulse = document.getElementById('cd-pulse');
const interactPrompt = document.getElementById('interact-prompt');
const lanternArrow = document.getElementById('lantern-arrow');

// Overlays
const menuOverlay = document.getElementById('menu-overlay');
const introOverlay = document.getElementById('intro-overlay');
const introTitle = document.getElementById('intro-title');
const introQuote = document.getElementById('intro-quote');
const pauseOverlay = document.getElementById('pause-overlay');
const settingsOverlay = document.getElementById('settings-overlay');
const resultOverlay = document.getElementById('result-overlay');
const resultTitle = document.getElementById('result-title');
const resultDesc = document.getElementById('result-desc');
const nextNightBtn = document.getElementById('next-night-btn');
const retryNightBtn = document.getElementById('retry-night-btn');
const volSlider = document.getElementById('setting-volume');
const sensSlider = document.getElementById('setting-sensitivity');
const colorblindToggle = document.getElementById('setting-colorblind');
const volValLabel = document.getElementById('setting-volume-val');
const sensValLabel = document.getElementById('setting-sensitivity-val');

// Build up to 20 mote bar slots once
for (let i = 0; i < 20; i++) {
  const slot = document.createElement('div');
  slot.className = 'mote-slot';
  moteBar.appendChild(slot);
}

function syncSettingsUI() {
  volSlider.value = Math.round(settings.volume * 100);
  volValLabel.innerText = `${volSlider.value}%`;
  sensSlider.value = settings.sensitivity.toFixed(2);
  sensValLabel.innerText = settings.sensitivity.toFixed(2);
  colorblindToggle.checked = !!settings.colorblind;
}
syncSettingsUI();

colorblindToggle.addEventListener('change', () => {
  settings.colorblind = colorblindToggle.checked;
  saveSettings(settings);
});

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

let settingsReturnScreen = 'menu';
function openSettings(fromScreen) {
  settingsReturnScreen = fromScreen;
  settingsOverlay.classList.remove('hidden');
}

function lockPointer() {
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
  const inGame = screen === 'playing' || screen === 'paused';
  hudEl.classList.toggle('hidden', !inGame);
  bottomHudEl.classList.toggle('hidden', !inGame);
  controlsGuideEl.classList.toggle('hidden', !inGame);
  canvas.classList.toggle('hide-cursor', screen === 'playing');
  if (screen !== 'playing') {
    unlockPointer();
  }
  if (!inGame) {
    interactPrompt.classList.add('hidden');
    lanternArrow.classList.add('hidden');
  }
}

function startNightIntro(night, resetCampaign = false) {
  audio.init();
  if (resetCampaign) totalCampaignScore = 0;
  currentNight = night;
  const cfg = getNightConfig(night);
  introTitle.innerText = cfg.name;
  introQuote.innerText = cfg.introQuote;
  showScreen('intro');
}

function beginNightPlay() {
  audio.init();
  audio.startBgm();
  engine = new GameEngine({ seed: Date.now() & 0xfffffff, night: currentNight });
  camYawDeg = 0;
  lastCountdownSec = -1;
  showScreen('playing');
  lockPointer();
}

// Menu & Modal Button Listeners
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
document.getElementById('btn-pause-menu').addEventListener('click', () => {
  audio.stopBgm();
  showScreen('menu');
});

document.getElementById('btn-close-settings').addEventListener('click', () => {
  settingsOverlay.classList.add('hidden');
  showScreen(settingsReturnScreen);
});

nextNightBtn.addEventListener('click', () => startNightIntro(currentNight + 1, false));
retryNightBtn.addEventListener('click', beginNightPlay);
document.getElementById('btn-result-menu').addEventListener('click', () => {
  audio.stopBgm();
  showScreen('menu');
});

// Keyboard & Mouse Events
window.addEventListener('keydown', (e) => {
  if (uiScreen === 'playing' && ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
    e.preventDefault();
  }
  keys[e.code] = true;
  if ((e.code === 'Escape' || e.code === 'KeyP') && !e.repeat) {
    if (e.code === 'Escape' && performance.now() - lastPointerUnlockMs < 150) return;
    if (uiScreen === 'playing' || uiScreen === 'paused') {
      pauseKeyTriggered = true;
    }
  }
});

window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
});

canvas.addEventListener('mousedown', (e) => {
  isMouseDown = true;
  lastMouseX = e.clientX;
  if (uiScreen === 'playing') {
    lockPointer();
  }
});

window.addEventListener('mouseup', () => { isMouseDown = false; });

window.addEventListener('mousemove', (e) => {
  if (uiScreen === 'playing') {
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
  if (document.pointerLockElement !== canvas && uiScreen === 'playing' && engine.state === 'playing') {
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

// FPS tracking
let fpsFrames = 0;
let fpsLastTime = performance.now();
let currentFps = 60;

function updateHUD(camera) {
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

  // Progressive Mote Capacity Bar (10..20 slots)
  const cap = engine.getCarryCapacity();
  moteBarLabel.innerText = `Đom Đóm (${engine.player.carried} / ${cap})`;
  const slots = moteBar.children;
  for (let i = 0; i < 20; i++) {
    slots[i].classList.toggle('hidden', i >= cap);
    slots[i].classList.toggle('filled', i < engine.player.carried);
  }

  // Cooldown badges
  const dashSec = engine.player.dashCdTicks / 60;
  cdDash.innerText = engine.player.charmTicks > 0 ? '∞' : (dashSec > 0 ? `${dashSec.toFixed(1)}s` : 'Sẵn');
  cdDash.classList.toggle('on-cd', dashSec > 0 && engine.player.charmTicks === 0);

  const pulseSec = engine.player.pulseCdTicks / 60;
  const canPulse = pulseSec === 0 && engine.player.carried >= engine.tuning.pulse_cost;
  cdPulse.innerText = pulseSec > 0 ? `${pulseSec.toFixed(1)}s` : (canPulse ? 'Sẵn' : `${engine.player.carried}/3`);
  cdPulse.classList.toggle('on-cd', !canPulse);

  // Prompt near valid lantern (unlit OR lit with fuel < 100)
  let nearLantern = null;
  for (const l of engine.lanterns) {
    const isValid = !l.lit || (l.lit && l.fuelUnits < 6000);
    if (isValid && distXZ(engine.player.pos, l.pos) <= engine.tuning.interact_radius && Math.abs(engine.player.pos[1] - l.pos[1]) <= 2.5) {
      nearLantern = l;
      break;
    }
  }
  if (nearLantern && uiScreen === 'playing') {
    interactPrompt.classList.remove('hidden');
    if (!nearLantern.lit) {
      const cost = nearLantern.everLit ? engine.tuning.relight_cost : engine.tuning.lantern_cost;
      interactPrompt.innerText = nearLantern.everLit
        ? `E — Thắp lại đèn (${nearLantern.deposited}/${cost})`
        : `E — Nạp ánh sáng (${nearLantern.deposited}/${cost})`;
    } else {
      const pct = Math.round(nearLantern.fuelUnits / 60);
      interactPrompt.innerText = `E — Tiếp nhiên liệu (${pct}%)`;
    }
  } else {
    interactPrompt.classList.add('hidden');
  }

  // Off-screen arrow pointing to nearest unlit lantern
  const unlit = engine.lanterns.filter(l => !l.lit);
  if (unlit.length > 0 && uiScreen === 'playing') {
    unlit.sort((a, b) => distXZ(engine.player.pos, a.pos) - distXZ(engine.player.pos, b.pos));
    const nearest = unlit[0];
    const proj = renderer.projectToScreen([nearest.pos[0], nearest.pos[1] + 2.0, nearest.pos[2]], camera);
    if (!proj.onScreen) {
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const angle = Math.atan2(proj.screenY - cy, proj.screenX - cx);
      const rad = Math.min(cx, cy) - 70;
      const ax = cx + Math.cos(angle) * rad;
      const ay = cy + Math.sin(angle) * rad;
      lanternArrow.style.left = `${ax}px`;
      lanternArrow.style.top = `${ay}px`;
      lanternArrow.style.transform = `translate(-50%, -50%) rotate(${angle + Math.PI / 2}rad)`;
      lanternArrow.classList.remove('hidden');
    } else {
      lanternArrow.classList.add('hidden');
    }
  } else {
    lanternArrow.classList.add('hidden');
  }
}

function handleGameEnd() {
  if (engine.state === 'won') {
    audio.playWin();
    totalCampaignScore += engine.score;
    if (currentNight < 3) {
      resultTitle.innerText = `🌟 HOÀN THÀNH ĐÊM ${currentNight}! 🌟`;
      resultTitle.style.color = '#F2C14E';
      resultDesc.innerText = `Điểm Đêm ${currentNight}: ${engine.score}\nTổng điểm chiến dịch: ${totalCampaignScore}`;
      nextNightBtn.classList.remove('hidden');
      retryNightBtn.classList.add('hidden');
      showScreen('result');
    } else {
      resultTitle.innerText = '☀️ BÌNH MINH ĐÃ TỚI! ☀️';
      resultTitle.style.color = '#FFE9B0';
      resultDesc.innerText = `Chúc mừng! Mây đã thắp sáng cả ba hòn đảo!\nĐiểm Đêm 3: ${engine.score}\nTỔNG ĐIỂM TOÀN CHẶNG: ${totalCampaignScore}`;
      nextNightBtn.classList.add('hidden');
      retryNightBtn.classList.remove('hidden');
      showScreen('dawn');
    }
  } else if (engine.state === 'lost') {
    audio.playLose();
    resultTitle.innerText = '🌑 ĐÊM CHƯA QUA...';
    resultTitle.style.color = '#FF5A5F';
    const reason = engine.gameOverReason === 'dawn' ? 'Đã hết thời gian trước khi thắp đủ đèn' : 'Mây đã mất hết Ngọn Lửa sinh mệnh';
    resultDesc.innerText = `${reason}.\nĐiểm đạt được: ${engine.score}`;
    nextNightBtn.classList.add('hidden');
    retryNightBtn.classList.remove('hidden');
    showScreen('result');
  }
}

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
        let mx = 0, mz = 0;
        if (keys['KeyW'] || keys['ArrowUp']) mz += 1;
        if (keys['KeyS'] || keys['ArrowDown']) mz -= 1;
        if (keys['KeyD'] || keys['ArrowRight']) mx -= 1;
        if (keys['KeyA'] || keys['ArrowLeft']) mx += 1;

        const input = {
          move: [mx, mz],
          cam_yaw_deg: camYawDeg,
          jump: !!keys['Space'],
          dash: !!(keys['ShiftLeft'] || keys['ShiftRight']),
          interact: !!keys['KeyE'],
          pulse: !!(keys['KeyQ'] || keys['KeyF'])
        };

        const wasWindWarn = engine.wind.warning;
        const wasGrounded = engine.player.grounded;
        const events = engine.step(input);

        if (!wasWindWarn && engine.wind.warning) audio.playWindWarning();
        const secCeil = Math.ceil(engine.timeLeft);
        if (secCeil <= 10 && secCeil > 0 && secCeil !== lastCountdownSec) {
          lastCountdownSec = secCeil;
          audio.playCountdownTick();
        }

        for (const evt of events) {
          if (evt.name === 'mote_picked') audio.playMotePickup();
          else if (evt.name === 'charm_picked') audio.playCharmPickup();
          else if (evt.name === 'deposit' || evt.name === 'refuel') audio.playDeposit();
          else if (evt.name === 'lantern_lit') audio.playLanternLit();
          else if (evt.name === 'lantern_out') audio.playLanternOut();
          else if (evt.name === 'pulse') {
            audio.playPulse();
            renderer.triggerPulseWave(engine.player.pos);
          }
          else if (evt.name === 'player_hit') audio.playPlayerHit();
          else if (evt.name === 'dash') audio.playDash();
          else if (evt.name === 'shade_spawned') audio.playShadeSpawn();
        }

        if (wasGrounded && !engine.player.grounded && engine.player.vel[1] > 0) {
          audio.playJump();
        }

        if (engine.state === 'won' || engine.state === 'lost') {
          handleGameEnd();
        }
      }
    }
    accumulator -= tickInterval;
  }

  const yawRad = (camYawDeg * Math.PI) / 180;
  const px = engine.player.pos[0], py = engine.player.pos[1], pz = engine.player.pos[2];
  const camera = {
    eye: [px - Math.sin(yawRad) * 10.5, py + 6.5, pz - Math.cos(yawRad) * 10.5],
    target: [px, py + 1.4, pz]
  };

  renderer.render(engine, camera, delta / 1000, { colorblind: settings.colorblind });
  if (uiScreen === 'playing' || uiScreen === 'paused') {
    updateHUD(camera);
  }

  requestAnimationFrame(loop);
}

showScreen('menu');
requestAnimationFrame((t) => {
  lastTime = t;
  loop(t);
});
