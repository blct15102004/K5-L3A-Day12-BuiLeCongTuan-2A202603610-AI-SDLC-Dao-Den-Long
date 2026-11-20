// Sculpted multi-colored 3D entity models: Eerie Recognizable Monsters (4 unique archetypes + Ghost Moth),
// Large Vivid Collectible Fireflies, Optimized Palace Great Lanterns, Organic World Props & Skill Cards
// Pure browser-safe ES module (zero node:* imports)
import { PALETTE } from '../core/constants.js';

const EC = {
  obsidian: [0.06, 0.04, 0.10],
  inkDark: [0.10, 0.07, 0.16],
  inkMid: [0.17, 0.13, 0.26],
  slate: [0.27, 0.25, 0.36],
  boneMask: [0.92, 0.90, 0.96],
  boneShade: [0.66, 0.63, 0.76],
  violetGlow: [0.66, 0.30, 1.0],
  violetSoft: [0.44, 0.18, 0.78],
  cyanGlow: [0.22, 0.92, 1.0],
  crimsonGlow: [1.0, 0.24, 0.42],
  jadeGlow: [0.20, 0.98, 0.68],
  amberEye: [1.0, 0.78, 0.18],
  soulWhite: [0.96, 0.98, 1.0],
  fangWhite: [0.97, 0.96, 1.0],
  mothBody: [0.22, 0.18, 0.32],
  mothWingIn: [0.58, 0.88, 0.98],
  mothWingOut: [0.24, 0.48, 0.78],
  mothGold: [1.0, 0.86, 0.42],
  ffHead: [0.14, 0.11, 0.16],
  ffThorax: [0.28, 0.21, 0.16],
  ffWing: [0.88, 0.98, 0.96],
  ffAmber: [1.0, 0.80, 0.28],
  ffGlow: [0.98, 1.0, 0.50],
  ffCore: [1.0, 1.0, 0.88],
  stoneDark: [0.32, 0.35, 0.39],
  stoneMoss: [0.23, 0.43, 0.34],
  lacquer: [0.52, 0.14, 0.14],
  mahogany: [0.35, 0.19, 0.12],
  roofTile: [0.68, 0.22, 0.16],
  gold: [0.96, 0.79, 0.28],
  goldBright: [1.0, 0.93, 0.56],
  paperLitOut: [1.0, 0.60, 0.16],
  paperLitCore: [1.0, 0.95, 0.70],
  paperOff: [0.28, 0.31, 0.38],
  paperOffRib: [0.18, 0.20, 0.26],
  moonWhite: [0.98, 0.97, 0.93]
};

export const SHADE_ACCENTS = [
  [0.66, 0.32, 1.0],
  [0.22, 0.88, 1.0],
  [1.0, 0.28, 0.44],
  [0.20, 0.96, 0.66]
];

export const MOTE_PALETTE = [
  [1.0, 0.90, 0.36], // Golden Honey
  [0.32, 0.98, 0.80], // Sky Emerald
  [1.0, 0.58, 0.82], // Sakura Pink
  [0.40, 0.88, 1.0], // Celestial Cyan
  [0.78, 0.62, 1.0]  // Starlight Lavender
];

export const SKILL_CATALOG = [
  { id: 'sakura', name: 'Nguyệt Hoa Trảm', icon: '🌸', color: [1.0, 0.52, 0.78], core: [1.0, 0.92, 0.96], bonusScore: 40 },
  { id: 'thunder', name: 'Lôi Đăng Thiên Lôi', icon: '⚡', color: [0.68, 0.42, 1.0], core: [0.94, 0.88, 1.0], bonusScore: 45 },
  { id: 'phoenix', name: 'Hỏa Phượng Lưu Tinh', icon: '🔥', color: [1.0, 0.50, 0.18], core: [1.0, 0.95, 0.65], bonusScore: 45 },
  { id: 'frost', name: 'Tinh Vân Băng Tiễn', icon: '💠', color: [0.28, 0.92, 1.0], core: [0.90, 0.99, 1.0], bonusScore: 40 }
];

export function getMoteColor(moteId) {
  const n = parseInt(String(moteId).replace(/\D+/g, ''), 10) || 1;
  return MOTE_PALETTE[(n * 2654435761 >>> 0) % MOTE_PALETTE.length];
}

function rotateVec(x, y, z, rotX, rotY, rotZ) {
  if (rotX) {
    const c = Math.cos(rotX), s = Math.sin(rotX);
    const ny = y * c - z * s;
    const nz = y * s + z * c;
    y = ny; z = nz;
  }
  if (rotZ) {
    const c = Math.cos(rotZ), s = Math.sin(rotZ);
    const nx = x * c - y * s;
    const ny = x * s + y * c;
    x = nx; y = ny;
  }
  if (rotY) {
    const c = Math.cos(rotY), s = Math.sin(rotY);
    const nx = c * x + s * z;
    const nz = -s * x + c * z;
    x = nx; z = nz;
  }
  return [x, y, z];
}

function mixRgb(a, b, t) {
  const k = Math.max(0, Math.min(1, t));
  return [
    a[0] + (b[0] - a[0]) * k,
    a[1] + (b[1] - a[1]) * k,
    a[2] + (b[2] - a[2]) * k
  ];
}

class EntityMeshBuilder {
  constructor() {
    this.pos = [];
    this.norm = [];
    this.col = [];
    this.idx = [];
  }

  pushVert(x, y, z, nx, ny, nz, col) {
    const nLen = Math.hypot(nx, ny, nz) || 1;
    this.pos.push(x, y, z);
    this.norm.push(nx / nLen, ny / nLen, nz / nLen);
    this.col.push(col[0], col[1], col[2]);
  }

