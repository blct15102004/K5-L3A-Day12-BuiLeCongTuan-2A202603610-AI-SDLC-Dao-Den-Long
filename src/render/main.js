import { GameEngine } from '../core/game.js';
import { WebGLRenderer } from './webgl-renderer.js';
import { SoundEffects } from './audio.js';

const canvas = document.getElementById('game-canvas');
const audio = new SoundEffects();
const renderer = new WebGLRenderer(canvas);

let engine = new GameEngine({ seed: Date.now() });

// Input tracking for user interaction
const keys = {};
let camYawDeg = 0;
let isMouseDown = false;
let lastMouseX = 0;

window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  audio.init(); // Init audio on user gesture
});

window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
});

window.addEventListener('mousedown', (e) => {
  isMouseDown = true;
  lastMouseX = e.clientX;
});

window.addEventListener('mouseup', () => {
  isMouseDown = false;
});

window.addEventListener('mousemove', (e) => {
  if (isMouseDown) {
    const dx = e.clientX - lastMouseX;
    camYawDeg -= dx * 0.4;
    lastMouseX = e.clientX;
  }
});

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// HUD elements
const hudFlames = document.getElementById('hud-flames');
const hudMotes = document.getElementById('hud-motes');
const hudLanterns = document.getElementById('hud-lanterns');
const hudTimer = document.getElementById('hud-timer');
const hudScore = document.getElementById('hud-score');
const modalOverlay = document.getElementById('modal-overlay');
const modalTitle = document.getElementById('modal-title');
const modalDesc = document.getElementById('modal-desc');
const restartBtn = document.getElementById('restart-btn');

restartBtn.addEventListener('click', () => {
  engine = new GameEngine({ seed: Date.now() });
  modalOverlay.classList.add('hidden');
});

// Fixed 60Hz tick simulation accumulator
let lastTime = performance.now();
const tickInterval = 1000 / 60;
let accumulator = 0;

function updateHUD() {
  // Flames icons
  hudFlames.innerHTML = '🔥'.repeat(Math.max(0, engine.player.flames));
  hudMotes.innerText = `${engine.player.carried} / ${engine.tuning.carry_capacity}`;
  const litCount = engine.lanterns.filter(l => l.lit).length;
  hudLanterns.innerText = `${litCount} / ${engine.lanterns.length}`;

  const minutes = Math.floor(engine.timeLeft / 60);
  const seconds = Math.floor(engine.timeLeft % 60);
  hudTimer.innerText = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  hudScore.innerText = `${engine.score}`;

  if (engine.state !== 'playing' && modalOverlay.classList.contains('hidden')) {
    modalOverlay.classList.remove('hidden');
    if (engine.state === 'won') {
      modalTitle.innerText = '🌟 CHIẾN THẮNG! 🌟';
      modalTitle.style.color = '#ffdd44';
      modalDesc.innerText = `Mây đã thắp sáng cả 5 Đèn Lồng Lớn trên Đảo Bến!\nTổng điểm của bạn: ${engine.score}`;
    } else {
      modalTitle.innerText = '🌑 BÓNG TỐI ĐÃ BAO TRÙM...';
      modalTitle.style.color = '#cc4455';
      const reasonText = engine.gameOverReason === 'dawn' ? 'Đã hết thời gian (Bình minh đã tới)' : 'Mây đã cạn kiệt ngọn lửa sinh mệnh';
      modalDesc.innerText = `${reasonText}.\nĐiểm đạt được: ${engine.score}`;
    }
  }
}

function loop(currentTime) {
  const delta = currentTime - lastTime;
  lastTime = currentTime;
  accumulator += delta;

  // Run fixed 60Hz ticks
  while (accumulator >= tickInterval) {
    if (engine.state === 'playing') {
      let mx = 0;
      let mz = 0;
      if (keys['KeyW'] || keys['ArrowUp']) mz += 1;
      if (keys['KeyS'] || keys['ArrowDown']) mz -= 1;
      if (keys['KeyD'] || keys['ArrowRight']) mx += 1;
      if (keys['KeyA'] || keys['ArrowLeft']) mx -= 1;

      const input = {
        move: [mx, mz],
        cam_yaw_deg: camYawDeg,
        interact: !!keys['KeyE'],
        pulse: !!(keys['KeyQ'] || keys['Space'])
      };

      const events = engine.step(input);

      // Play sound effects based on game events
      for (const evt of events) {
        if (evt.name === 'mote_picked') audio.playMotePickup();
        else if (evt.name === 'lantern_lit') audio.playLanternLit();
        else if (evt.name === 'pulse') audio.playPulse();
        else if (evt.name === 'player_hit') audio.playPlayerHit();
      }
    }
    accumulator -= tickInterval;
  }

  // Camera calculations: 3rd person follow behind Mây
  const yawRad = (camYawDeg * Math.PI) / 180;
  const camDist = 9.0;
  const camHeight = 6.0;
  const px = engine.player.pos[0];
  const py = engine.player.pos[1];
  const pz = engine.player.pos[2];

  const eyeX = px - Math.sin(yawRad) * camDist;
  const eyeY = py + camHeight;
  const eyeZ = pz - Math.cos(yawRad) * camDist;

  const camera = {
    eye: [eyeX, eyeY, eyeZ],
    target: [px, py + 1.2, pz]
  };

  renderer.render(engine, camera);
  updateHUD();

  requestAnimationFrame(loop);
}

requestAnimationFrame((t) => {
  lastTime = t;
  loop(t);
});
