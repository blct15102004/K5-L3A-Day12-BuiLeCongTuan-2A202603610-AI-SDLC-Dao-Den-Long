// Sculpted multi-colored 3D hero character model ("Mây — Người giữ đèn nhỏ tuổi")
// Pure browser-safe ES module (zero node:* imports)
import { PALETTE } from '../core/constants.js';

const HERO_C = {
  skin: [0.99, 0.87, 0.78],
  skinShadow: [0.93, 0.73, 0.61],
  cheek: [0.98, 0.54, 0.54],
  lip: [0.89, 0.34, 0.38],
  mouthInside: [0.52, 0.14, 0.20],
  hair: [0.09, 0.10, 0.15],
  hairSheen: [0.18, 0.20, 0.30],
  eyeWhite: [0.99, 0.99, 1.0],
  irisDark: [0.24, 0.11, 0.06],
  irisGold: [0.86, 0.56, 0.20],
  strawLight: [0.84, 0.69, 0.45],
  strawBand: [0.71, 0.55, 0.34],
  strawInner: [0.56, 0.42, 0.25],
  bambooRim: [0.39, 0.25, 0.14],
  gold: [0.95, 0.77, 0.26],
  goldBright: [1.0, 0.91, 0.50],
  tunic: [0.96, 0.93, 0.82],
  tunicShade: [0.86, 0.81, 0.69],
  crimson: [0.76, 0.11, 0.22],
  crimsonBright: [0.89, 0.19, 0.30],
  crimsonDark: [0.52, 0.06, 0.15],
  jadeOuter: [0.16, 0.96, 0.78],
  jadeCore: [0.68, 1.0, 0.94],
  pants: [0.18, 0.22, 0.35],
  pantsShade: [0.13, 0.16, 0.27],
  wrapLight: [0.90, 0.85, 0.73],
  wrapEdge: [0.74, 0.67, 0.54],
  sandalWood: [0.52, 0.33, 0.19],
  sandalCleat: [0.36, 0.21, 0.12],
  bambooPole: [0.57, 0.43, 0.25],
  bambooNode: [0.34, 0.23, 0.12],
  lanternRib: [0.94, 0.34, 0.12],
  lanternGlow: [1.0, 0.79, 0.26],
  lanternCore: [1.0, 0.96, 0.68],
  wireDark: [0.22, 0.17, 0.15]
};

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

function mulRgb(c, f) {
  return [
    Math.min(1, Math.max(0, c[0] * f)),
    Math.min(1, Math.max(0, c[1] * f)),
    Math.min(1, Math.max(0, c[2] * f))
  ];
}

class HeroMeshBuilder {
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