  addEllipsoid(cx, cy, cz, rx, ry, rz, latBands, lonBands, colorFnOrRgb, rotX = 0, rotY = 0, rotZ = 0) {
    const startIdx = this.pos.length / 3;
    const arx = Math.abs(rx) || 1, ary = Math.abs(ry) || 1, arz = Math.abs(rz) || 1;
    const isFn = typeof colorFnOrRgb === 'function';

    for (let lat = 0; lat <= latBands; lat++) {
      const v = lat / latBands;
      const theta = v * Math.PI;
      const sinT = Math.sin(theta), cosT = Math.cos(theta);
      for (let lon = 0; lon <= lonBands; lon++) {
        const u = lon / lonBands;
        const phi = u * Math.PI * 2;
        const lx = sinT * Math.sin(phi);
        const ly = cosT;
        const lz = sinT * Math.cos(phi);
        const [px, py, pz] = rotateVec(lx * rx, ly * ry, lz * rz, rotX, rotY, rotZ);
        const [nx, ny, nz] = rotateVec(lx / arx, ly / ary, lz / arz, rotX, rotY, rotZ);
        const col = isFn ? colorFnOrRgb(u, v, lx, ly, lz) : colorFnOrRgb;
        this.pushVert(cx + px, cy + py, cz + pz, nx, ny, nz, col);
      }
    }

    const row = lonBands + 1;
    for (let lat = 0; lat < latBands; lat++) {
      for (let lon = 0; lon < lonBands; lon++) {
        const a = startIdx + lat * row + lon;
        const b = a + row;
        this.idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }

  addLathe(cx, cy, cz, profilePoints, segs, colorFnOrRgb, rotX = 0, rotY = 0, rotZ = 0, ribAmp = 0, ribFreq = 0) {
    const startIdx = this.pos.length / 3;
    const rows = profilePoints.length;
    const isFn = typeof colorFnOrRgb === 'function';

    for (let rIdx = 0; rIdx < rows; rIdx++) {
      const [y0, rad0] = profilePoints[rIdx];
      const t = rows > 1 ? rIdx / (rows - 1) : 0;
      const prev = profilePoints[Math.max(0, rIdx - 1)];
      const next = profilePoints[Math.min(rows - 1, rIdx + 1)];
      const dy = next[0] - prev[0];
      const dr = next[1] - prev[1];
      let nRadial = dy;
      let nUp = -dr;
      if (Math.hypot(nRadial, nUp) < 1e-5) {
        nRadial = rad0 >= 0 ? 1 : -1;
        nUp = 0;
      }

      for (let s = 0; s <= segs; s++) {
        const u = s / segs;
        const phi = u * Math.PI * 2;
        const cPhi = Math.cos(phi), sPhi = Math.sin(phi);
        const ribPhase = ribFreq > 0 ? Math.cos(phi * ribFreq) : 0;
        const r = rad0 * (1 + ribAmp * ribPhase);
        const lx = r * sPhi;
        const lz = r * cPhi;

        let nxL = nRadial * sPhi;
        let nzL = nRadial * cPhi;
        if (ribAmp !== 0 && ribFreq > 0 && rad0 > 1e-4) {
          const dR = -ribAmp * ribFreq * Math.sin(phi * ribFreq);
          nxL -= dR * cPhi * 0.45;
          nzL += dR * sPhi * 0.45;
        }
        const [px, py, pz] = rotateVec(lx, y0, lz, rotX, rotY, rotZ);
        const [nx, ny, nz] = rotateVec(nxL, nUp, nzL, rotX, rotY, rotZ);
        const col = isFn ? colorFnOrRgb(t, u, rIdx, rad0, y0, phi) : colorFnOrRgb;
        this.pushVert(cx + px, cy + py, cz + pz, nx, ny, nz, col);
      }
    }

    const row = segs + 1;
    for (let rIdx = 0; rIdx < rows - 1; rIdx++) {
      for (let s = 0; s < segs; s++) {
        const a = startIdx + rIdx * row + s;
        const b = a + row;
        this.idx.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
  }

  addTorusRing(cx, cy, cz, majorR, minorR, majorSegs, minorSegs, col, rotX = 0, rotY = 0, rotZ = 0) {
    const startIdx = this.pos.length / 3;
    for (let i = 0; i <= majorSegs; i++) {
      const theta = (i / majorSegs) * Math.PI * 2;
      const cT = Math.cos(theta), sT = Math.sin(theta);
      for (let j = 0; j <= minorSegs; j++) {
        const phi = (j / minorSegs) * Math.PI * 2;
        const cP = Math.cos(phi), sP = Math.sin(phi);
        const rr = majorR + minorR * cP;
        const [px, py, pz] = rotateVec(rr * cT, minorR * sP, rr * sT, rotX, rotY, rotZ);
        const [nx, ny, nz] = rotateVec(cP * cT, sP, cP * sT, rotX, rotY, rotZ);
        this.pushVert(cx + px, cy + py, cz + pz, nx, ny, nz, col);
      }
    }
    const row = minorSegs + 1;
    for (let i = 0; i < majorSegs; i++) {
      for (let j = 0; j < minorSegs; j++) {
        const a = startIdx + i * row + j;
        const b = a + row;
        this.idx.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
  }

  addWingQuad(cx, cy, cz, span, chordIn, chordOut, camberY, rotX, rotY, rotZ, colIn, colOut, segX = 2) {
    const startIdx = this.pos.length / 3;
    for (let ix = 0; ix <= segX; ix++) {
      const t = ix / segX;
      const lx = t * span;
      const halfZ = (chordIn + (chordOut - chordIn) * t) * 0.5;
      const ly = Math.sin(t * Math.PI) * camberY;
      const col = mixRgb(colIn, colOut, t);
      for (const zSign of [1, -1]) {
        const lz = zSign * halfZ + t * chordOut * 0.12;
        const [px, py, pz] = rotateVec(lx, ly, lz, rotX, rotY, rotZ);
        const [nx, ny, nz] = rotateVec(0, 1, 0, rotX, rotY, rotZ);
        this.pushVert(cx + px, cy + py, cz + pz, nx, ny, nz, col);
      }
    }
    for (let ix = 0; ix < segX; ix++) {
      const a = startIdx + ix * 2;
      this.idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }

  finalize() {
    return {
      positions: new Float32Array(this.pos),
      normals: new Float32Array(this.norm),
      colors: new Float32Array(this.col),
      indices: new Uint16Array(this.idx),
      count: this.idx.length
    };
  }
}

// 1. Sói Mực Ma Mị (Haunted Spectral Dire Wolf — unmistakable lupine snout, fangs, big pointed wolf ears, glowing skeleton ribs & dorsal spines)
function buildWolfBody() {
  const b = new EntityMeshBuilder();
  // Deep lupine ribcage with eerie glowing spectral rib markings on flanks
  b.addEllipsoid(0, -0.14, 0.14, 0.23, 0.24, 0.36, 8, 10, (u, v, lx, ly, lz) => {
    const ribWave = Math.sin(lz * 18.0);
    if (Math.abs(lx) > 0.58 && ly > -0.35 && ly < 0.35 && ribWave > 0.55) return EC.violetGlow;
    return ly > 0.42 ? EC.inkMid : EC.obsidian;
  });
  // Narrower wolf waist & hind haunches
  b.addEllipsoid(0, -0.19, -0.24, 0.17, 0.19, 0.26, 6, 8, EC.obsidian);
  // Muscular arched wolf neck
  b.addLathe(0, -0.04, 0.32, [
    [0.00, 0.19],
    [0.14, 0.16],
    [0.26, 0.14]
  ], 8, EC.inkDark, 0.58, 0, 0);
  // 5 Jagged spectral shadow-flame dorsal spines along the wolf's back & neck
  for (let i = 0; i < 5; i++) {
    const sz = 0.32 - i * 0.14;
    const sy = 0.12 - i * 0.035;
    const h = 0.24 - i * 0.025;
    b.addLathe(0, sy, sz, [
      [0.00, 0.055],
      [h * 0.55, 0.032],
      [h, 0.004]
    ], 5, (t) => (t > 0.42 ? EC.violetGlow : EC.inkMid), -0.38, 0, 0);
  }
  // Distinct Wolf Skull, Brows & Long Lupine Snout (+Z)
  b.addEllipsoid(0, 0.12, 0.48, 0.17, 0.155, 0.19, 7, 9, EC.inkDark);
  // Upper elongated wolf muzzle + dark nose tip
  b.addLathe(0, 0.08, 0.58, [
    [0.00, 0.105],
    [0.14, 0.072],
    [0.26, 0.045],
    [0.29, 0.015]
  ], 7, (t) => (t > 0.82 ? EC.violetGlow : EC.obsidian), Math.PI * 0.52, 0, 0);
  // Lower snarling wolf jaw
  b.addLathe(0, 0.01, 0.56, [
    [0.00, 0.078],
    [0.14, 0.052],
    [0.23, 0.028]
  ], 6, EC.inkDark, Math.PI * 0.57, 0, 0);

  for (const s of [1, -1]) {
    // Tall unmistakable triangular wolf ears with glowing violet inner pinnae
    b.addLathe(s * 0.115, 0.22, 0.42, [
      [0.00, 0.068],
      [0.14, 0.045],
      [0.28, 0.005]
    ], 6, (t, u) => (t > 0.3 && Math.cos(u * Math.PI * 2) > 0.2 ? EC.violetGlow : EC.obsidian), -0.15, s * 0.15, -s * 0.22);
    // Fierce glowing dual-layer spectral wolf eyes
    b.addEllipsoid(s * 0.092, 0.145, 0.61, 0.038, 0.022, 0.025, 4, 6, EC.amberEye, 0, s * 0.28, -s * 0.28);
    b.addEllipsoid(s * 0.095, 0.145, 0.625, 0.016, 0.018, 0.012, 3, 5, EC.soulWhite);
    // Swept cheek fur tufts
    b.addLathe(s * 0.15, 0.06, 0.46, [[0, 0.042], [0.14, 0.004]], 5, EC.inkMid, -0.3, s * 0.85, 0);
    // 4 gleaming curved canine fangs (upper & lower)
    b.addLathe(s * 0.046, 0.04, 0.76, [[0, 0.018], [-0.075, 0.003]], 4, EC.fangWhite, 0.12, 0, 0);
    b.addLathe(s * 0.038, -0.03, 0.73, [[0, 0.014], [0.055, 0.003]], 4, EC.fangWhite, -0.1, 0, 0);
  }
  return b.finalize();
}

function buildWolfLeg() {
  const b = new EntityMeshBuilder();
  // Muscular wolf thigh, distinct angled hock joint, spectral ankle flame cuff & clawed lupine paw
  b.addLathe(0, -0.26, 0, [
    [0.26, 0.076],
    [0.13, 0.058],
    [0.00, 0.038]
  ], 7, EC.inkDark);
  b.addLathe(0, -0.50, -0.02, [
    [0.24, 0.044],
    [0.12, 0.032],
    [0.06, 0.044],
    [0.00, 0.030]
  ], 7, (t) => (t > 0.52 && t < 0.84 ? EC.violetGlow : EC.obsidian), 0.08, 0, 0);
  b.addEllipsoid(0, -0.51, 0.035, 0.052, 0.028, 0.072, 5, 6, EC.obsidian);
  return b.finalize();
}

function buildWolfTail() {
  const b = new EntityMeshBuilder();
  // Large bushy crescent wolf tail with glowing spectral tip
  b.addLathe(0, 0.02, 0, [
    [0.00, 0.055],
    [0.16, 0.105],
    [0.34, 0.095],
    [0.50, 0.045],
    [0.62, 0.006]
  ], 7, (t) => (t > 0.55 ? EC.violetGlow : EC.inkMid), -1.15, 0, 0);
  return b.finalize();
}

// 2. Ma Trơi Ám Ảnh (Haunted Wraith Phantom — unmistakable floating ghost shroud, hollow weeping skull mask, outstretched clawed spirit arms & corpse-flames)
function buildWispBody() {
  const b = new EntityMeshBuilder();
  // Swirling vortex phantom tail tapering into a point at the bottom + wide tattered shroud shoulders
  b.addLathe(0, -0.62, 0, [
    [0.00, 0.015],
    [0.18, 0.09],
    [0.38, 0.22],
    [0.62, 0.34],
    [0.84, 0.28],
    [0.98, 0.16]
  ], 12, (t, u) => {
    const wave = Math.sin(u * Math.PI * 6 + t * 4.0);
    if (t < 0.28) return EC.cyanGlow;
    if (wave > 0.55) return EC.violetSoft;
    return mixRgb(EC.obsidian, EC.inkMid, t);
  }, 0, 0, 0, 0.16, 6);

  // Deep eerie cowl hood
  b.addEllipsoid(0, 0.32, -0.02, 0.23, 0.26, 0.22, 7, 10, EC.obsidian);
  b.addLathe(0, 0.52, -0.06, [
    [0.00, 0.14],
    [0.14, 0.08],
    [0.26, 0.01]
  ], 7, EC.inkMid, -0.45, 0, 0);

  // Unmistakable Pale Cracked Ghost Skull Face (+Z) with hollow dark eye sockets & glowing soul pupils
  b.addEllipsoid(0, 0.31, 0.11, 0.155, 0.185, 0.11, 7, 9, (u, v, lx, ly) => {
    if (Math.abs(lx) > 0.25 && Math.abs(lx) < 0.45 && ly < 0.1 && ly > -0.55) return EC.cyanGlow; // spectral tear streaks
    return ly < -0.35 ? EC.boneShade : EC.boneMask;
  });
  for (const s of [1, -1]) {
    // Deep black eye sockets + pinprick cyan soul-fire pupils
    b.addEllipsoid(s * 0.064, 0.33, 0.20, 0.044, 0.050, 0.022, 5, 6, EC.obsidian);
    b.addEllipsoid(s * 0.064, 0.33, 0.214, 0.020, 0.024, 0.014, 4, 5, EC.cyanGlow);
    // Outstretched haunting phantom arms & draping tattered spirit sleeves reaching forward (+Z)
    b.addLathe(s * 0.22, 0.14, 0.04, [
      [0.00, 0.095],
      [0.18, 0.075],
      [0.36, 0.042]
    ], 6, EC.inkDark, Math.PI * 0.42, s * 0.28, -s * 0.35);
    // Hanging ghost sleeve drapery
    b.addWingQuad(s * 0.24, -0.02, 0.18, 0.36, 0.24, 0.06, 0.04, 0, s * 0.3, -Math.PI * 0.48, EC.inkMid, EC.cyanGlow, 2);
    // Spectral bony claw hand
    b.addEllipsoid(s * 0.32, 0.08, 0.38, 0.036, 0.025, 0.055, 4, 5, EC.boneMask, 0.2, s * 0.2, 0);
  }
  // Hollow wailing ghost mouth
  b.addEllipsoid(0, 0.20, 0.205, 0.034, 0.048, 0.018, 5, 6, EC.obsidian);
  return b.finalize();
}

function buildWispFlame() {
  const b = new EntityMeshBuilder();
  // Teardrop ghostly corpse-candle flame (Ma trơi)
  b.addLathe(0, -0.10, 0, [
    [0.00, 0.02],
    [0.06, 0.10],
    [0.14, 0.08],
    [0.24, 0.03],
    [0.32, 0.004]
  ], 7, (t) => (t < 0.45 ? EC.soulWhite : t < 0.78 ? EC.cyanGlow : EC.violetGlow));
  return b.finalize();
}

// 3. Hồ Ly Bóng Đêm (Haunted Nine-Tailed Spirit Fox — unmistakable fox muzzle, oversized kitsune ears, spirit bib & 5 fanned glowing tails)
function buildFoxBody() {
  const b = new EntityMeshBuilder();
  // Slender lithe vulpine torso with eerie glowing cursed-scroll markings
  b.addEllipsoid(0, -0.20, 0.02, 0.165, 0.165, 0.31, 7, 9, (u, v, lx, ly, lz) => {
    const swirl = Math.sin(lz * 14.0 + ly * 8.0);
    if (Math.abs(lx) > 0.62 && swirl > 0.65) return EC.crimsonGlow;
    return EC.inkDark;
  });
  // White-and-crimson kitsune chest fur ruff & spirit bell collar
  b.addEllipsoid(0, -0.09, 0.22, 0.175, 0.135, 0.17, 6, 8, (u, v, lx, ly) => (ly < -0.15 ? EC.boneMask : EC.crimsonGlow), -0.28, 0, 0);
  b.addEllipsoid(0, -0.15, 0.35, 0.042, 0.042, 0.042, 5, 6, EC.goldBright);
  // Fox head with white cheek mask markings & long narrow pointed fox snout (+Z)
  b.addEllipsoid(0, 0.09, 0.34, 0.155, 0.14, 0.16, 7, 8, (u, v, lx, ly, lz) => {
    if (lz > 0.35 && ly < 0.05) return EC.boneMask;
    if (lz > 0.55 && Math.abs(lx) < 0.22 && ly > 0.15) return EC.crimsonGlow; // kitsune forehead mark
    return EC.inkMid;
  });
  b.addLathe(0, 0.05, 0.44, [
    [0.00, 0.076],
    [0.11, 0.046],
    [0.23, 0.016]
  ], 7, (t) => (t > 0.8 ? EC.obsidian : t > 0.35 ? EC.boneMask : EC.inkMid), Math.PI * 0.52, 0, 0);

  for (const s of [1, -1]) {
    // Oversized unmistakable triangular Kitsune Fox Ears with glowing crimson insides & black tips
    b.addLathe(s * 0.11, 0.18, 0.30, [
      [0.00, 0.072],
      [0.14, 0.050],
      [0.31, 0.005]
    ], 6, (t, u) => {
      if (t > 0.78) return EC.obsidian;
      return Math.cos(u * Math.PI * 2) > 0.15 ? EC.crimsonGlow : EC.inkDark;
    }, -0.14, s * 0.22, -s * 0.38);
    // Swept fox cheek whiskers
    b.addLathe(s * 0.14, 0.05, 0.36, [[0, 0.038], [0.13, 0.004]], 5, EC.boneMask, -0.15, s * 0.9, 0);
    // Narrow slitted glowing fox eyes
    b.addEllipsoid(s * 0.082, 0.115, 0.455, 0.035, 0.017, 0.020, 4, 5, EC.amberEye, 0, s * 0.32, -s * 0.30);
  }
  return b.finalize();
}

function buildFoxLeg() {
  const b = new EntityMeshBuilder();
  b.addLathe(0, -0.24, 0, [
    [0.24, 0.054],
    [0.12, 0.040],
    [0.00, 0.025]
  ], 7, EC.inkDark);
  b.addLathe(0, -0.49, 0, [
    [0.25, 0.030],
    [0.12, 0.021],
    [0.05, 0.028],
    [0.00, 0.019]
  ], 7, (t) => (t > 0.48 && t < 0.82 ? EC.crimsonGlow : EC.obsidian));
  b.addEllipsoid(0, -0.50, 0.025, 0.036, 0.020, 0.046, 5, 6, EC.boneMask);
  return b.finalize();
}

function buildFoxTail() {
  const b = new EntityMeshBuilder();
  // 5 grand fanned Kitsune tails with dark base, crimson flame middle & glowing white spirit tips!
  const tailAngles = [-0.72, -0.36, 0, 0.36, 0.72];
  for (let i = 0; i < tailAngles.length; i++) {
    const angY = tailAngles[i];
    const liftX = 0.52 + (i % 2) * 0.16;
    const tx = Math.sin(angY) * 0.14;
    const tz = -0.16 * Math.cos(angY);
    b.addLathe(tx, 0.04, tz, [
      [0.00, 0.038],
      [0.14, 0.092],
      [0.32, 0.085],
      [0.46, 0.038],
      [0.56, 0.005]
    ], 7, (t) => {
      if (t > 0.78) return EC.soulWhite;
      if (t > 0.46) return EC.crimsonGlow;
      return EC.inkMid;
    }, -liftX, angY, 0);
  }
  return b.finalize();
}

// 4. Quạ Bóng Đêm Ba Mắt (Haunted Three-Eyed Raven — unmistakable long hooked raven beak, neck ruff, 3 glowing jade eyes & splayed primary wing feathers)
function buildCrowBody() {
  const b = new EntityMeshBuilder();
  // Plump avian raven breast & tapered body
  b.addEllipsoid(0, -0.02, 0.02, 0.21, 0.22, 0.36, 7, 9, EC.obsidian, -0.22, 0, 0);
  // Tattered spectral neck feather collar
  b.addLathe(0, 0.08, 0.22, [
    [0.00, 0.18],
    [0.08, 0.15],
    [0.15, 0.12]
  ], 8, (t, u) => (Math.sin(u * Math.PI * 8) > 0.3 ? EC.jadeGlow : EC.inkMid), 0.35, 0, 0, 0.14, 8);
  // Distinct Raven Head (+Z) & sweeping occipital feather crest
  b.addEllipsoid(0, 0.19, 0.30, 0.145, 0.15, 0.165, 6, 8, EC.inkDark);
  for (let c = -1; c <= 1; c++) {
    b.addLathe(c * 0.035, 0.28, 0.20, [[0, 0.028], [0.18, 0.004]], 5, EC.jadeGlow, -0.68, c * 0.2, 0);
  }
  // Long, heavy, slightly hooked Raven Beak (+Z)
  b.addLathe(0, 0.17, 0.42, [
    [0.00, 0.068],
    [0.14, 0.044],
    [0.28, 0.018],
    [0.34, 0.003]
  ], 6, (t) => (t > 0.75 ? EC.boneMask : EC.slate), Math.PI * 0.55, 0, 0);
  // Three Glowing Spectral Jade Eyes (left, right, and mystic third eye on forehead!)
  for (const s of [1, -1]) {
    b.addEllipsoid(s * 0.096, 0.21, 0.38, 0.034, 0.028, 0.024, 4, 5, EC.jadeGlow);
    // Curled raven talons tucked beneath breast
    b.addLathe(s * 0.085, -0.22, 0.06, [[0, 0.025], [-0.14, 0.010]], 5, EC.amberEye, 0.35, 0, 0);
  }
  b.addEllipsoid(0, 0.265, 0.43, 0.024, 0.034, 0.018, 4, 5, EC.soulWhite);

  // Splayed 3-feather Raven Tail Fan (-Z)
  for (const ta of [-0.28, 0, 0.28]) {
    b.addWingQuad(Math.sin(ta) * 0.06, -0.08, -0.34, 0.44, 0.14, 0.18, 0.03, 0.24, -Math.PI * 0.5 + ta, 0, EC.obsidian, EC.jadeGlow, 2);
  }
  return b.finalize();
}

function buildCrowWing() {
  const b = new EntityMeshBuilder();
  // Main feathered wing arm + 4 distinct splayed primary flight feathers so the bird silhouette is unmistakable
  b.addWingQuad(0, 0, 0.04, 0.72, 0.34, 0.18, 0.09, 0, 0, 0.08, EC.obsidian, EC.inkMid, 3);
  for (let f = 0; f < 4; f++) {
    const fx = 0.36 + f * 0.14;
    const fz = -0.04 - f * 0.03;
    const span = 0.36 - f * 0.03;
    const sweep = -0.22 - f * 0.14;
    b.addWingQuad(fx, 0.02, fz, span, 0.11, 0.02, 0.03, 0, sweep, 0.04, EC.inkMid, EC.jadeGlow, 2);
  }
  return b.finalize();
}

// Stunned Shadow Puddle Mesh
function buildShadeStunMesh() {
  const b = new EntityMeshBuilder();
  b.addEllipsoid(0, 0, 0, 0.58, 0.20, 0.58, 6, 10, EC.slate);
  b.addTorusRing(0, 0.26, 0, 0.42, 0.035, 14, 5, EC.goldBright);
  return b.finalize();
}

// 5. Bướm Đêm Ma Mị (Ghostly Death's-Head Luna Moth — Drifter)
function buildMothBody() {
  const b = new EntityMeshBuilder();
  // Fuzzy moth thorax with eerie pale skull-crest marking on its back + segmented abdomen
  b.addEllipsoid(0, 0, 0.02, 0.11, 0.11, 0.38, 6, 8, (u, v, lx, ly, lz) => {
    if (ly > 0.45 && Math.abs(lz) < 0.45) return EC.boneMask;
    return EC.mothBody;
  });
  b.addEllipsoid(0, 0.04, 0.36, 0.09, 0.09, 0.10, 5, 6, EC.obsidian);
  for (const s of [1, -1]) {
    b.addEllipsoid(s * 0.06, 0.06, 0.42, 0.028, 0.028, 0.028, 4, 5, EC.cyanGlow);
    // Feathery curved moth antennae
    b.addWingQuad(s * 0.04, 0.08, 0.42, 0.24, 0.07, 0.02, 0.03, 0.55, s * 0.65, 0.2, EC.mothGold, EC.cyanGlow, 2);
  }
  return b.finalize();
}

function buildMothWing() {
  const b = new EntityMeshBuilder();
  // Large upper forewing with glowing spectral eye-spot + swept swallowtail hindwing
  b.addWingQuad(0, 0, 0.12, 0.84, 0.46, 0.56, 0.09, 0, 0.08, 0.12, EC.mothWingIn, EC.mothWingOut, 3);
  b.addEllipsoid(0.44, 0.07, 0.16, 0.09, 0.02, 0.09, 4, 6, EC.mothGold);
  b.addEllipsoid(0.44, 0.08, 0.16, 0.045, 0.022, 0.045, 4, 5, EC.obsidian);
  b.addWingQuad(0, -0.02, -0.22, 0.60, 0.30, 0.10, 0.04, 0, -0.34, -0.05, EC.mothGold, EC.cyanGlow, 2);
  return b.finalize();
}

// 6. Real Detailed 3D Firefly
function buildFireflyBody() {
  const b = new EntityMeshBuilder();
  b.addEllipsoid(0, 0.02, 0.16, 0.062, 0.058, 0.062, 5, 6, EC.ffHead);
  for (const s of [1, -1]) {
    b.addEllipsoid(s * 0.048, 0.035, 0.185, 0.022, 0.022, 0.022, 4, 5, EC.amberEye);
    b.addLathe(s * 0.032, 0.055, 0.20, [[0, 0.010], [0.10, 0.003]], 4, EC.ffHead, 0.95, s * 0.38, 0);
  }
  b.addEllipsoid(0, 0.035, 0.06, 0.078, 0.058, 0.095, 5, 8, EC.ffThorax);
  b.addEllipsoid(0, 0.01, -0.08, 0.086, 0.074, 0.15, 6, 8, (u, v, lx, ly, lz) => {
    return lz < -0.15 ? EC.ffCore : EC.ffGlow;
  });
  b.addEllipsoid(0, 0.005, -0.19, 0.062, 0.056, 0.078, 5, 6, EC.ffCore);
  return b.finalize();
}

function buildFireflyWing() {
  const b = new EntityMeshBuilder();
  b.addWingQuad(0, 0, 0, 0.28, 0.09, 0.05, 0.02, 0, -0.35, 0.08, EC.ffCore, EC.ffWing, 2);
  return b.finalize();
}

// 7. Optimized & Regal Great Lantern Palace Monuments (all decorative roof tassels, lotus crowns & finials baked into single VBOs!)
function buildLanternBase() {
  const b = new EntityMeshBuilder();
  // Two-tier carved lotus-stone pedestal
  b.addLathe(0, 0, 0, [
    [0.00, 0.94],
    [0.20, 0.88],
    [0.26, 0.72],
    [0.44, 0.68],
    [0.52, 0.52],
    [0.56, 0.30]
  ], 8, (t, u, rIdx) => {
    if (rIdx === 2 || rIdx === 4) return EC.gold;
    return t < 0.45 ? EC.stoneDark : EC.stoneMoss;
  });

  // Crimson-lacquered octagonal pillar with gilded lotus collars & upper lantern gallery platform
  b.addLathe(0, 0.52, 0, [
    [0.00, 0.28],
    [0.14, 0.21],
    [1.04, 0.20],
    [1.16, 0.30],
    [1.24, 0.62],
    [1.32, 0.56]
  ], 8, (t, u, rIdx) => {
    if (rIdx === 0 || rIdx === 3 || rIdx === 5) return EC.goldBright;
    if (rIdx === 4) return EC.lacquer;
    return EC.mahogany;
  });

  // 4 slim carved corner posts + 4 hanging crimson-gold corner tassels under the eaves (baked into 1 mesh!)
  for (const [cx, cz] of [[-0.44, -0.44], [0.44, -0.44], [0.44, 0.44], [-0.44, 0.44]]) {
    b.addLathe(cx, 1.80, cz, [[0, 0.044], [0.98, 0.040]], 5, EC.mahogany);
    const tx = cx * 1.95, tz = cz * 1.95;
    b.addLathe(tx, 2.52, tz, [
      [0.00, 0.015],
      [0.12, 0.042],
      [0.24, 0.018]
    ], 5, (t) => (t > 0.55 ? EC.goldBright : EC.crimsonGlow));
  }

  // Double-Tiered Imperial Upturned Vietnamese Pavilion Roofs + Baked Golden Spire Finial
  b.addLathe(0, 2.74, 0, [
    [0.00, 1.24],
    [0.08, 0.96],
    [0.28, 0.62],
    [0.46, 0.36]
  ], 8, (t, u) => {
    const cornerFlare = Math.abs(Math.sin(u * Math.PI * 4));
    if (t < 0.18 && cornerFlare > 0.70) return EC.goldBright;
    return mixRgb(EC.roofTile, EC.lacquer, t * 0.5);
  }, 0, Math.PI / 8, 0, 0.11, 4);

  b.addLathe(0, 3.16, 0, [
    [0.00, 0.76],
    [0.14, 0.48],
    [0.36, 0.16],
    [0.52, 0.05],
    [0.72, 0.11],
    [0.92, 0.01]
  ], 8, (t, u, rIdx) => {
    return rIdx >= 3 ? EC.goldBright : EC.roofTile;
  }, 0, Math.PI / 8, 0, 0.09, 4);

  return b.finalize();
}

function buildLanternCage(isLit) {
  const b = new EntityMeshBuilder();
  const baseA = isLit ? EC.paperLitOut : EC.paperOff;
  const baseB = isLit ? EC.paperLitCore : EC.paperOffRib;
  b.addLathe(0, 2.28, 0, [
    [-0.46, 0.26],
    [-0.36, 0.40],
    [-0.18, 0.48],
    [0.00, 0.52],
    [0.18, 0.48],
    [0.36, 0.40],
    [0.46, 0.26]
  ], 16, (t, u, rIdx, rad0, y0, phi) => {
    if (rIdx === 0 || rIdx === 6) return isLit ? EC.goldBright : EC.stoneDark;
    const rib = Math.cos(phi * 8);
    if (!isLit) return mixRgb(EC.paperOff, EC.paperOffRib, 0.5 + 0.5 * rib);
    if (rib > 0.82) return EC.gold;
    const vGlow = Math.exp(-y0 * y0 * 12);
    return mixRgb(baseA, baseB, Math.min(1, vGlow * 0.72 + (1 - rib) * 0.30));
  }, 0, 0, 0, 0.08, 8);
  return b.finalize();
}

function buildLanternArrowMesh(bodyCol, tipCol, ringCol) {
  const b = new EntityMeshBuilder();
  b.addLathe(0, 0, 0, [
    [-0.64, 0.008],
    [-0.14, 0.36],
    [0.02, 0.46],
    [0.05, 0.44],
    [0.09, 0.17],
    [0.54, 0.19],
    [0.68, 0.008]
  ], 4, (t) => ((t < 0.26 || t > 0.84) ? tipCol : bodyCol), 0, Math.PI * 0.25, 0);
  b.addTorusRing(0, 0.28, 0, 0.36, 0.028, 12, 4, ringCol, 0, 0, 0);
  return b.finalize();
}

// 8. Non-Boxy Stylized Gameplay Props: Wind Charm, Sky Lantern, Spirit Crane, Skill Card & Elemental Orb
function buildCharmTalisman() {
  const b = new EntityMeshBuilder();
  b.addTorusRing(0, 0, 0, 0.34, 0.036, 16, 5, EC.goldBright, Math.PI * 0.5, 0, 0);
  b.addEllipsoid(0, 0, 0, 0.14, 0.22, 0.07, 6, 8, EC.jadeGlow);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    b.addWingQuad(Math.cos(a) * 0.16, Math.sin(a) * 0.16, 0, 0.30, 0.11, 0.03, 0.04, Math.PI * 0.4, 0, a, EC.gold, EC.cyanGlow, 2);
  }
  return b.finalize();
}

function buildSkyLanternMesh() {
  const b = new EntityMeshBuilder();
  b.addLathe(0, -0.36, 0, [
    [0.00, 0.16],
    [0.14, 0.24],
    [0.44, 0.32],
    [0.64, 0.28],
    [0.74, 0.04]
  ], 10, (t) => {
    if (t < 0.08) return EC.goldBright;
    return mixRgb(EC.paperLitCore, EC.paperLitOut, Math.abs(t - 0.32) * 1.4);
  }, 0, 0, 0, 0.04, 5);
  return b.finalize();
}

function buildCraneBody() {
  const b = new EntityMeshBuilder();
  b.addEllipsoid(0, 0, 0, 0.18, 0.14, 0.44, 6, 8, EC.moonWhite);
  b.addLathe(0, 0.04, 0.34, [
    [0.00, 0.065],
    [0.24, 0.042],
    [0.46, 0.048],
    [0.54, 0.028]
  ], 6, EC.moonWhite, Math.PI * 0.46, 0, 0);
  b.addLathe(0, 0.11, 0.86, [[0, 0.026], [0.16, 0.004]], 5, EC.goldBright, Math.PI * 0.5, 0, 0);
  b.addWingQuad(0, -0.02, -0.36, 0.45, 0.14, 0.26, 0.03, 0, -Math.PI * 0.5, 0, EC.moonWhite, EC.goldBright, 2);
  return b.finalize();
}

function buildCraneWing() {
  const b = new EntityMeshBuilder();
  b.addWingQuad(0, 0, 0.08, 1.15, 0.44, 0.12, 0.09, 0, -0.18, 0.06, EC.moonWhite, EC.goldBright, 3);
  return b.finalize();
}

function buildSkillCardMesh() {
  const b = new EntityMeshBuilder();
  b.addTorusRing(0, 0, 0, 0.44, 0.036, 16, 5, EC.goldBright, Math.PI * 0.5, 0, 0);
  b.addLathe(0, 0, 0, [
    [-0.48, 0.02],
    [-0.22, 0.30],
    [0.00, 0.36],
    [0.22, 0.30],
    [0.48, 0.02]
  ], 8, (t) => mixRgb(EC.gold, EC.fangWhite, Math.sin(t * Math.PI) * 0.85), 0, 0, 0);
  b.addEllipsoid(0, 0, 0, 0.16, 0.24, 0.09, 5, 8, EC.fangWhite);
  return b.finalize();
}

function buildProjectileOrbMesh() {
  const b = new EntityMeshBuilder();
  b.addLathe(0, 0, -0.35, [
    [0.00, 0.02],
    [0.22, 0.16],
    [0.42, 0.14],
    [0.72, 0.01]
  ], 8, EC.fangWhite, Math.PI * 0.5, 0, 0);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    b.addWingQuad(0, 0, -0.10, 0.34, 0.14, 0.04, 0.02, 0, -Math.PI * 0.5, a, EC.fangWhite, EC.goldBright, 2);
  }
  return b.finalize();
}

export function buildEntityModelsData() {
  return {
    wolfBody: buildWolfBody(),
    wolfLeg: buildWolfLeg(),
    wolfTail: buildWolfTail(),
    wispBody: buildWispBody(),
    wispFlame: buildWispFlame(),
    foxBody: buildFoxBody(),
    foxLeg: buildFoxLeg(),
    foxTail: buildFoxTail(),
    crowBody: buildCrowBody(),
    crowWing: buildCrowWing(),
    shadeStunMesh: buildShadeStunMesh(),
    mothBody: buildMothBody(),
    mothWing: buildMothWing(),
    fireflyBody: buildFireflyBody(),
    fireflyWing: buildFireflyWing(),
    lanternBase: buildLanternBase(),
    lanternLitCage: buildLanternCage(true),
    lanternUnlitCage: buildLanternCage(false),
    lanternArrowGold: buildLanternArrowMesh(EC.gold, EC.paperLitCore, EC.goldBright),
    lanternArrowUrgent: buildLanternArrowMesh(EC.crimsonGlow, EC.soulWhite, EC.goldBright),
    lanternArrowUrgentCb: buildLanternArrowMesh(EC.cyanGlow, EC.soulWhite, EC.soulWhite),
    charmTalisman: buildCharmTalisman(),
    skyLanternMesh: buildSkyLanternMesh(),
    craneBody: buildCraneBody(),
    craneWing: buildCraneWing(),
    skillCardMesh: buildSkillCardMesh(),
    projectileOrbMesh: buildProjectileOrbMesh()
  };
}

function uploadSubMesh(gl, data) {
  const posBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, data.positions, gl.STATIC_DRAW);

  const normBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, normBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, data.normals, gl.STATIC_DRAW);

  const colBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, colBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, data.colors, gl.STATIC_DRAW);

  const idxBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.indices, gl.STATIC_DRAW);

  return { posBuffer, normBuffer, colBuffer, idxBuffer, count: data.count };
}

export function uploadEntityModels(gl) {
  const raw = buildEntityModelsData();
  const gpu = {};
  for (const k of Object.keys(raw)) {
    gpu[k] = uploadSubMesh(gl, raw[k]);
  }
  return gpu;
}

export function getShadeVariant(seed, shadeId, colorblind = false) {
  const idNum = parseInt(String(shadeId).replace(/\D+/g, ''), 10) || 1;
  let h = (Math.imul(seed | 0, 73856093) ^ Math.imul(idNum, 19349663)) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;

  return {
    archetype: h % 4, // 0: Wolf, 1: Wisp, 2: Fox, 3: Crow
    scale: 0.90 + (((h >>> 4) & 255) / 255) * 0.28,
    accentColor: colorblind ? PALETTE.shadeRimColorblind : SHADE_ACCENTS[(h >>> 12) & 3],
    speedPhase: (((h >>> 16) & 255) / 255) * Math.PI * 2,
    spinDir: (h & 8) ? 1 : -1
  };
}

function updateMonsterSmoothState(renderer, id, tx, ty, tz, targetYaw, activeDt, frameTag) {
  const map = renderer.monsterVis;
  if (!map) return { x: tx, y: ty, z: tz, yaw: targetYaw, speed: 0, stride: 0, seen: frameTag };
  let mv = map.get(id);
  if (!mv) {
    mv = { x: tx, y: ty, z: tz, yaw: targetYaw, speed: 0, stride: 0, seen: frameTag };
    map.set(id, mv);
    return mv;
  }
  mv.seen = frameTag;
  if (activeDt > 0) {
    const jumpD = Math.hypot(tx - mv.x, tz - mv.z);
    if (jumpD > 8.0) {
      mv.x = tx; mv.y = ty; mv.z = tz;
      mv.yaw = targetYaw;
      mv.speed = 0;
    } else {
      const kPos = Math.min(1.0, 1.0 - Math.exp(-14.0 * activeDt));
      const nx = mv.x + (tx - mv.x) * kPos;
      const ny = mv.y + (ty - mv.y) * kPos;
      const nz = mv.z + (tz - mv.z) * kPos;
      const instSpd = Math.hypot(nx - mv.x, nz - mv.z) / Math.max(0.004, activeDt);
      mv.x = nx; mv.y = ny; mv.z = nz;
      const kSpd = Math.min(1.0, 1.0 - Math.exp(-9.0 * activeDt));
      mv.speed += (instSpd - mv.speed) * kSpd;
      let diff = targetYaw - mv.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      mv.yaw += diff * Math.min(1.0, 1.0 - Math.exp(-10.0 * activeDt));
      mv.stride += activeDt * (2.6 + Math.min(8.5, mv.speed * 1.9));
    }
  }
  return mv;
}

export function renderGreatLanterns(renderer, engine, timeSec, reducedMotion, colorblind, benchmarkMode, frameLights) {
  const em = renderer.getEntityModels ? renderer.getEntityModels() : renderer.entityModels;
  if (!em) return;
  const sm = renderer.scratchMat;

  // Ultra-lean 2 draw calls per Great Lantern monument (+1 overhead 3D indicator arrow when unlit or low fuel)
  renderer.beginColoredModelPass(frameLights.count, frameLights.playerGlow, frameLights.pulseStrength, frameLights.ambientIntensity);
  for (let i = 0; i < engine.lanterns.length; i++) {
    const l = engine.lanterns[i];
    const lx = l.pos[0], ly = l.pos[1], lz = l.pos[2];
    renderer.jRoot.setTranslate(lx, ly, lz);
    renderer.drawColoredModel(em.lanternBase, renderer.jRoot, 0.0);

    const isLowFuel = l.lit && l.fuelUnits < 1800;
    if (l.lit) {
      const blinkOn = reducedMotion || !isLowFuel || Math.floor(timeSec * 2.0) % 2 === 0;
      renderer.drawColoredModel(em.lanternLitCage, renderer.jRoot, blinkOn ? 0.96 : 0.16);
    } else {
      renderer.drawColoredModel(em.lanternUnlitCage, renderer.jRoot, 0.04);
    }

    if (!benchmarkMode && (!l.lit || isLowFuel)) {
      const arrowMesh = isLowFuel
        ? (colorblind ? em.lanternArrowUrgentCb : em.lanternArrowUrgent)
        : em.lanternArrowGold;
      const bob = reducedMotion
        ? 0
        : (isLowFuel ? Math.sin(timeSec * 6.0 + i * 1.1) * 0.24 : Math.sin(timeSec * 3.4 + i * 1.1) * 0.22);
      const baseH = isLowFuel ? 5.55 : 5.15;
      const rotY = reducedMotion ? 0.35 : timeSec * 1.9 + i * 0.9;
      const sc = isLowFuel && !reducedMotion ? 1.0 + 0.10 * Math.sin(timeSec * 6.0 + i) : 1.0;
      renderer.jDraw.setTranslate(lx, ly + baseH + bob, lz).mulRotateY(rotY).mulScale(sc, sc, sc);
      renderer.drawColoredModel(arrowMesh, renderer.jDraw, 0.94);
    }
  }
  renderer.endColoredModelPass();

  for (let i = 0; i < engine.lanterns.length; i++) {
    const l = engine.lanterns[i];
    if (!l.lit) continue;
    const lx = l.pos[0], ly = l.pos[1], lz = l.pos[2];
    const fuelRatio = Math.max(0, Math.min(1, l.fuelUnits / 6000));
    const isLowFuel = l.fuelUnits < 1800;
    const blinkOn = reducedMotion || !isLowFuel || Math.floor(timeSec * 2.0) % 2 === 0;

    if (!isLowFuel) {
      const ringPulse = 5.95 + 0.08 * Math.sin(timeSec * 2.5 + i);
      renderer.drawMesh(renderer.meshes.ring, sm.setTRS(lx, ly + 0.06, lz, ringPulse, 1, ringPulse, timeSec * 0.35), PALETTE.lanternLit, 0.65);
    }
    if (blinkOn) {
      const barW = 1.6;
      const fillW = Math.max(0.05, barW * fuelRatio);
      const barColor = isLowFuel
        ? (colorblind ? PALETTE.dangerColorblind : PALETTE.danger)
        : PALETTE.lanternCore;
      renderer.drawMesh(renderer.meshes.cube, sm.setTRS(lx, ly + 4.42, lz, barW + 0.08, 0.16, 0.08), PALETTE.shadeBody, 0.2);
      renderer.drawMesh(renderer.meshes.cube, sm.setTRS(lx - (barW - fillW) / 2, ly + 4.42, lz, fillW, 0.12, 0.12), barColor, 0.95);
    }
  }
}

const WOLF_HIPS = [
  [0.15, -0.22, 0.23, 1],
  [-0.15, -0.22, 0.23, -1],
  [0.14, -0.22, -0.24, -1],
  [-0.14, -0.22, -0.24, 1]
];

const FOX_HIPS = [
  [0.118, -0.22, 0.18, 1],
  [-0.118, -0.22, 0.18, -1],
  [0.118, -0.22, -0.20, -1],
  [-0.118, -0.22, -0.20, 1]
];

export function renderSculptedMonsters(renderer, engine, timeSec, reducedMotion, colorblind, frameLights, activeDt = 1 / 60) {
  const em = renderer.getEntityModels ? renderer.getEntityModels() : renderer.entityModels;
  if (!em) return;
  const sm = renderer.scratchMat;
  const ppx = engine.player.pos[0], ppz = engine.player.pos[2];
  const frameTag = (renderer.monsterVisFrame = ((renderer.monsterVisFrame || 0) + 1) | 0);

  renderer.beginColoredModelPass(frameLights.count, frameLights.playerGlow, frameLights.pulseStrength, frameLights.ambientIntensity);
  for (let i = 0; i < engine.shades.length; i++) {
    const shade = engine.shades[i];
    const v = getShadeVariant(engine.seed, shade.id, colorblind);
    let tx = ppx, tz = ppz;
    if (shade.state === 'drain' && shade.targetLanternId) {
      const tl = engine.lanterns.find(l => l.id === shade.targetLanternId);
      if (tl) { tx = tl.pos[0]; tz = tl.pos[2]; }
    } else if (shade.state === 'wander') {
      tx = shade.pos[0] + Math.cos(shade.wanderAngle || 0);
      tz = shade.pos[2] + Math.sin(shade.wanderAngle || 0);
    }
    const targetYaw = Math.atan2(tx - shade.pos[0], tz - shade.pos[2]);
    const mv = updateMonsterSmoothState(renderer, shade.id, shade.pos[0], shade.pos[1], shade.pos[2], targetYaw, activeDt, frameTag);
    const sx = mv.x, sy = mv.y, sz = mv.z;

    const isStunned = shade.state === 'stunned';
    const isSpawning = shade.state === 'spawning';
    const emergeScale = isSpawning ? (0.35 + 0.65 * Math.max(0, 1 - (shade.stateTicksLeft || 0) / 30)) : 1.0;
    const sc = v.scale * emergeScale;

    if (isStunned) {
      renderer.jRoot.setTranslate(sx, sy - 0.66, sz).mulRotateY(timeSec * 3.0 * v.spinDir).mulScale(sc, sc, sc);
      renderer.drawColoredModel(em.shadeStunMesh, renderer.jRoot, 0.45);
      continue;
    }

    const walkMove = Math.min(1.0, mv.speed / 1.8);
    const gaitAmp = reducedMotion ? 0 : walkMove * 0.72;

    if (v.archetype === 0) {
      // Sói Mực Ma Mị (Haunted Spectral Wolf)
      const stride = reducedMotion ? 0 : Math.abs(Math.sin(mv.stride * 2.0)) * 0.075 * walkMove;
      const pitch = reducedMotion ? 0 : Math.sin(mv.stride * 2.0) * 0.06 * walkMove;
      renderer.jRoot.setTranslate(sx, sy + stride, sz).mulRotateY(mv.yaw).mulRotateX(pitch).mulScale(sc, sc, sc);
      renderer.drawColoredModel(em.wolfBody, renderer.jRoot, 0.10);
      const tailWag = reducedMotion ? 0 : Math.sin(timeSec * 5.5 + v.speedPhase + mv.stride) * 0.38;
      renderer.jDraw.copy(renderer.jRoot).mulTranslate(0, -0.10, -0.34).mulRotateY(tailWag);
      renderer.drawColoredModel(em.wolfTail, renderer.jDraw, 0.38);

      const swingA = Math.sin(mv.stride + v.speedPhase) * gaitAmp;
      for (let k = 0; k < 4; k++) {
        const h = WOLF_HIPS[k];
        renderer.jHip.copy(renderer.jRoot).mulTranslate(h[0], h[1], h[2]).mulRotateX(swingA * h[3]);
        renderer.drawColoredModel(em.wolfLeg, renderer.jHip, 0.08);
      }
    } else if (v.archetype === 1) {
      // Ma Trơi Ám Ảnh (Haunted Wraith Phantom with 3 orbiting corpse-candles)
      const hover = Math.sin(timeSec * 3.0 + v.speedPhase) * 0.16;
      const swayZ = reducedMotion ? 0 : Math.sin(timeSec * 2.2 + v.speedPhase) * 0.10;
      const tilt = reducedMotion ? 0 : Math.min(0.24, mv.speed * 0.055);
      renderer.jRoot.setTranslate(sx, sy + hover, sz).mulRotateY(mv.yaw).mulRotateX(tilt).mulRotateZ(swayZ).mulScale(sc, sc, sc);
      renderer.drawColoredModel(em.wispBody, renderer.jRoot, 0.28);
      for (let f = 0; f < 3; f++) {
        const fa = timeSec * 3.2 * v.spinDir + (f * Math.PI * 2) / 3 + v.speedPhase;
        renderer.jDraw.setTranslate(sx + Math.cos(fa) * 0.62 * sc, sy + hover + 0.16 + Math.sin(fa * 2) * 0.15, sz + Math.sin(fa) * 0.62 * sc).mulScale(sc, sc, sc);
        renderer.drawColoredModel(em.wispFlame, renderer.jDraw, 0.96);
      }
    } else if (v.archetype === 2) {
      // Hồ Ly Bóng Đêm (Five-Tailed Haunted Kitsune)
      const bound = reducedMotion ? 0 : Math.abs(Math.sin(mv.stride * 2.0)) * 0.068 * walkMove;
      const pitch = reducedMotion ? 0 : Math.cos(mv.stride * 2.0) * 0.055 * walkMove;
      renderer.jRoot.setTranslate(sx, sy + bound, sz).mulRotateY(mv.yaw).mulRotateX(pitch).mulScale(sc, sc, sc);
      renderer.drawColoredModel(em.foxBody, renderer.jRoot, 0.12);
      const tailSwish = reducedMotion ? 0 : Math.sin(timeSec * 4.6 + v.speedPhase) * 0.32;
      renderer.jDraw.copy(renderer.jRoot).mulTranslate(0, -0.12, -0.26).mulRotateY(tailSwish);
      renderer.drawColoredModel(em.foxTail, renderer.jDraw, 0.48);

      const swingA = Math.sin(mv.stride + v.speedPhase) * gaitAmp;
      for (let k = 0; k < 4; k++) {
        const h = FOX_HIPS[k];
        renderer.jHip.copy(renderer.jRoot).mulTranslate(h[0], h[1], h[2]).mulRotateX(swingA * h[3]);
        renderer.drawColoredModel(em.foxLeg, renderer.jHip, 0.08);
      }
    } else {
      // Quạ Bóng Đêm Ba Mắt (Haunted Three-Eyed Raven)
      const hover = Math.sin(timeSec * 4.5 + v.speedPhase) * 0.15;
      const flap = reducedMotion ? 0.15 : Math.sin(timeSec * 10.0 + v.speedPhase) * 0.64;
      renderer.jRoot.setTranslate(sx, sy + 0.08 + hover, sz).mulRotateY(mv.yaw).mulScale(sc, sc, sc);
      renderer.drawColoredModel(em.crowBody, renderer.jRoot, 0.14);
      renderer.jDraw.copy(renderer.jRoot).mulTranslate(0.14, 0.06, 0.05).mulRotateZ(flap);
      renderer.drawColoredModel(em.crowWing, renderer.jDraw, 0.28);
      renderer.jDraw.copy(renderer.jRoot).mulTranslate(-0.14, 0.06, 0.05).mulScale(-1, 1, 1).mulRotateZ(flap);
      renderer.drawColoredModel(em.crowWing, renderer.jDraw, 0.28);
    }
  }

  // Drifters -> Bướm Đêm Ma Mị (Ghostly Death's-Head Luna Moth)
  for (let i = 0; i < engine.drifters.length; i++) {
    const drifter = engine.drifters[i];
    if (drifter.state === 'removed') continue;
    const hdgTarget = drifter.state === 'chase'
      ? Math.atan2(ppx - drifter.pos[0], ppz - drifter.pos[2])
      : drifter.state === 'flee'
        ? Math.atan2(drifter.pos[0] - ppx, drifter.pos[2] - ppz)
        : -(drifter.orbitAngle || timeSec * 1.5);
    const mv = updateMonsterSmoothState(renderer, drifter.id, drifter.pos[0], drifter.pos[1], drifter.pos[2], hdgTarget, activeDt, frameTag);
    const dx = mv.x, dy = mv.y + Math.sin(timeSec * 5.0 + i) * 0.20, dz = mv.z;
    const flap = reducedMotion ? 0.2 : Math.sin(timeSec * 14.0 + i) * 0.65;
    renderer.jRoot.setTranslate(dx, dy, dz).mulRotateY(mv.yaw);
    renderer.drawColoredModel(em.mothBody, renderer.jRoot, 0.72);
    renderer.jDraw.copy(renderer.jRoot).mulTranslate(0.08, 0.04, 0.04).mulRotateZ(flap);
    renderer.drawColoredModel(em.mothWing, renderer.jDraw, 0.78);
    renderer.jDraw.copy(renderer.jRoot).mulTranslate(-0.08, 0.04, 0.04).mulScale(-1, 1, 1).mulRotateZ(flap);
    renderer.drawColoredModel(em.mothWing, renderer.jDraw, 0.78);
  }
  renderer.endColoredModelPass();

  if (renderer.monsterVis) {
    for (const [key, val] of renderer.monsterVis) {
      if (val.seen !== frameTag) renderer.monsterVis.delete(key);
    }
  }

  // Pass B: Ground accent rings, drain beams & spawning portals
  for (let i = 0; i < engine.shades.length; i++) {
    const shade = engine.shades[i];
    const v = getShadeVariant(engine.seed, shade.id, colorblind);
    const mv = renderer.monsterVis ? renderer.monsterVis.get(shade.id) : null;
    const sx = mv ? mv.x : shade.pos[0];
    const sy = mv ? mv.y : shade.pos[1];
    const sz = mv ? mv.z : shade.pos[2];
    const isDraining = shade.state === 'drain';
    const isSpawning = shade.state === 'spawning';

    const ringScale = (isDraining ? 1.15 : 0.85) * v.scale;
    renderer.drawMesh(renderer.meshes.ring, sm.setTRS(sx, Math.max(0.04, sy - 0.74), sz, ringScale, 1, ringScale), v.accentColor, 0.85);

    if (isSpawning) {
      const prog = 1.0 - (shade.stateTicksLeft || 0) / 30.0;
      const pr = 0.45 + Math.max(0, Math.min(1, prog)) * 1.55;
      renderer.drawMesh(renderer.meshes.ring, sm.setTRS(sx, Math.max(0.06, sy - 0.72), sz, pr, 1, pr), v.accentColor, 0.95);
    }
    if (isDraining && shade.targetLanternId) {
      const tl = engine.lanterns.find(l => l.id === shade.targetLanternId);
      if (tl) {
        for (let b = 0; b < 4; b++) {
          const bt = (timeSec * 1.8 + b * 0.25) % 1.0;
          const bx = tl.pos[0] + (sx - tl.pos[0]) * bt;
          const by = (tl.pos[1] + 2.2) + (sy - (tl.pos[1] + 2.2)) * bt;
          const bz = tl.pos[2] + (sz - tl.pos[2]) * bt;
          renderer.drawMesh(renderer.meshes.sphereLow, sm.setTRS(bx, by, bz, 0.22, 0.22, 0.22), v.accentColor, 0.95);
        }
      }
    }
  }

  for (let i = 0; i < engine.drifters.length; i++) {
    const drifter = engine.drifters[i];
    if (drifter.state === 'removed' || drifter.stolen <= 0) continue;
    const mv = renderer.monsterVis ? renderer.monsterVis.get(drifter.id) : null;
    const dx = mv ? mv.x : drifter.pos[0];
    const dy = (mv ? mv.y : drifter.pos[1]) + Math.sin(timeSec * 5.0 + i) * 0.20;
    const dz = mv ? mv.z : drifter.pos[2];
    renderer.drawMesh(renderer.meshes.sphereLow, sm.setTRS(dx, dy + 0.35, dz, 0.30, 0.30, 0.30), PALETTE.moteCore, 0.92);
  }
}

export function renderDetailedFireflies(renderer, engine, timeSec, frameLights) {
  const em = renderer.getEntityModels ? renderer.getEntityModels() : renderer.entityModels;
  if (!em || engine.motes.length === 0) return;
  const sm = renderer.scratchMat;
  const camX = renderer.camPosF32[0];
  const camZ = renderer.camPosF32[2];

  // 1. Large, Unmistakable 3D Collectible Ground Fireflies (scale = 1.95x; draw tiny wings within 16m)
  renderer.beginColoredModelPass(frameLights.count, frameLights.playerGlow, frameLights.pulseStrength, frameLights.ambientIntensity);
  for (let i = 0; i < engine.motes.length; i++) {
    const m = engine.motes[i];
    const bob = Math.sin(timeSec * 3.5 + m.pos[0]) * 0.18 + 0.74;
    const swayX = Math.cos(timeSec * 2.2 + m.pos[2]) * 0.11;
    const hdg = timeSec * 1.6 + i * 0.9;
    const fx = m.pos[0] + swayX, fy = m.pos[1] + bob, fz = m.pos[2];
    const sc = 1.95;

    renderer.jRoot.setTranslate(fx, fy, fz).mulRotateY(hdg).mulScale(sc, sc, sc);
    renderer.drawColoredModel(em.fireflyBody, renderer.jRoot, 0.96);

    const dx = fx - camX, dz = fz - camZ;
    if (dx * dx + dz * dz <= 256) {
      const wingFlap = Math.sin(timeSec * 34.0 + i * 1.7) * 0.62;
      renderer.jDraw.copy(renderer.jRoot).mulTranslate(0.05, 0.06, 0.05).mulRotateZ(wingFlap);
      renderer.drawColoredModel(em.fireflyWing, renderer.jDraw, 0.68);
      renderer.jDraw.copy(renderer.jRoot).mulTranslate(-0.05, 0.06, 0.05).mulScale(-1, 1, 1).mulRotateZ(wingFlap);
      renderer.drawColoredModel(em.fireflyWing, renderer.jDraw, 0.68);
    }
  }
  renderer.endColoredModelPass();

  // 2. Large Crisp Double-Layer Ground Beacon Rings (batched via GPU instancing!)
  if (renderer.instExt) {
    renderer.beginInstancedPass(frameLights.count, frameLights.playerGlow, frameLights.pulseStrength, frameLights.ambientIntensity);
    let rc = 0;
    for (let i = 0; i < engine.motes.length; i++) {
      const m = engine.motes[i];
      const mc = getMoteColor(m.id);
      const pulseR = 0.78 + 0.14 * Math.sin(timeSec * 4.5 + i);
      rc = renderer.pushInstance(rc, m.pos[0], m.pos[1] + 0.05, m.pos[2], 0, pulseR, 1, pulseR, mc);
      if (rc === renderer.MAX_INSTANCES) { renderer.drawInstancedBatch(renderer.meshes.ring, rc, 0.96); rc = 0; }
      rc = renderer.pushInstance(rc, m.pos[0], m.pos[1] + 0.06, m.pos[2], 0, 0.44, 1, 0.44, PALETTE.moteCore);
      if (rc === renderer.MAX_INSTANCES) { renderer.drawInstancedBatch(renderer.meshes.ring, rc, 0.96); rc = 0; }
    }
    renderer.drawInstancedBatch(renderer.meshes.ring, rc, 0.96);
    renderer.endInstancedPass();
  } else {
    for (let i = 0; i < engine.motes.length; i++) {
      const m = engine.motes[i];
      const mc = getMoteColor(m.id);
      const pulseR = 0.78 + 0.14 * Math.sin(timeSec * 4.5 + i);
      renderer.drawMesh(renderer.meshes.ring, sm.setTRS(m.pos[0], m.pos[1] + 0.05, m.pos[2], pulseR, 1, pulseR), mc, 0.96);
      renderer.drawMesh(renderer.meshes.ring, sm.setTRS(m.pos[0], m.pos[1] + 0.06, m.pos[2], 0.44, 1, 0.44), PALETTE.moteCore, 0.98);
    }
  }
}

export function renderSkillCardsAndProjectiles(renderer, skillCards, projectiles, lockTargetPos, lockColor, timeSec, frameLights) {
  const em = renderer.getEntityModels ? renderer.getEntityModels() : renderer.entityModels;
  if (!em) return;
  const sm = renderer.scratchMat;

  const hasCards = skillCards && skillCards.length > 0;
  const hasProj = projectiles && projectiles.length > 0;

  if (hasCards || hasProj) {
    renderer.beginColoredModelPass(frameLights.count, frameLights.playerGlow, frameLights.pulseStrength, frameLights.ambientIntensity);
    if (hasCards) {
      for (let i = 0; i < skillCards.length; i++) {
        const c = skillCards[i];
        const hover = Math.sin(timeSec * 3.4 + i * 1.7) * 0.16;
        renderer.jRoot.setTranslate(c.pos[0], c.pos[1] + 1.05 + hover, c.pos[2]).mulRotateY(timeSec * 2.2 + i);
        renderer.drawColoredModel(em.skillCardMesh, renderer.jRoot, 0.92);
      }
    }
    if (hasProj) {
      for (let i = 0; i < projectiles.length; i++) {
        const p = projectiles[i];
        const yaw = Math.atan2(p.dir[0], p.dir[2]);
        const pitch = -Math.asin(Math.max(-0.98, Math.min(0.98, p.dir[1])));
        renderer.jRoot.setTranslate(p.pos[0], p.pos[1], p.pos[2]).mulRotateY(yaw).mulRotateX(pitch).mulRotateZ(timeSec * 12.0).mulScale(1.15, 1.15, 1.15);
        renderer.drawColoredModel(em.projectileOrbMesh, renderer.jRoot, 0.98);
      }
    }
    renderer.endColoredModelPass();
  }

  if (hasCards) {
    for (let i = 0; i < skillCards.length; i++) {
      const c = skillCards[i];
      const hover = Math.sin(timeSec * 3.4 + i * 1.7) * 0.16;
      const pulse = 0.92 + 0.14 * Math.sin(timeSec * 5.0 + i);
      renderer.drawMesh(renderer.meshes.ring, sm.setTRS(c.pos[0], c.pos[1] + 0.08, c.pos[2], pulse, 1, pulse, timeSec * 1.5), c.skill.color, 0.95);
      renderer.drawMesh(renderer.meshes.sphereLow, sm.setTRS(c.pos[0], c.pos[1] + 1.05 + hover, c.pos[2], 0.24, 0.24, 0.24), c.skill.color, 0.98);
    }
  }

  if (lockTargetPos && lockColor) {
    const lp = 1.25 + 0.16 * Math.sin(timeSec * 8.0);
    renderer.drawMesh(renderer.meshes.ring, sm.setTRS(lockTargetPos[0], lockTargetPos[1], lockTargetPos[2], lp, 1, lp, timeSec * 3.5), lockColor, 0.96);
    renderer.drawMesh(renderer.meshes.ring, sm.setTRS(lockTargetPos[0], lockTargetPos[1] + 0.03, lockTargetPos[2], lp * 0.65, 1, lp * 0.65, -timeSec * 4.5), EC.fangWhite, 0.96);
  }
}