  addLathe(cx, cy, cz, profilePoints, segs, colorFnOrRgb, rotX = 0, rotY = 0, rotZ = 0, ribAmp = 0, ribFreq = 0, doubleSided = false) {
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
        if (doubleSided) {
          this.idx.push(a, b, a + 1, b, a + 1, b + 1);
        }
      }
    }
  }

  addBox(cx, cy, cz, sx, sy, sz, rotX, rotY, rotZ, col) {
    const faces = [
      { n: [0, 0, 1], verts: [[-0.5,-0.5,0.5],[0.5,-0.5,0.5],[0.5,0.5,0.5],[-0.5,0.5,0.5]] },
      { n: [0, 0,-1], verts: [[0.5,-0.5,-0.5],[-0.5,-0.5,-0.5],[-0.5,0.5,-0.5],[0.5,0.5,-0.5]] },
      { n: [0, 1, 0], verts: [[-0.5,0.5,0.5],[0.5,0.5,0.5],[0.5,0.5,-0.5],[-0.5,0.5,-0.5]] },
      { n: [0,-1, 0], verts: [[-0.5,-0.5,-0.5],[0.5,-0.5,-0.5],[0.5,-0.5,0.5],[-0.5,-0.5,0.5]] },
      { n: [1, 0, 0], verts: [[0.5,-0.5,0.5],[0.5,-0.5,-0.5],[0.5,0.5,-0.5],[0.5,0.5,0.5]] },
      { n: [-1,0, 0], verts: [[-0.5,-0.5,-0.5],[-0.5,-0.5,0.5],[-0.5,0.5,0.5],[-0.5,0.5,-0.5]] }
    ];
    for (const f of faces) {
      const base = this.pos.length / 3;
      const [nx, ny, nz] = rotateVec(f.n[0], f.n[1], f.n[2], rotX, rotY, rotZ);
      for (const v of f.verts) {
        const [px, py, pz] = rotateVec(v[0] * sx, v[1] * sy, v[2] * sz, rotX, rotY, rotZ);
        this.pushVert(cx + px, cy + py, cz + pz, nx, ny, nz, col);
      }
      this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }

  addTorusRing(cx, cy, cz, majorR, minorR, majorSegs, minorSegs, colorFnOrRgb, rotX = 0, rotY = 0, rotZ = 0, arcRad = Math.PI * 2) {
    const startIdx = this.pos.length / 3;
    const isFn = typeof colorFnOrRgb === 'function';
    for (let i = 0; i <= majorSegs; i++) {
      const u = i / majorSegs;
      const theta = u * arcRad;
      const cT = Math.cos(theta), sT = Math.sin(theta);
      for (let j = 0; j <= minorSegs; j++) {
        const v = j / minorSegs;
        const phi = v * Math.PI * 2;
        const cP = Math.cos(phi), sP = Math.sin(phi);
        const rr = majorR + minorR * cP;
        const lx = rr * cT;
        const ly = minorR * sP;
        const lz = rr * sT;
        const [px, py, pz] = rotateVec(lx, ly, lz, rotX, rotY, rotZ);
        const [nx, ny, nz] = rotateVec(cP * cT, sP, cP * sT, rotX, rotY, rotZ);
        const col = isFn ? colorFnOrRgb(u, v) : colorFnOrRgb;
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

  addCurvedPanel(cx, cy, cz, widthTop, widthBot, length, thickness, archDepth, segX, segY, colorFnOrRgb, rotX = 0, rotY = 0, rotZ = 0) {
    const isFn = typeof colorFnOrRgb === 'function';
    const halfT = thickness * 0.5;
    for (const side of [1, -1]) {
      const startIdx = this.pos.length / 3;
      for (let iy = 0; iy <= segY; iy++) {
        const t = iy / segY;
        const y = -t * length;
        const w = widthTop + (widthBot - widthTop) * t;
        const zWave = Math.sin(t * Math.PI * 1.1) * archDepth * 0.35;
        for (let ix = 0; ix <= segX; ix++) {
          const u = ix / segX;
          const xNorm = u * 2 - 1;
          const lx = xNorm * w * 0.5;
          const lz = archDepth * (1 - xNorm * xNorm) + zWave + side * halfT;
          const [px, py, pz] = rotateVec(lx, y, lz, rotX, rotY, rotZ);
          const [nx, ny, nz] = rotateVec(xNorm * 0.35 * side, 0.08 * side, side, rotX, rotY, rotZ);
          const col = isFn ? colorFnOrRgb(u, t, side) : colorFnOrRgb;
          this.pushVert(cx + px, cy + py, cz + pz, nx, ny, nz, col);
        }
      }
      const row = segX + 1;
      for (let iy = 0; iy < segY; iy++) {
        for (let ix = 0; ix < segX; ix++) {
          const a = startIdx + iy * row + ix;
          const b = a + row;
          if (side > 0) this.idx.push(a, b, a + 1, b, b + 1, a + 1);
          else this.idx.push(a, a + 1, b, b, a + 1, b + 1);
        }
      }
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

function buildHeadMesh() {
  const b = new HeroMeshBuilder();

  // Neck + rounded anime head + cute ears
  b.addLathe(0, -0.02, 0, [
    [0.0, 0.044],
    [0.05, 0.039],
    [0.10, 0.045]
  ], 8, HERO_C.skinShadow);

  b.addEllipsoid(0, 0.19, 0.0, 0.172, 0.178, 0.162, 10, 12, (u, v, lx, ly) => {
    return ly < -0.55 ? mixRgb(HERO_C.skinShadow, HERO_C.skin, 0.55) : HERO_C.skin;
  });

  // Left & right ears
  for (const s of [1, -1]) {
    b.addEllipsoid(s * 0.166, 0.175, -0.012, 0.028, 0.044, 0.026, 5, 6, HERO_C.skin, 0, 0, -s * 0.12);
  }

  // Expressive large anime eyes, rosy cheeks, tiny nose & joyful open smile on +Z front face
  for (const s of [1, -1]) {
    const ex = s * 0.068;
    const ey = 0.188;
    const ez = 0.136;
    const yawEye = s * 0.24;

    // White sclera oval
    b.addEllipsoid(ex, ey, ez, 0.042, 0.046, 0.018, 4, 6, HERO_C.eyeWhite, 0, yawEye, 0);
    // Warm chestnut iris with glowing golden-amber lower crescent
    b.addEllipsoid(ex, ey - 0.003, ez + 0.008, 0.030, 0.036, 0.014, 4, 6, (u, v, lx, ly) => {
      return ly < -0.25 ? HERO_C.irisGold : HERO_C.irisDark;
    }, 0, yawEye, 0);
    // Deep pupil
    b.addEllipsoid(ex, ey - 0.002, ez + 0.015, 0.015, 0.019, 0.010, 4, 5, HERO_C.hair, 0, yawEye, 0);
    // Dual crisp white catchlights
    b.addEllipsoid(ex - s * 0.011, ey + 0.014, ez + 0.019, 0.009, 0.010, 0.006, 3, 4, HERO_C.eyeWhite, 0, yawEye, 0);
    b.addEllipsoid(ex + s * 0.011, ey - 0.012, ez + 0.019, 0.005, 0.005, 0.005, 3, 4, HERO_C.eyeWhite, 0, yawEye, 0);
    // Curved dark upper eyelash & eyebrow
    b.addBox(ex, ey + 0.038, ez + 0.010, 0.072, 0.013, 0.016, 0.12, yawEye, -s * 0.16, HERO_C.hair);
    b.addBox(ex, ey + 0.064, ez + 0.002, 0.056, 0.009, 0.012, 0.05, yawEye, s * 0.14, HERO_C.hair);
    // Rosy cheek blush
    b.addEllipsoid(s * 0.102, 0.135, 0.122, 0.038, 0.022, 0.014, 4, 6, HERO_C.cheek, 0, s * 0.42, 0);
  }

  // Cute small nose bridge & bright open smiling mouth
  b.addEllipsoid(0, 0.156, 0.164, 0.011, 0.010, 0.010, 4, 5, HERO_C.skinShadow);
  b.addEllipsoid(0, 0.108, 0.148, 0.031, 0.022, 0.014, 4, 6, (u, v, lx, ly) => {
    return ly > 0.35 ? HERO_C.eyeWhite : (ly < -0.45 ? HERO_C.lip : HERO_C.mouthInside);
  }, 0.25, 0, 0);

  // Glossy ink-black hair cap, layered bangs & side locks framing face
  b.addEllipsoid(0, 0.228, -0.020, 0.184, 0.175, 0.180, 8, 12, (u, v, lx, ly) => {
    return (ly > 0.15 && ly < 0.48) ? mixRgb(HERO_C.hair, HERO_C.hairSheen, 0.55) : HERO_C.hair;
  });
  // Forehead fringe bang strands (7 sculpted curved locks)
  const bangAngles = [-0.62, -0.40, -0.20, 0.0, 0.20, 0.40, 0.62];
  for (let i = 0; i < bangAngles.length; i++) {
    const a = bangAngles[i];
    const len = (i === 3 ? 0.095 : 0.088 + (i % 2) * 0.012);
    const bx = Math.sin(a) * 0.165;
    const bz = Math.cos(a) * 0.158;
    b.addEllipsoid(bx, 0.268 - Math.abs(a) * 0.025, bz, 0.026, len, 0.022, 4, 5, HERO_C.hair, -0.18, a, -a * 0.15);
  }
  // Framing temple locks down cheeks
  for (const s of [1, -1]) {
    b.addEllipsoid(s * 0.154, 0.155, 0.068, 0.032, 0.115, 0.032, 5, 6, HERO_C.hair, -0.08, s * 0.28, s * 0.08);
  }

  // Twin prominent coiled hair buns on left & right temples + golden hair rings
  for (const s of [1, -1]) {
    const bx = s * 0.202, by = 0.270, bz = -0.022;
    b.addEllipsoid(bx, by, bz, 0.072, 0.082, 0.078, 6, 8, HERO_C.hair, 0, 0, -s * 0.25);
    b.addTorusRing(bx - s * 0.028, by, bz, 0.068, 0.015, 10, 4, HERO_C.goldBright, 0, 0, Math.PI * 0.5 - s * 0.25);
  }

  // Tilted woven Nón Lá anchored behind crown so face & buns frame cleanly
  const hatX = 0, hatY = 0.345, hatZ = -0.095;
  const hatRotX = -0.36;
  b.addLathe(hatX, hatY, hatZ, [
    [-0.105, 0.405],
    [-0.040, 0.255],
    [0.035, 0.125],
    [0.112, 0.006]
  ], 16, (t, u, rIdx) => {
    if (rIdx % 2 === 1) return HERO_C.strawBand;
    return mixRgb(HERO_C.strawLight, HERO_C.strawBand, 0.18 * Math.sin(u * Math.PI * 10));
  }, hatRotX, 0, 0, 0, 0, false);
  // Dark bamboo outer hat rim
  b.addTorusRing(hatX, hatY - 0.105 * Math.cos(hatRotX), hatZ - 0.105 * Math.sin(hatRotX), 0.405, 0.014, 16, 5, HERO_C.bambooRim, hatRotX, 0, 0);

  // Crimson silk hat ties, side bows & curved chin strap beneath chin
  for (const s of [1, -1]) {
    b.addEllipsoid(s * 0.225, 0.215, -0.005, 0.028, 0.028, 0.022, 4, 5, HERO_C.crimsonBright);
    b.addCurvedPanel(s * 0.232, 0.205, -0.002, 0.050, 0.072, 0.22, 0.010, 0.015, 2, 3, HERO_C.crimson, 0.18, s * 0.32, s * 0.24);
  }
  b.addTorusRing(0, 0.135, 0.032, 0.128, 0.009, 10, 4, HERO_C.crimson, 1.05, 0, 0, Math.PI);

  return b.finalize();
}

function buildBraidLinkMesh() {
  const b = new HeroMeshBuilder();
  b.addEllipsoid(-0.010, -0.032, 0, 0.026, 0.048, 0.024, 5, 6, HERO_C.hair, 0, 0, 0.28);
  b.addEllipsoid(0.010, -0.068, 0.003, 0.024, 0.046, 0.022, 5, 6, mixRgb(HERO_C.hair, HERO_C.hairSheen, 0.35), 0, 0, -0.28);
  return b.finalize();
}

function buildBraidTipMesh() {
  const b = new HeroMeshBuilder();
  // Gleaming golden bow knot + 2 loops + 2 tails + splayed brush hair tip
  b.addEllipsoid(0, 0, 0, 0.022, 0.020, 0.020, 5, 6, HERO_C.goldBright);
  for (const s of [1, -1]) {
    b.addEllipsoid(s * 0.036, 0.008, 0, 0.032, 0.018, 0.014, 5, 6, HERO_C.goldBright, 0, 0, s * 0.32);
    b.addBox(s * 0.022, -0.032, 0.004, 0.014, 0.056, 0.008, 0.1, 0, s * 0.38, HERO_C.gold);
  }
  b.addEllipsoid(0, -0.052, 0, 0.026, 0.058, 0.022, 5, 6, HERO_C.hair);
  return b.finalize();
}

function buildTorsoMesh() {
  const b = new HeroMeshBuilder();

  // Cream Vietnamese Áo Giao Lĩnh tunic torso + crimson mandarin collar + diagonal gold lapel + crimson waist sash
  b.addLathe(0, 0, 0, [
    [-0.055, 0.118],
    [0.015, 0.130],
    [0.042, 0.138],
    [0.072, 0.132],
    [0.14, 0.124],
    [0.24, 0.138],
    [0.32, 0.135],
    [0.365, 0.088],
    [0.378, 0.070],
    [0.422, 0.072],
    [0.430, 0.066]
  ], 16, (t, u, rIdx, rad0, y0, phi) => {
    const frontness = Math.cos(phi);
    const sideX = Math.sin(phi);
    if (y0 >= 0.372) {
      return y0 >= 0.415 ? HERO_C.goldBright : HERO_C.crimson;
    }
    if (y0 <= 0.092) {
      if (y0 < 0.0) return HERO_C.tunicShade;
      return y0 <= 0.018 || y0 >= 0.075 ? HERO_C.crimsonDark : HERO_C.crimsonBright;
    }
    if (frontness > 0.1) {
      const diagTargetY = 0.25 + sideX * 0.105;
      const dist = Math.abs(y0 - diagTargetY);
      if (dist < 0.028) return HERO_C.goldBright;
      if (dist < 0.036) return HERO_C.crimson;
    }
    return frontness < -0.2 ? HERO_C.tunicShade : HERO_C.tunic;
  });

  // Shoulder caps rounding seamlessly to arm joints
  for (const s of [1, -1]) {
    b.addEllipsoid(s * 0.125, 0.315, 0, 0.062, 0.056, 0.056, 6, 8, HERO_C.tunic);
  }

  // Crimson sash knot & gold lapel clasp button on left waist/chest
  b.addEllipsoid(0.115, 0.040, 0.085, 0.044, 0.038, 0.038, 6, 8, HERO_C.crimsonBright);
  b.addEllipsoid(-0.075, 0.220, 0.135, 0.014, 0.014, 0.012, 5, 6, HERO_C.goldBright);

  return b.finalize();
}

const SKIRT_META = {
  panels: 2,
  segX: 10,
  segY: 6,
  cols: 11,
  rows: 7,
  pinY: 0.038,
  pinR: 0.124,
  topHalfAng: 1.50,
  botHalfAng: [1.30, 1.38],
  centerPhi: [0.0, Math.PI],
  halfThickness: 0.0055
};

function computeSkirtClothPose(posOut, normOut, gridPos, timeSec, moveRatio, localWindX, localWindZ, relHipL, relHipR, reducedMotion) {
  const { panels, segX, segY, cols, rows, pinY, pinR, topHalfAng, botHalfAng, centerPhi, halfThickness } = SKIRT_META;
  const vertsPerSheet = rows * cols;
  const vertsPerPanel = vertsPerSheet * 2;

  const wMag = Math.hypot(localWindX, localWindZ);
  const wGain = Math.tanh(wMag * 0.70) * 0.78;
  const windX = wMag > 1e-4 ? (localWindX / wMag) * wGain : 0;
  const windZ = wMag > 1e-4 ? (localWindZ / wMag) * wGain : 0;
  const waveFreq = 3.8 + moveRatio * 5.0 + Math.min(2.5, wMag * 1.8);
  const waveMagBase = reducedMotion ? 0 : (0.042 + 0.125 * moveRatio + 0.105 * Math.min(1.5, wMag));

  // Precompute both thigh capsule endpoints in skirt space (+X left leg, -X right leg)
  const leg0X = 0.088;
  const leg0Dy = -0.30 * Math.cos(relHipL);
  const leg0Dz = -0.30 * Math.sin(relHipL);
  const leg1X = -0.088;
  const leg1Dy = -0.30 * Math.cos(relHipR);
  const leg1Dz = -0.30 * Math.sin(relHipR);

  for (let p = 0; p < panels; p++) {
    const pCenter = centerPhi[p];
    const botHA = botHalfAng[p];
    const pGridBase = p * vertsPerSheet * 3;
    const pOutBase = p * vertsPerPanel;

    // 1. Arc-preserving downward column solve + analytical thigh-capsule collision
    for (let ix = 0; ix <= segX; ix++) {
      const u = ix / segX;
      const sNorm = u * 2 - 1;
      const phi0 = pCenter + sNorm * topHalfAng;
      const phi1 = pCenter + sNorm * botHA;
      const panelLen = 0.39 - 0.036 * sNorm * sNorm;
      const segLen = panelLen / segY;
      const pleatCos = Math.cos(sNorm * Math.PI * 3.0);

      let px = pinR * Math.sin(phi0);
      let py = pinY;
      let pz = pinR * Math.cos(phi0);
      const r0Idx = pGridBase + ix * 3;
      gridPos[r0Idx] = px;
      gridPos[r0Idx + 1] = py;
      gridPos[r0Idx + 2] = pz;

      for (let iy = 1; iy <= segY; iy++) {
        const t = iy / segY;
        const phi = phi0 + (phi1 - phi0) * t;
        const rx = Math.sin(phi);
        const rz = Math.cos(phi);
        const tx = rz;
        const tz = -rx;

        // Smooth A-line flare over hips easing toward vertical gravity near hem
        const outTilt = 0.42 - 0.18 * t + pleatCos * 0.032 * t + moveRatio * 0.10 * t;
        const radialPush = Math.sin(outTilt);
        const wWeight = t * t * 0.85 + t * 0.25;

        let waveRad = 0;
        let waveTan = 0;
        if (waveMagBase > 0) {
          const waveAmp = waveMagBase * (0.35 + 0.65 * t) * t;
          const wavePh = timeSec * waveFreq - t * 3.9 + sNorm * 2.2 + p * 1.9;
          waveRad = Math.sin(wavePh) * waveAmp;
          waveTan = Math.cos(wavePh * 0.82 + 0.7) * waveAmp * 0.40;
        }

        let vx = rx * (radialPush + waveRad) + tx * waveTan + windX * wWeight;
        let vz = rz * (radialPush + waveRad) + tz * waveTan + windZ * wWeight;
        const windSpeedDrag = Math.hypot(windX, windZ) * wWeight;
        let vy = -Math.cos(outTilt) - Math.min(0.18, windSpeedDrag * 0.15);
        if (vy > -0.44) vy = -0.44;
        const vLen = Math.hypot(vx, vy, vz) || 1;
        vx /= vLen; vy /= vLen; vz /= vLen;

        let nx = px + vx * segLen;
        let ny = py + vy * segLen;
        let nz = pz + vz * segLen;

        // Resolve thigh-capsule push-out for Left & Right legs so skirt never clips legs or pants
        for (let leg = 0; leg < 2; leg++) {
          const lx = leg === 0 ? leg0X : leg1X;
          const lDy = leg === 0 ? leg0Dy : leg1Dy;
          const lDz = leg === 0 ? leg0Dz : leg1Dz;
          const uSeg = Math.max(0, Math.min(1, (ny * lDy + nz * lDz) / 0.09));
          const qy = lDy * uSeg;
          const qz = lDz * uSeg;
          let ex = nx - lx;
          let ey = ny - qy;
          let ez = nz - qz;
          const d = Math.hypot(ex, ey, ez);
          const clearR = 0.124 - 0.020 * uSeg;
          if (d < clearR) {
            if (d < 1e-4) {
              ex = rx; ey = 0; ez = rz;
            } else {
              ex /= d; ey /= d; ez /= d;
            }
            nx = lx + ex * clearR;
            ny = Math.min(ny, qy + ey * clearR);
            nz = qz + ez * clearR;
          }
        }

        // Preserve segment arc-length after push-out (prevent vertical rubber stretching)
        const sdx = nx - px, sdy = ny - py, sdz = nz - pz;
        const sd = Math.hypot(sdx, sdy, sdz) || 1;
        nx = px + (sdx / sd) * segLen;
        ny = py + (sdy / sd) * segLen;
        nz = pz + (sdz / sd) * segLen;

        // Final thigh clearance clamp after length normalization
        for (let leg = 0; leg < 2; leg++) {
          const lx = leg === 0 ? leg0X : leg1X;
          const lDy = leg === 0 ? leg0Dy : leg1Dy;
          const lDz = leg === 0 ? leg0Dz : leg1Dz;
          const uSeg = Math.max(0, Math.min(1, (ny * lDy + nz * lDz) / 0.09));
          const qy = lDy * uSeg;
          const qz = lDz * uSeg;
          const ex = nx - lx, ey = ny - qy, ez = nz - qz;
          const d = Math.hypot(ex, ey, ez);
          const clearR = 0.120 - 0.020 * uSeg;
          if (d < clearR && d > 1e-4) {
            nx = lx + (ex / d) * clearR;
            nz = qz + (ez / d) * clearR;
          }
        }

        px = nx; py = ny; pz = nz;
        const gIdx = pGridBase + (iy * cols + ix) * 3;
        gridPos[gIdx] = px;
        gridPos[gIdx + 1] = py;
        gridPos[gIdx + 2] = pz;
      }
    }

    // 2. Smooth central-difference normals (N = dV x dU) & pinched double-sided sheet emission
    for (let iy = 0; iy <= segY; iy++) {
      const iy0 = Math.max(0, iy - 1);
      const iy1 = Math.min(segY, iy + 1);
      for (let ix = 0; ix <= segX; ix++) {
        const ix0 = Math.max(0, ix - 1);
        const ix1 = Math.min(segX, ix + 1);

        const cIdx = pGridBase + (iy * cols + ix) * 3;
        const cx = gridPos[cIdx], cy = gridPos[cIdx + 1], cz = gridPos[cIdx + 2];

        const lIdx = pGridBase + (iy * cols + ix0) * 3;
        const rIdx = pGridBase + (iy * cols + ix1) * 3;
        const uIdx = pGridBase + (iy0 * cols + ix) * 3;
        const dIdx = pGridBase + (iy1 * cols + ix) * 3;

        const dux = gridPos[rIdx] - gridPos[lIdx];
        const duy = gridPos[rIdx + 1] - gridPos[lIdx + 1];
        const duz = gridPos[rIdx + 2] - gridPos[lIdx + 2];

        const dvx = gridPos[dIdx] - gridPos[uIdx];
        const dvy = gridPos[dIdx + 1] - gridPos[uIdx + 1];
        const dvz = gridPos[dIdx + 2] - gridPos[uIdx + 2];

        let nx = dvy * duz - dvz * duy;
        let ny = dvz * dux - dvx * duz;
        let nz = dvx * duy - dvy * dux;
        const nLen = Math.hypot(nx, ny, nz) || 1;
        nx /= nLen; ny /= nLen; nz /= nLen;

        const pinch = (ix === 0 || ix === segX || iy === segY) ? 0.0 : (iy === 0 ? 0.35 : 1.0);
        const off = halfThickness * pinch;

        const localV = iy * cols + ix;
        const outV = (pOutBase + localV) * 3;
        const inV = (pOutBase + vertsPerSheet + localV) * 3;

        posOut[outV] = cx + nx * off;
        posOut[outV + 1] = cy + ny * off;
        posOut[outV + 2] = cz + nz * off;
        normOut[outV] = nx;
        normOut[outV + 1] = ny;
        normOut[outV + 2] = nz;

        posOut[inV] = cx - nx * off;
        posOut[inV + 1] = cy - ny * off;
        posOut[inV + 2] = cz - nz * off;
        normOut[inV] = -nx;
        normOut[inV + 1] = -ny;
        normOut[inV + 2] = -nz;
      }
    }
  }
}

function buildSkirtClothMesh() {
  const { panels, segX, segY, cols, rows } = SKIRT_META;
  const vertsPerSheet = rows * cols;
  const vertsPerPanel = vertsPerSheet * 2;
  const totalVerts = panels * vertsPerPanel;

  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const colors = new Float32Array(totalVerts * 3);
  const indices = [];

  for (let p = 0; p < panels; p++) {
    const pOutBase = p * vertsPerPanel;
    for (let sideIdx = 0; sideIdx < 2; sideIdx++) {
      const side = sideIdx === 0 ? 1 : -1;
      const startIdx = pOutBase + sideIdx * vertsPerSheet;
      for (let iy = 0; iy < rows; iy++) {
        const t = iy / segY;
        for (let ix = 0; ix < cols; ix++) {
          const u = ix / segX;
          let col;
          if (side > 0) {
            if (t > 0.83) {
              col = (iy === segY) ? HERO_C.gold : HERO_C.goldBright;
            } else if (t > 0.72) {
              col = HERO_C.crimson;
            } else if (u < 0.08 || u > 0.92) {
              col = HERO_C.gold;
            } else {
              col = mixRgb(HERO_C.tunic, HERO_C.tunicShade, t * 0.22);
            }
          } else {
            col = t > 0.83 ? HERO_C.gold : HERO_C.tunicShade;
          }
          const cBase = (startIdx + iy * cols + ix) * 3;
          colors[cBase] = col[0];
          colors[cBase + 1] = col[1];
          colors[cBase + 2] = col[2];
        }
      }

      for (let iy = 0; iy < segY; iy++) {
        for (let ix = 0; ix < segX; ix++) {
          const a = startIdx + iy * cols + ix;
          const b = a + cols;
          if (side > 0) indices.push(a, b, a + 1, b, b + 1, a + 1);
          else indices.push(a, a + 1, b, b, a + 1, b + 1);
        }
      }
    }
  }

  const gridPos = new Float32Array(panels * vertsPerSheet * 3);
  computeSkirtClothPose(positions, normals, gridPos, 0, 0, 0, 0, 0, 0, true);

  return {
    positions,
    normals,
    colors,
    indices: new Uint16Array(indices),
    count: indices.length
  };
}

function buildRibbonSegMesh() {
  const b = new HeroMeshBuilder();
  b.addCurvedPanel(0, 0, 0, 0.072, 0.084, 0.28, 0.010, 0.018, 2, 3, (u, t) => {
    if (u < 0.14 || u > 0.86) return HERO_C.crimsonDark;
    return mixRgb(HERO_C.crimson, HERO_C.crimsonBright, t * 0.65);
  });
  return b.finalize();
}

function buildJadeAmuletMesh() {
  const b = new HeroMeshBuilder();
  // Hanging crimson silk cord
  b.addBox(0, -0.028, 0, 0.014, 0.058, 0.014, 0, 0, 0, HERO_C.crimson);
  // Gold filigree top bead + outer oval bezel + glowing faceted emerald gem
  b.addEllipsoid(0, -0.062, 0, 0.018, 0.018, 0.018, 4, 5, HERO_C.goldBright);
  b.addTorusRing(0, -0.118, 0, 0.046, 0.011, 10, 4, HERO_C.goldBright, Math.PI * 0.5, 0, 0);
  b.addEllipsoid(0, -0.118, 0, 0.042, 0.052, 0.024, 6, 8, (u, v, lx, ly) => {
    return (lx * lx + ly * ly < 0.32) ? HERO_C.jadeCore : HERO_C.jadeOuter;
  });
  // Lower crimson pendant tassel
  b.addBox(0, -0.188, 0, 0.016, 0.048, 0.016, 0, 0, 0, HERO_C.crimsonBright);
  return b.finalize();
}

function buildThighMesh() {
  const b = new HeroMeshBuilder();
  // Baggy navy-indigo lantern pants tapering into knee cuff
  b.addLathe(0, -0.24, 0, [
    [0.00, 0.060],
    [0.03, 0.072],
    [0.09, 0.098],
    [0.16, 0.096],
    [0.24, 0.082]
  ], 10, (t) => (t < 0.18 ? HERO_C.pantsShade : HERO_C.pants));
  return b.finalize();
}

function buildShinWrapMesh() {
  const b = new HeroMeshBuilder();
  // Exposed calf skin at top + crisscross wrapped cloth gaiters
  b.addLathe(0, -0.235, 0, [
    [0.00, 0.038],
    [0.04, 0.044],
    [0.09, 0.049],
    [0.15, 0.052],
    [0.19, 0.051],
    [0.21, 0.044],
    [0.24, 0.046]
  ], 10, (t, u, rIdx, r, y, phi) => {
    if (y >= 0.195) return HERO_C.skin;
    const bandA = Math.sin(y * 95 + phi * 2.0);
    const bandB = Math.sin(y * 95 - phi * 2.0);
    return (bandA > 0.72 || bandB > 0.72) ? HERO_C.wrapEdge : HERO_C.wrapLight;
  });
  return b.finalize();
}

function buildFootSandalMesh() {
  const b = new HeroMeshBuilder();
  // Bare rounded foot + toes on +Z front
  b.addEllipsoid(0, -0.008, 0.036, 0.046, 0.028, 0.082, 6, 8, HERO_C.skin);
  // Crimson V-strap across forefoot
  b.addBox(0.022, 0.008, 0.054, 0.016, 0.014, 0.072, 0.25, -0.38, 0, HERO_C.crimsonBright);
  b.addBox(-0.022, 0.008, 0.054, 0.016, 0.014, 0.072, 0.25, 0.38, 0, HERO_C.crimsonBright);
  // Traditional wooden Guốc Mộc footbed + TWO wooden cleats underneath
  b.addBox(0, -0.028, 0.036, 0.104, 0.024, 0.195, 0, 0, 0, HERO_C.sandalWood);
  b.addBox(0, -0.052, -0.024, 0.094, 0.030, 0.028, 0, 0, 0, HERO_C.sandalCleat);
  b.addBox(0, -0.052, 0.086, 0.094, 0.030, 0.028, 0, 0, 0, HERO_C.sandalCleat);
  return b.finalize();
}

function buildUpperSleeveMesh() {
  const b = new HeroMeshBuilder();
  // Bell-shaped cream sleeve flaring toward elbow
  b.addLathe(0, -0.18, 0, [
    [0.00, 0.098],
    [0.05, 0.088],
    [0.12, 0.074],
    [0.18, 0.068]
  ], 10, (t) => (t > 0.85 ? HERO_C.tunicShade : HERO_C.tunic));
  return b.finalize();
}

function buildForearmHandMesh() {
  const b = new HeroMeshBuilder();
  // Wide flared gold-cuffed sleeve cuff + protruding wrist & hand
  b.addLathe(0, -0.175, 0, [
    [0.035, 0.130],
    [0.065, 0.125],
    [0.110, 0.112],
    [0.175, 0.096]
  ], 12, (t, u, rIdx, r, y) => {
    if (y <= 0.070) return y <= 0.044 ? HERO_C.crimson : HERO_C.goldBright;
    return HERO_C.tunic;
  });
  // Wrist & expressive hand
  b.addEllipsoid(0, -0.165, 0, 0.034, 0.042, 0.030, 6, 6, HERO_C.skin);
  b.addEllipsoid(0, -0.205, 0.006, 0.042, 0.044, 0.034, 6, 8, HERO_C.skin);
  return b.finalize();
}

function buildBambooPoleMesh() {
  const b = new HeroMeshBuilder();
  // Slender bamboo pole along +Z axis
  b.addLathe(0, 0, -0.08, [
    [0.00, 0.018],
    [0.21, 0.016],
    [0.22, 0.022],
    [0.23, 0.016],
    [0.44, 0.015],
    [0.45, 0.020],
    [0.46, 0.015],
    [0.67, 0.014],
    [0.68, 0.019],
    [0.69, 0.013],
    [0.86, 0.011]
  ], 8, (t, u, rIdx) => {
    return (rIdx === 2 || rIdx === 5 || rIdx === 8) ? HERO_C.bambooNode : HERO_C.bambooPole;
  }, Math.PI * 0.5, 0, 0);
  return b.finalize();
}

function buildRibbedLanternMesh() {
  const b = new HeroMeshBuilder();
  // Suspension cord & curved dark wire bail handle from origin (y=0) down to lantern crown
  b.addBox(0, -0.055, 0, 0.012, 0.11, 0.012, 0, 0, 0, HERO_C.wireDark);
  b.addTorusRing(0, -0.125, 0, 0.055, 0.007, 8, 4, HERO_C.wireDark, Math.PI * 0.5, 0, 0, Math.PI);

  // Carved golden lotus crown cap & bottom base cap
  b.addLathe(0, -0.155, 0, [
    [0.00, 0.084],
    [0.022, 0.068],
    [0.040, 0.032]
  ], 10, HERO_C.goldBright);
  b.addLathe(0, -0.525, 0, [
    [-0.035, 0.035],
    [-0.018, 0.068],
    [0.00, 0.082]
  ], 10, HERO_C.goldBright);

  // 8-lobed fluted silk Hội An lantern body centered around y = -0.34
  b.addLathe(0, -0.34, 0, [
    [-0.190, 0.072],
    [-0.155, 0.112],
    [-0.085, 0.156],
    [0.000, 0.174],
    [0.085, 0.156],
    [0.155, 0.112],
    [0.190, 0.072]
  ], 16, (t, u, rIdx, rad0, y0, phi) => {
    if (rIdx === 0 || rIdx === 6) return HERO_C.goldBright;
    const rib = Math.cos(phi * 8);
    if (rib > 0.84) return HERO_C.crimsonDark;
    const vGlow = Math.exp(-y0 * y0 * 65);
    const ribCol = mixRgb(HERO_C.lanternRib, HERO_C.lanternGlow, 0.55 + 0.45 * (-rib));
    return mixRgb(ribCol, HERO_C.lanternCore, vGlow * (0.52 + 0.44 * (1 - Math.max(0, rib))));
  }, 0, 0, 0, 0.095, 8);

  return b.finalize();
}

function buildTasselMesh() {
  const b = new HeroMeshBuilder();
  // Gold bead + crimson bell cap + 5 swaying silk strands
  b.addEllipsoid(0, -0.012, 0, 0.022, 0.020, 0.022, 5, 6, HERO_C.goldBright);
  b.addLathe(0, -0.058, 0, [
    [0.00, 0.032],
    [0.022, 0.024],
    [0.044, 0.016]
  ], 8, HERO_C.crimson);
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5;
    b.addBox(Math.cos(a) * 0.018, -0.145, Math.sin(a) * 0.018, 0.014, 0.175, 0.014, Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12, HERO_C.crimsonBright);
  }
  return b.finalize();
}

export function buildHeroModelData() {
  return {
    head: buildHeadMesh(),
    braidLink: buildBraidLinkMesh(),
    braidTip: buildBraidTipMesh(),
    torso: buildTorsoMesh(),
    skirtCloth: buildSkirtClothMesh(),
    ribbonSeg: buildRibbonSegMesh(),
    jadeAmulet: buildJadeAmuletMesh(),
    thigh: buildThighMesh(),
    shinWrap: buildShinWrapMesh(),
    footSandal: buildFootSandalMesh(),
    upperSleeve: buildUpperSleeveMesh(),
    forearmHand: buildForearmHandMesh(),
    bambooPole: buildBambooPoleMesh(),
    ribbedLantern: buildRibbedLanternMesh(),
    tassel: buildTasselMesh()
  };
}

function uploadSubMesh(gl, data, dynamicPosNorm = false) {
  const usage = dynamicPosNorm ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW;
  const posBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, data.positions, usage);

  const normBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, normBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, data.normals, usage);

  const colBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, colBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, data.colors, gl.STATIC_DRAW);

  const idxBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.indices, gl.STATIC_DRAW);

  if (dynamicPosNorm) {
    const vertsPerSheet = SKIRT_META.rows * SKIRT_META.cols;
    return {
      posBuffer,
      normBuffer,
      colBuffer,
      idxBuffer,
      count: data.count,
      posWork: new Float32Array(data.positions.length),
      normWork: new Float32Array(data.normals.length),
      gridPos: new Float32Array(SKIRT_META.panels * vertsPerSheet * 3)
    };
  }
  return { posBuffer, normBuffer, colBuffer, idxBuffer, count: data.count };
}

export function uploadHeroModel(gl) {
  const raw = buildHeroModelData();
  const gpu = {};
  for (const key of Object.keys(raw)) {
    gpu[key] = uploadSubMesh(gl, raw[key], key === 'skirtCloth');
  }
  return gpu;
}

function updateSkirtClothMesh(gl, skirt, timeSec, moveRatio, localWindX, localWindZ, relHipL, relHipR, reducedMotion) {
  computeSkirtClothPose(
    skirt.posWork,
    skirt.normWork,
    skirt.gridPos,
    timeSec,
    moveRatio,
    localWindX,
    localWindZ,
    relHipL,
    relHipR,
    reducedMotion
  );
  gl.bindBuffer(gl.ARRAY_BUFFER, skirt.posBuffer);
  gl.bufferSubData(gl.ARRAY_BUFFER, 0, skirt.posWork);
  gl.bindBuffer(gl.ARRAY_BUFFER, skirt.normBuffer);
  gl.bufferSubData(gl.ARRAY_BUFFER, 0, skirt.normWork);
}

const WAIST_RIBBON_SPECS = [
  { x: 0.122, y: 0.032, z: 0.068, ry: 1.05, lift: 0.92, ph: 0.2 },
  { x: 0.112, y: 0.016, z: -0.045, ry: 2.15, lift: 1.08, ph: 1.4 },
  { x: -0.122, y: 0.032, z: 0.042, ry: -1.18, lift: 0.96, ph: 2.6 },
  { x: -0.108, y: 0.016, z: -0.055, ry: -2.28, lift: 1.12, ph: 3.9 }
];

export function renderHeroModel(renderer, engine, timeSec, carryFrac, reducedMotion, benchmarkMode, frameLights, activeDt = 1 / 60, renderPlayerPos = null) {
  const hm = renderer.heroModel;
  if (!hm) return null;

  const pPos = renderPlayerPos || engine.player.pos;
  const px = pPos[0], py = pPos[1], pz = pPos[2];
  const targetYaw = Math.atan2(engine.player.facing[0], engine.player.facing[1]);
  const rawSpeed = Math.hypot(engine.player.vel[0], engine.player.vel[2]);

  if (!renderer.mayVisualYawInit) {
    renderer.mayVisualYaw = targetYaw;
    renderer.mayVisualYawInit = true;
    renderer.mayVisualSpeed = rawSpeed;
    renderer.mayBankRoll = 0;
    renderer.mayDashBlend = 0;
    renderer.mayWindWorldX = 0;
    renderer.mayWindWorldZ = 0;
  } else if (activeDt > 0) {
    let diff = targetYaw - renderer.mayVisualYaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const yawLerp = Math.min(1, 1 - Math.exp(-16 * activeDt));
    renderer.mayVisualYaw += diff * yawLerp;
    const targetBank = reducedMotion ? 0 : Math.max(-0.18, Math.min(0.18, diff * 0.32 * Math.min(1, rawSpeed / 3.0)));
    const spdLerp = Math.min(1, 1 - Math.exp(-12 * activeDt));
    renderer.mayBankRoll += (targetBank - renderer.mayBankRoll) * spdLerp;
    renderer.mayVisualSpeed += (rawSpeed - renderer.mayVisualSpeed) * spdLerp;
    const targetDash = engine.player.dashTicks > 0 ? 1.0 : 0.0;
    const dashLerp = Math.min(1, 1 - Math.exp(-18 * activeDt));
    renderer.mayDashBlend = (renderer.mayDashBlend || 0) + (targetDash - (renderer.mayDashBlend || 0)) * dashLerp;

    // World wind vector (ambient island breeze + Night 3 wind gusts + relative motion air drag)
    let wwx = 0.22 * Math.cos(timeSec * 0.9);
    let wwz = 0.22 * Math.sin(timeSec * 0.7);
    if (engine.night === 3 && (engine.wind.active || engine.wind.warning)) {
      const wr = (engine.wind.dir_deg * Math.PI) / 180;
      const wStr = engine.wind.active ? 1.35 : 0.62;
      const gust = 0.82 + 0.28 * Math.sin(timeSec * 4.8);
      wwx += Math.cos(wr) * wStr * gust;
      wwz += Math.sin(wr) * wStr * gust;
    }
    wwx -= engine.player.vel[0] * 0.085;
    wwz -= engine.player.vel[2] * 0.085;
    const wLerp = Math.min(1, 1 - Math.exp(-10 * activeDt));
    renderer.mayWindWorldX = (renderer.mayWindWorldX || 0) + (wwx - (renderer.mayWindWorldX || 0)) * wLerp;
    renderer.mayWindWorldZ = (renderer.mayWindWorldZ || 0) + (wwz - (renderer.mayWindWorldZ || 0)) * wLerp;
  }

  const yaw = renderer.mayVisualYaw;
  const speed = renderer.mayVisualSpeed;
  const isAir = !engine.player.grounded;
  const dashBlend = renderer.mayDashBlend || 0;
  const moveRatio = Math.min(1.0, speed / 6.2);
  const phase = renderer.mayStridePhase;

  // Convert world wind into Mây's local frame (+Z is Mây forward, +X is Mây left)
  const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
  const wxWorld = renderer.mayWindWorldX || 0;
  const wzWorld = renderer.mayWindWorldZ || 0;
  const localWindX = cosY * wxWorld - sinY * wzWorld;
  const localWindZ = sinY * wxWorld + cosY * wzWorld;

  // 1. Dynamic run bounce, breathing & smooth dash lean
  const walkBob = isAir ? 0 : moveRatio * Math.abs(Math.sin(phase)) * 0.068 * (1 - dashBlend * 0.5);
  const breathe = (1 - moveRatio) * Math.sin(timeSec * 2.6) * 0.014;
  const baseLeanX = isAir ? (engine.player.vel[1] > 0 ? 0.14 : -0.08) : moveRatio * 0.18;
  const torsoLeanX = baseLeanX * (1 - dashBlend) + 0.44 * dashBlend;
  const torsoTwistY = isAir ? 0 : -Math.sin(phase) * 0.12 * moveRatio * (1 - dashBlend * 0.5);
  const pelvisRollZ = (isAir ? 0 : Math.sin(phase) * 0.04 * moveRatio) + renderer.mayBankRoll;

  renderer.jRoot.setTranslate(px, py + walkBob + breathe, pz).mulRotateY(yaw);
  renderer.jPelvis.copy(renderer.jRoot).mulTranslate(0, 0.54, 0).mulRotateZ(pelvisRollZ);

  renderer.beginColoredModelPass(frameLights.count, frameLights.playerGlow, frameLights.pulseStrength, frameLights.ambientIntensity);

  // 2. Articulated Baggy Pants, Shin Wraps & Two-Cleat Wooden Guốc Mộc Sandals
  let legHipL = 0, legHipR = 0;
  for (let i = 0; i < 2; i++) {
    const sideSign = i === 0 ? 1 : -1;
    const legOffset = i === 0 ? 0 : Math.PI;
    const strideSin = Math.sin(phase + legOffset);
    const strideCos = Math.cos(phase + legOffset);

    const runHip = isAir
      ? (sideSign > 0 ? -0.45 : 0.36)
      : -strideSin * 0.74 * moveRatio;
    const dashHip = sideSign > 0 ? -0.58 : 0.68;
    const hipAngleX = runHip * (1 - dashBlend) + dashHip * dashBlend;
    if (sideSign > 0) legHipL = hipAngleX;
    else legHipR = hipAngleX;

    const runKnee = isAir
      ? (sideSign > 0 ? 0.88 : 0.65)
      : Math.max(0.06, -strideCos * 0.94 * moveRatio + 0.08);
    const dashKnee = sideSign > 0 ? 0.78 : 0.36;
    const kneeAngleX = runKnee * (1 - dashBlend) + dashKnee * dashBlend;

    renderer.jHip.copy(renderer.jPelvis).mulTranslate(sideSign * 0.088, 0, 0).mulRotateX(hipAngleX);
    renderer.drawColoredModel(hm.thigh, renderer.jHip, 0.0);

    renderer.jKnee.copy(renderer.jHip).mulTranslate(0, -0.235, 0).mulRotateX(kneeAngleX);
    renderer.drawColoredModel(hm.shinWrap, renderer.jKnee, 0.0);

    const footTilt = isAir ? 0.25 : -0.16 * hipAngleX;
    renderer.jFoot.copy(renderer.jKnee).mulTranslate(0, -0.235, 0).mulRotateX(footTilt);
    renderer.drawColoredModel(hm.footSandal, renderer.jFoot, 0.0);
  }

  // 3. Torso, Multi-Segmented Wind-Swaying Skirt Panels, Jade Amulet & 4 Long Flowing Silk Ribbons
  renderer.jTorso.copy(renderer.jPelvis).mulRotateX(torsoLeanX).mulRotateY(torsoTwistY);
  renderer.drawColoredModel(hm.torso, renderer.jTorso, 0.0);

  if (!benchmarkMode) {
    // Seamless 2-panel Áo Giao Lĩnh cloth skirt with thigh clearance & directional wind sway
    const skirtLeanX = torsoLeanX * 0.25;
    renderer.jChain
      .copy(renderer.jPelvis)
      .mulRotateY(torsoTwistY * 0.65)
      .mulRotateX(skirtLeanX);
    if (renderer.gl && hm.skirtCloth && hm.skirtCloth.posWork) {
      updateSkirtClothMesh(
        renderer.gl,
        hm.skirtCloth,
        timeSec,
        moveRatio,
        localWindX,
        localWindZ * Math.cos(skirtLeanX),
        legHipL - skirtLeanX,
        legHipR - skirtLeanX,
        reducedMotion
      );
      renderer.lastBoundMesh = null;
    }
    renderer.drawColoredModel(hm.skirtCloth, renderer.jChain, 0.0);

    // Luminous Emerald Ngọc Bội amulet hanging from left waist sash (+X)
    const jadeSwing = reducedMotion ? 0 : Math.sin(timeSec * 3.8 + phase * 0.5) * (0.08 + 0.16 * moveRatio) + localWindX * 0.22;
    renderer.jFlap
      .copy(renderer.jTorso)
      .mulTranslate(0.132, -0.005, 0.088)
      .mulRotateY(0.65)
      .mulRotateZ(jadeSwing)
      .mulRotateX(-0.18 - moveRatio * 0.20 - Math.max(0, localWindZ) * 0.18);
    renderer.drawColoredModel(hm.jadeAmulet, renderer.jFlap, 0.90);
    renderer.jFlap.mulTranslate(0, -0.118, 0).getTranslation(renderer.mayJadePos);

    // 4 sweeping crimson silk waist ribbons (billowing with wind + stride)
    const windMag = Math.hypot(localWindX, localWindZ);
    for (let r = 0; r < WAIST_RIBBON_SPECS.length; r++) {
      const rb = WAIST_RIBBON_SPECS[r];
      const rWindOut = localWindX * Math.sin(rb.ry) + localWindZ * Math.cos(rb.ry);
      renderer.jChain
        .copy(renderer.jTorso)
        .mulTranslate(rb.x, rb.y, rb.z)
        .mulRotateY(rb.ry)
        .mulRotateX(-(rb.lift + moveRatio * 0.34 + Math.max(-0.2, rWindOut * 0.32)));
      for (let s = 0; s < 3; s++) {
        const wave = reducedMotion
          ? 0
          : Math.sin(timeSec * (3.8 + moveRatio * 5.2) - s * 0.95 + rb.ph) * (0.16 + 0.24 * moveRatio + windMag * 0.14);
        const yawWave = reducedMotion
          ? 0
          : Math.cos(timeSec * 3.1 - s * 0.75 + rb.ph) * (0.09 + 0.14 * moveRatio);
        renderer.jChain.mulRotateX(wave).mulRotateY(yawWave);
        renderer.drawColoredModel(hm.ribbonSeg, renderer.jChain, 0.0);
        renderer.jChain.mulTranslate(0, -0.27, 0);
      }
    }
  }

  // 4. Sculpted Head, Anime Face, Twin Buns, Tilted Nón Lá & Twin Swinging Braids
  renderer.jHead.copy(renderer.jTorso).mulTranslate(0, 0.398, 0.005).mulRotateX(-torsoLeanX * 0.45);
  renderer.drawColoredModel(hm.head, renderer.jHead, 0.0);

  if (!benchmarkMode) {
    for (const sideSign of [1, -1]) {
      const phOff = sideSign > 0 ? 0.0 : 1.1;
      renderer.jChain
        .copy(renderer.jHead)
        .mulTranslate(sideSign * 0.178, 0.210, -0.055)
        .mulRotateX(0.32 + moveRatio * 0.46)
        .mulRotateZ(sideSign * (0.28 + moveRatio * 0.12));
      for (let l = 0; l < 4; l++) {
        const swayZ = reducedMotion ? 0 : sideSign * Math.sin(timeSec * 4.2 - l * 0.65 + phOff) * (0.07 + 0.09 * moveRatio);
        const swayX = reducedMotion ? 0 : Math.cos(timeSec * 3.5 - l * 0.6 + phOff) * (0.05 + 0.08 * moveRatio);
        renderer.jChain.mulRotateZ(swayZ).mulRotateX(swayX);
        renderer.drawColoredModel(hm.braidLink, renderer.jChain, 0.0);
        renderer.jChain.mulTranslate(0, -0.092, 0);
      }
      renderer.drawColoredModel(hm.braidTip, renderer.jChain, 0.12);
    }
  }

  // 5. Right Arm (-X): Graceful Balancing Arm with Gold-Cuffed Bell Sleeve
  const swingR = isAir ? -0.45 : -0.15 + Math.sin(phase) * 0.56 * moveRatio;
  const elbowR = isAir ? -0.55 : -0.32 - Math.max(0, -swingR) * 0.48;
  renderer.jShoulder.copy(renderer.jTorso).mulTranslate(-0.145, 0.322, 0).mulRotateZ(-0.44 - moveRatio * 0.12).mulRotateX(swingR);
  renderer.drawColoredModel(hm.upperSleeve, renderer.jShoulder, 0.0);

  renderer.jElbow.copy(renderer.jShoulder).mulTranslate(0, -0.175, 0).mulRotateX(elbowR);
  renderer.drawColoredModel(hm.forearmHand, renderer.jElbow, 0.0);

  // 6. Left Arm (+X, matching illustration) + Bamboo Pole + Fluted Ribbed Hội An Lantern
  const swingL = isAir ? -0.35 : -Math.sin(phase) * 0.18 * moveRatio;
  const shoulderPitchL = -0.78 + swingL;
  const elbowPitchL = -0.62;
  renderer.jShoulder.copy(renderer.jTorso).mulTranslate(0.145, 0.322, 0).mulRotateZ(0.28).mulRotateX(shoulderPitchL);
  renderer.drawColoredModel(hm.upperSleeve, renderer.jShoulder, 0.0);

  renderer.jElbow.copy(renderer.jShoulder).mulTranslate(0, -0.175, 0).mulRotateX(elbowPitchL);
  renderer.drawColoredModel(hm.forearmHand, renderer.jElbow, 0.0);

  renderer.jHand.copy(renderer.jElbow).mulTranslate(0, -0.195, 0.008);
  const netArmPitchX = torsoLeanX * 0.98 + shoulderPitchL + elbowPitchL;
  renderer.jStick.copy(renderer.jHand).mulRotateX(-netArmPitchX - 0.52).mulRotateY(-0.14);
  renderer.drawColoredModel(hm.bambooPole, renderer.jStick, 0.0);

  // Swinging 8-ribbed Hội An lantern suspended vertically under pole tip by gravity & wind
  const lanternScale = 1.0 + 0.28 * carryFrac;
  const lanternSwayX = reducedMotion
    ? 0
    : Math.sin(phase) * 0.20 * moveRatio + Math.sin(timeSec * 3.4) * 0.06 + dashBlend * 0.38 - localWindZ * 0.18;
  const lanternSwayZ = reducedMotion
    ? 0
    : Math.cos(timeSec * 2.7) * 0.08 + Math.sin(phase * 0.5) * 0.09 * moveRatio + localWindX * 0.18;

  renderer.jLantern
    .copy(renderer.jStick)
    .mulTranslate(0, 0, 0.76)
    .mulRotateY(0.14)
    .mulRotateX(0.52 + lanternSwayX)
    .mulRotateZ(lanternSwayZ)
    .mulScale(lanternScale, lanternScale, lanternScale);

  renderer.drawColoredModel(hm.ribbedLantern, renderer.jLantern, 0.90);

  // Tassel hangs from bottom collar (y = -0.545) with subtle secondary sway (!benchmarkMode)
  if (!benchmarkMode) {
    renderer.jChain
      .copy(renderer.jLantern)
      .mulTranslate(0, -0.545, 0)
      .mulRotateX(reducedMotion ? 0 : lanternSwayX * 0.75 + Math.sin(timeSec * 4.5) * 0.08)
      .mulRotateZ(reducedMotion ? 0 : lanternSwayZ * 0.75);
    renderer.drawColoredModel(hm.tassel, renderer.jChain, 0.0);
  }

  // Record lantern center world position for dynamic lighting & firefly embers
  renderer.jLantern.mulTranslate(0, -0.34, 0).getTranslation(renderer.mayLanternPos);

  renderer.endColoredModelPass();

  // 7. Wind Charm Foot Rings & Spirit Companion "Đốm Tiên"
  if (engine.player.charmTicks > 0) {
    renderer.drawMesh(renderer.meshes.ring, renderer.scratchMat.setTRS(px, py + 0.08, pz, 1.05, 1, 1.05, timeSec * 4.0), PALETTE.mayScarf, 0.85);
    renderer.drawMesh(renderer.meshes.ring, renderer.scratchMat.setTRS(px, py + 0.12, pz, 1.22, 1, 1.22, -timeSec * 4.0), PALETTE.goldUi, 0.85);
  }

  if (!benchmarkMode) {
    let urgent = null;
    let bestDist = 1e9;
    for (let i = 0; i < engine.lanterns.length; i++) {
      const l = engine.lanterns[i];
      if (!l.lit || l.fuelUnits < 1800) {
        const d = Math.hypot(l.pos[0] - px, l.pos[2] - pz);
        if (d < bestDist) {
          bestDist = d;
          urgent = l;
        }
      }
    }
    const guideAngle = urgent
      ? Math.atan2(urgent.pos[2] - pz, urgent.pos[0] - px) + Math.sin(timeSec * 3.0) * 0.35
      : timeSec * 2.4;
    const gx = px + Math.cos(guideAngle) * 1.22;
    const gz = pz + Math.sin(guideAngle) * 1.22;
    const gy = py + 1.65 + Math.sin(timeSec * 4.5) * 0.18;
    renderer.drawMesh(renderer.meshes.sphereLow, renderer.scratchMat.setTRS(gx, gy, gz, 0.20, 0.20, 0.20), PALETTE.moteCore, 0.98);
    renderer.drawMesh(renderer.meshes.cube, renderer.scratchMat.setTRS(gx, gy + 0.06, gz, 0.44, 0.05, 0.10, timeSec * 6.0), PALETTE.lanternCore, 0.85);
    return [gx, gy, gz];
  }
  return null;
}
