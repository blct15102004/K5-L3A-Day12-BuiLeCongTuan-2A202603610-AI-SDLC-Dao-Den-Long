// Pure browser-safe procedural 3D scenery builder (zero node:* imports)
import { getGroundHeight, getNightConfig } from '../core/maps.js';
import { PALETTE } from '../core/constants.js';

function createSceneryRng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function jitterColor(base, amount, rng) {
  const j = (rng() - 0.5) * 2 * amount;
  return [
    Math.min(1, Math.max(0, base[0] + j)),
    Math.min(1, Math.max(0, base[1] + j * 0.9)),
    Math.min(1, Math.max(0, base[2] + j * 0.8))
  ];
}

const SCENERY_COLORS = {
  trunkDark: [0.32, 0.21, 0.14],
  trunkWarm: [0.43, 0.29, 0.19],
  palmTrunk: [0.49, 0.40, 0.28],
  roofTile: [0.54, 0.21, 0.17],
  leafDeep: [0.13, 0.30, 0.24],
  leafMid: [0.18, 0.43, 0.32],
  leafBright: [0.27, 0.56, 0.40],
  palmLeaf: [0.20, 0.48, 0.31],
  pineLeaf: [0.11, 0.29, 0.24],
  grassRoot: [0.10, 0.25, 0.20],
  grassTip: [0.32, 0.62, 0.46],
  grassGold: [0.48, 0.64, 0.36],
  cloverGreen: [0.16, 0.74, 0.42],
  cloverHighlight: [0.46, 0.92, 0.58],
  pebbleGrey: [0.44, 0.47, 0.50],
  pebbleWarm: [0.58, 0.51, 0.42],
  pebbleDark: [0.29, 0.32, 0.36],
  mossRock: [0.34, 0.41, 0.37],
  flowerLotus: [0.96, 0.56, 0.69],
  flowerGold: [0.99, 0.84, 0.34],
  flowerWhite: [0.97, 0.96, 0.91],
  flowerLavender: [0.72, 0.64, 0.98],
  flowerCoral: [0.98, 0.48, 0.36],
  flowerCyan: [0.42, 0.94, 0.90],
  crystalCyan: [0.35, 0.92, 0.88],
  crystalAmber: [1.0, 0.76, 0.32],
  waterfallWater: [0.62, 0.88, 0.98],
  reedPlume: [0.92, 0.86, 0.70],
  stoneCarved: [0.52, 0.54, 0.57],
  ginkgoGold: [0.98, 0.76, 0.20],
  ginkgoBright: [1.0, 0.88, 0.36],
  sakuraPink: [0.98, 0.60, 0.76],
  sakuraLight: [1.0, 0.80, 0.89],
  sakuraDeep: [0.80, 0.36, 0.56],
  sakuraPetal: [0.99, 0.72, 0.84],
  lampGrassCyan: [0.32, 0.96, 1.0],
  jadeAmulet: [0.25, 0.96, 0.78],
  distantPeak: [0.16, 0.24, 0.44],
  distantMistPeak: [0.22, 0.34, 0.56],
  mistTeal: [0.36, 0.68, 0.84],
  mistLavender: [0.54, 0.50, 0.88],
  mistWarm: [0.96, 0.78, 0.48],
  cliffDeep: [0.22, 0.17, 0.15],
  mushroomCap: [0.36, 0.92, 0.84],
  mushroomStem: [0.88, 0.86, 0.78],
  fernGreen: [0.20, 0.54, 0.34],
  skyCloudTop: [0.24, 0.32, 0.58],
  skyCloudMoon: [0.68, 0.78, 0.96]
};

class SceneryBuilder {
  constructor() {
    this.chunks = [];
    this.resetChunk();
  }

  resetChunk() {
    this.pos = [];
    this.norm = [];
    this.col = [];
    this.sway = [];
    this.idx = [];
  }

  flushIfFull(reserveVerts = 256) {
    if (this.pos.length / 3 + reserveVerts >= 46000) {
      this.finalizeChunk();
    }
  }

  finalizeChunk() {
    if (this.idx.length === 0) return;
    this.chunks.push({
      positions: new Float32Array(this.pos),
      normals: new Float32Array(this.norm),
      colors: new Float32Array(this.col),
      sway: new Float32Array(this.sway),
      indices: new Uint16Array(this.idx),
      count: this.idx.length
    });
    this.resetChunk();
  }

  pushVert(x, y, z, nx, ny, nz, col, weight = 0, phase = 0) {
    this.pos.push(x, y, z);
    this.norm.push(nx, ny, nz);
    this.col.push(col[0], col[1], col[2]);
    this.sway.push(weight, phase);
  }

  addTransformedBox(cx, cy, cz, sx, sy, sz, rotY, rotX, rotZ, col, weightMin = 0, weightMax = 0, phase = 0) {
    this.flushIfFull(24);
    const cyr = Math.cos(rotY), syr = Math.sin(rotY);
    const cxr = Math.cos(rotX), sxr = Math.sin(rotX);
    const czr = Math.cos(rotZ), szr = Math.sin(rotZ);

    const xform = (vx, vy, vz, isNormal) => {
      let x = isNormal ? vx : vx * sx;
      let y = isNormal ? vy : vy * sy;
      let z = isNormal ? vz : vz * sz;
      if (rotZ !== 0) {
        const nx = x * czr - y * szr;
        const ny = x * szr + y * czr;
        x = nx; y = ny;
      }
      if (rotX !== 0) {
        const ny = y * cxr - z * sxr;
        const nz = y * sxr + z * cxr;
        y = ny; z = nz;
      }
      if (rotY !== 0) {
        const nx = cyr * x + syr * z;
        const nz = -syr * x + cyr * z;
        x = nx; z = nz;
      }
      if (isNormal) {
        const len = Math.hypot(x, y, z) || 1;
        return [x / len, y / len, z / len];
      }
      return [cx + x, cy + y, cz + z];
    };

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
      const nn = xform(f.n[0], f.n[1], f.n[2], true);
      for (const v of f.verts) {
        const p = xform(v[0], v[1], v[2], false);
        const w = v[1] > 0 ? weightMax : weightMin;
        this.pushVert(p[0], p[1], p[2], nn[0], nn[1], nn[2], col, w, phase);
      }
      this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }

  addCylinder(x, yCenter, z, rBot, rTop, h, segs, col, rotX = 0, rotZ = 0, weightMin = 0, weightMax = 0, phase = 0) {
    this.flushIfFull((segs + 1) * 4 + 8);
    const cxr = Math.cos(rotX), sxr = Math.sin(rotX);
    const czr = Math.cos(rotZ), szr = Math.sin(rotZ);
    const rot = (vx, vy, vz, isN) => {
      let lx = vx, ly = vy, lz = vz;
      if (rotZ !== 0) {
        const nx = lx * czr - ly * szr;
        const ny = lx * szr + ly * czr;
        lx = nx; ly = ny;
      }
      if (rotX !== 0) {
        const ny = ly * cxr - lz * sxr;
        const nz = ly * sxr + lz * cxr;
        ly = ny; lz = nz;
      }
      return isN ? [lx, ly, lz] : [x + lx, yCenter + ly, z + lz];
    };

    const startIdx = this.pos.length / 3;
    const hh = h * 0.5;
    for (let i = 0; i <= segs; i++) {
      const a = (i * Math.PI * 2) / segs;
      const ca = Math.cos(a), sa = Math.sin(a);
      const nt = rot(ca, 0.15, sa, true);
      const nLen = Math.hypot(nt[0], nt[1], nt[2]) || 1;
      const nx = nt[0] / nLen, ny = nt[1] / nLen, nz = nt[2] / nLen;
      const pt = rot(ca * rTop, hh, sa * rTop, false);
      const pb = rot(ca * rBot, -hh, sa * rBot, false);
      this.pushVert(pt[0], pt[1], pt[2], nx, ny, nz, col, weightMax, phase);
      this.pushVert(pb[0], pb[1], pb[2], nx, ny, nz, col, weightMin, phase);
    }
    for (let i = 0; i < segs; i++) {
      const t0 = startIdx + i * 2, b0 = t0 + 1;
      const t1 = t0 + 2, b1 = t0 + 3;
      this.idx.push(t0, b0, t1, b0, b1, t1);
    }
    const topCenter = this.pos.length / 3;
    const tn = rot(0, 1, 0, true);
    const tp = rot(0, hh, 0, false);
    this.pushVert(tp[0], tp[1], tp[2], tn[0], tn[1], tn[2], col, weightMax, phase);
    for (let i = 0; i < segs; i++) {
      const a0 = (i * Math.PI * 2) / segs;
      const a1 = ((i + 1) * Math.PI * 2) / segs;
      const v0 = this.pos.length / 3;
      const p0 = rot(Math.cos(a0) * rTop, hh, Math.sin(a0) * rTop, false);
      const p1 = rot(Math.cos(a1) * rTop, hh, Math.sin(a1) * rTop, false);
      this.pushVert(p0[0], p0[1], p0[2], tn[0], tn[1], tn[2], col, weightMax, phase);
      this.pushVert(p1[0], p1[1], p1[2], tn[0], tn[1], tn[2], col, weightMax, phase);
      this.idx.push(topCenter, v0, v0 + 1);
    }
  }

  addSegmentCylinder(x1, y1, z1, x2, y2, z2, rBot, rTop, segs, col, weightMin = 0, weightMax = 0, phase = 0) {
    this.flushIfFull((segs + 1) * 2 + 4);
    const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
    const len = Math.hypot(dx, dy, dz) || 1;
    const wx = dx / len, wy = dy / len, wz = dz / len;
    const tx = Math.abs(wy) < 0.92 ? 0 : 1;
    const ty = Math.abs(wy) < 0.92 ? 1 : 0;
    const tz = 0;
    let ux = ty * wz - tz * wy;
    let uy = tz * wx - tx * wz;
    let uz = tx * wy - ty * wx;
    const uLen = Math.hypot(ux, uy, uz) || 1;
    ux /= uLen; uy /= uLen; uz /= uLen;
    const vx = wy * uz - wz * uy;
    const vy = wz * ux - wx * uz;
    const vz = wx * uy - wy * ux;

    const startIdx = this.pos.length / 3;
    for (let i = 0; i <= segs; i++) {
      const a = (i * Math.PI * 2) / segs;
      const ca = Math.cos(a), sa = Math.sin(a);
      const nx = ca * ux + sa * vx;
      const ny = ca * uy + sa * vy;
      const nz = ca * uz + sa * vz;
      this.pushVert(x2 + nx * rTop, y2 + ny * rTop, z2 + nz * rTop, nx, ny, nz, col, weightMax, phase);
      this.pushVert(x1 + nx * rBot, y1 + ny * rBot, z1 + nz * rBot, nx, ny, nz, col, weightMin, phase);
    }
    for (let i = 0; i < segs; i++) {
      const t0 = startIdx + i * 2, b0 = t0 + 1;
      const t1 = t0 + 2, b1 = t0 + 3;
      this.idx.push(t0, b0, t1, b0, b1, t1);
    }
  }

  addCone(x, yCenter, z, r, h, segs, col, swayBase = 0, swayTip = 0, phase = 0) {
    this.flushIfFull(segs + 6);
    const hh = h * 0.5;
    const apexIdx = this.pos.length / 3;
    this.pushVert(x, yCenter + hh, z, 0, 1, 0, col, swayTip, phase);
    for (let i = 0; i <= segs; i++) {
      const a = (i * Math.PI * 2) / segs;
      const ca = Math.cos(a), sa = Math.sin(a);
      this.pushVert(x + ca * r, yCenter - hh, z + sa * r, ca * 0.78, 0.55, sa * 0.78, col, swayBase, phase);
    }
    for (let i = 0; i < segs; i++) {
      this.idx.push(apexIdx, apexIdx + 1 + i, apexIdx + 2 + i);
    }
  }

  addOctahedron(x, y, z, rx, ry, rz, rotY, col, weight = 0, phase = 0) {
    this.flushIfFull(24);
    const c = Math.cos(rotY), s = Math.sin(rotY);
    const pt = (lx, ly, lz) => [
      x + c * (lx * rx) + s * (lz * rz),
      y + ly * ry,
      z - s * (lx * rx) + c * (lz * rz)
    ];
    const verts = [
      pt(0, 1, 0), pt(0, -1, 0),
      pt(1, 0, 0), pt(0, 0, 1), pt(-1, 0, 0), pt(0, 0, -1)
    ];
    const tris = [
      [0, 3, 2], [0, 4, 3], [0, 5, 4], [0, 2, 5],
      [1, 2, 3], [1, 3, 4], [1, 4, 5], [1, 5, 2]
    ];
    for (const [i0, i1, i2] of tris) {
      const a = verts[i0], b = verts[i1], d = verts[i2];
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      const vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
      let nx = uy * vz - uz * vy;
      let ny = uz * vx - ux * vz;
      let nz = ux * vy - uy * vx;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len; ny /= len; nz /= len;
      const base = this.pos.length / 3;
      for (const v of [a, b, d]) {
        const dx = v[0] - x, dy = (v[1] - y) * 1.15, dz = v[2] - z;
        const rLen = Math.hypot(dx, dy, dz) || 1;
        let sx = (dx / rLen) * 0.70 + nx * 0.30;
        let sy = (dy / rLen) * 0.70 + ny * 0.30;
        let sz = (dz / rLen) * 0.70 + nz * 0.30;
        const bLen = Math.hypot(sx, sy, sz) || 1;
        sx /= bLen; sy /= bLen; sz /= bLen;
        const dyRaw = v[1] - y;
        const ao = dyRaw > 0.001 ? 1.08 : (dyRaw < -0.001 ? 0.74 : 0.98);
        const tinted = [
          Math.min(1, col[0] * ao),
          Math.min(1, col[1] * ao),
          Math.min(1, col[2] * ao)
        ];
        const w = v[1] > y ? weight : weight * 0.5;
        this.pushVert(v[0], v[1], v[2], sx, sy, sz, tinted, w, phase);
      }
      this.idx.push(base, base + 1, base + 2);
    }
  }

  addSoftDome(x, y, z, rx, ry, rz, rotY, col, weight = 0, phase = 0, segs = 7) {
    this.flushIfFull((segs + 1) * 3);
    const c = Math.cos(rotY), s = Math.sin(rotY);
    const arx = Math.abs(rx) || 1, ary = Math.abs(ry) || 1, arz = Math.abs(rz) || 1;
    const shade = (ao) => [
      Math.min(1, col[0] * ao),
      Math.min(1, col[1] * ao),
      Math.min(1, col[2] * ao)
    ];
    const pushDomeVert = (lx, ly, lz, ao, w) => {
      const wx = x + c * (lx * rx) + s * (lz * rz);
      const wy = y + ly * ry;
      const wz = z - s * (lx * rx) + c * (lz * rz);
      const gx = lx / arx, gy = ly / ary, gz = lz / arz;
      let nx = c * gx + s * gz;
      let ny = gy;
      let nz = -s * gx + c * gz;
      const nLen = Math.hypot(nx, ny, nz) || 1;
      this.pushVert(wx, wy, wz, nx / nLen, ny / nLen, nz / nLen, shade(ao), w, phase);
    };

    const crownIdx = this.pos.length / 3;
    pushDomeVert(0, 1.0, 0, 1.12, weight);

    const upperStart = this.pos.length / 3;
    const rUp = 0.77, yUp = 0.64;
    for (let i = 0; i < segs; i++) {
      const a = (i * Math.PI * 2) / segs;
      pushDomeVert(Math.cos(a) * rUp, yUp, Math.sin(a) * rUp, 1.02, weight * 0.92);
    }

    const lowerStart = this.pos.length / 3;
    const rLow = 0.97, yLow = -0.25;
    for (let i = 0; i < segs; i++) {
      const a = (i * Math.PI * 2) / segs;
      pushDomeVert(Math.cos(a) * rLow, yLow, Math.sin(a) * rLow, 0.88, weight * 0.65);
    }

    const baseIdx = this.pos.length / 3;
    pushDomeVert(0, -1.0, 0, 0.72, weight * 0.35);

    for (let i = 0; i < segs; i++) {
      const ni = (i + 1) % segs;
      const u0 = upperStart + i, u1 = upperStart + ni;
      const l0 = lowerStart + i, l1 = lowerStart + ni;
      this.idx.push(crownIdx, u1, u0);
      this.idx.push(u0, u1, l1, u0, l1, l0);
      this.idx.push(baseIdx, l0, l1);
    }
  }

  addGrassTuft(x, y, z, scale, phase, rng) {
    this.flushIfFull(20);
    const blades = 4 + (rng() > 0.5 ? 1 : 0);
    for (let i = 0; i < blades; i++) {
      const yaw = (i * Math.PI * 2) / blades + rng() * 0.75;
      const h = (0.42 + rng() * 0.46) * scale;
      const lean = (0.24 + rng() * 0.25) * scale;
      const w = (0.032 + rng() * 0.022) * scale;
      const dx = Math.cos(yaw), dz = Math.sin(yaw);
      const px = -dz, pz = dx;
      const rootCol = SCENERY_COLORS.grassRoot;
      const tipRoll = rng();
      const tipCol = tipRoll < 0.20
        ? SCENERY_COLORS.grassGold
        : tipRoll < 0.34
          ? SCENERY_COLORS.cloverHighlight
          : jitterColor(SCENERY_COLORS.grassTip, 0.05, rng);

      const base = this.pos.length / 3;
      this.pushVert(x + px * w, y, z + pz * w, px * 0.4, 0.90, pz * 0.4, rootCol, 0.0, phase);
      this.pushVert(x - px * w, y, z - pz * w, -px * 0.4, 0.90, -pz * 0.4, rootCol, 0.0, phase);
      this.pushVert(x + dx * lean, y + h, z + dz * lean, dx * 0.2, 0.98, dz * 0.2, tipCol, 1.15 * scale, phase);
      this.idx.push(base, base + 1, base + 2);
    }
  }

  addFourLeafCloverPatch(x, y, z, scale, phase, rng) {
    const clovers = 2;
    this.flushIfFull(clovers * 32);
    for (let c = 0; c < clovers; c++) {
      const cx = x + (c === 0 ? 0 : (rng() - 0.5) * 0.44);
      const cz = z + (c === 0 ? 0 : (rng() - 0.5) * 0.44);
      const h = (0.20 + rng() * 0.14) * scale;
      const bx = cx + (rng() - 0.5) * 0.05;
      const bz = cz + (rng() - 0.5) * 0.05;
      const by = y + h;
      const swayW = 0.72 * scale;
      const cPhase = phase + c * 0.5;

      // Stem triangle
      const sb = this.pos.length / 3;
      this.pushVert(cx - 0.016, y, cz, 0, 0.5, 1, SCENERY_COLORS.grassRoot, 0, cPhase);
      this.pushVert(cx + 0.016, y, cz, 0, 0.5, 1, SCENERY_COLORS.grassRoot, 0, cPhase);
      this.pushVert(bx, by, bz, 0, 1, 0, SCENERY_COLORS.cloverGreen, swayW, cPhase);
      this.idx.push(sb, sb + 1, sb + 2);

      // 4 crisp 2-triangle heart-shaped leaves at 0, 90, 180, 270 deg
      const rot0 = rng() * Math.PI * 2;
      const leafLen = 0.22 * scale;
      const cleftR = 0.155 * scale;
      const lobeW = 0.095 * scale;
      const outerCol = jitterColor(SCENERY_COLORS.cloverGreen, 0.04, rng);
      const innerCol = jitterColor(SCENERY_COLORS.cloverHighlight, 0.04, rng);

      for (let p = 0; p < 4; p++) {
        const a = rot0 + (p * Math.PI) / 2;
        const dx = Math.cos(a), dz = Math.sin(a);
        const rx = -dz, rz = dx;
        const base = this.pos.length / 3;
        this.pushVert(bx, by, bz, 0, 1, 0, innerCol, swayW, cPhase);
        this.pushVert(bx + dx * leafLen + rx * lobeW, by + 0.036, bz + dz * leafLen + rz * lobeW, 0, 1, 0, outerCol, swayW, cPhase);
        this.pushVert(bx + dx * cleftR, by + 0.026, bz + dz * cleftR, 0, 1, 0, innerCol, swayW, cPhase);
        this.pushVert(bx + dx * leafLen - rx * lobeW, by + 0.036, bz + dz * leafLen - rz * lobeW, 0, 1, 0, outerCol, swayW, cPhase);
        this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
      // 2-triangle golden dewdrop center diamond
      const db = this.pos.length / 3;
      const dr = 0.038 * scale;
      this.pushVert(bx - dr, by + 0.04, bz, 0, 1, 0, SCENERY_COLORS.flowerGold, swayW, cPhase);
      this.pushVert(bx, by + 0.04, bz - dr, 0, 1, 0, SCENERY_COLORS.flowerGold, swayW, cPhase);
      this.pushVert(bx + dr, by + 0.04, bz, 0, 1, 0, SCENERY_COLORS.flowerGold, swayW, cPhase);
      this.pushVert(bx, by + 0.04, bz + dr, 0, 1, 0, SCENERY_COLORS.flowerGold, swayW, cPhase);
      this.idx.push(db, db + 1, db + 2, db, db + 2, db + 3);
    }
  }

  addFlowerCluster(x, y, z, petalColor, scale, phase, rng) {
    const count = 2;
    this.flushIfFull(count * 32 + 12);

    // 2 single-triangle basal rosette leaves
    for (let l = 0; l < 2; l++) {
      const la = phase + l * 2.4;
      const ldx = Math.cos(la) * 0.22 * scale, ldz = Math.sin(la) * 0.22 * scale;
      const lrx = -Math.sin(la) * 0.075 * scale, lrz = Math.cos(la) * 0.075 * scale;
      const lb = this.pos.length / 3;
      this.pushVert(x + lrx, y + 0.02, z + lrz, 0, 1, 0, SCENERY_COLORS.grassRoot, 0, phase);
      this.pushVert(x - lrx, y + 0.02, z - lrz, 0, 1, 0, SCENERY_COLORS.grassRoot, 0, phase);
      this.pushVert(x + ldx, y + 0.06, z + ldz, 0, 1, 0, SCENERY_COLORS.leafBright, 0.55, phase);
      this.idx.push(lb, lb + 1, lb + 2);
    }

    for (let f = 0; f < count; f++) {
      const fx = x + (f === 0 ? 0 : (rng() - 0.5) * 0.32);
      const fz = z + (f === 0 ? 0 : (rng() - 0.5) * 0.32);
      const h = (0.38 + rng() * 0.22) * scale;
      const bendX = (rng() - 0.5) * 0.11;
      const bendZ = (rng() - 0.5) * 0.11;
      const swayW = 0.90 * scale;

      const sb = this.pos.length / 3;
      const stemCol = SCENERY_COLORS.leafMid;
      this.pushVert(fx - 0.024, y, fz, 0, 0.5, 1, SCENERY_COLORS.grassRoot, 0, phase);
      this.pushVert(fx + 0.024, y, fz, 0, 0.5, 1, SCENERY_COLORS.grassRoot, 0, phase);
      this.pushVert(fx + bendX, y + h, fz + bendZ, 0, 1, 0, stemCol, swayW, phase);
      this.idx.push(sb, sb + 1, sb + 2);

      const bx = fx + bendX, by = y + h, bz = fz + bendZ;
      const pLen = (0.20 + rng() * 0.06) * scale;
      const pWid = 0.095 * scale;
      const col = jitterColor(petalColor, 0.035, rng);
      for (let p = 0; p < 5; p++) {
        const a = (p * Math.PI * 2) / 5 + rng() * 0.2;
        const dx = Math.cos(a), dz = Math.sin(a);
        const rx = -dz, rz = dx;
        const base = this.pos.length / 3;
        this.pushVert(bx, by, bz, 0, 1, 0, SCENERY_COLORS.flowerGold, swayW, phase);
        this.pushVert(bx + dx * pLen + rx * pWid, by + 0.045, bz + dz * pLen + rz * pWid, 0, 1, 0, col, swayW, phase);
        this.pushVert(bx + dx * pLen - rx * pWid, by + 0.045, bz + dz * pLen - rz * pWid, 0, 1, 0, col, swayW, phase);
        this.idx.push(base, base + 1, base + 2);
      }
      // 2-triangle golden stamen center
      const cb = this.pos.length / 3;
      const cr = 0.052 * scale;
      this.pushVert(bx - cr, by + 0.055, bz, 0, 1, 0, SCENERY_COLORS.flowerGold, swayW, phase);
      this.pushVert(bx, by + 0.055, bz - cr, 0, 1, 0, SCENERY_COLORS.flowerGold, swayW, phase);
      this.pushVert(bx + cr, by + 0.055, bz, 0, 1, 0, SCENERY_COLORS.flowerGold, swayW, phase);
      this.pushVert(bx, by + 0.055, bz + cr, 0, 1, 0, SCENERY_COLORS.flowerGold, swayW, phase);
      this.idx.push(cb, cb + 1, cb + 2, cb, cb + 2, cb + 3);
    }
  }
}

function isClearOfGameplay(night, x, z, cfg, minDist) {
  const sx = x - cfg.spawn[0], sz = z - cfg.spawn[2];
  if (Math.hypot(sx, sz) < Math.max(minDist, 2.8)) return false;

  for (const l of cfg.lanterns) {
    if (Math.hypot(x - l.pos[0], z - l.pos[2]) < minDist) return false;
  }
  for (const p of cfg.launchPads) {
    if (Math.hypot(x - p.pos[0], z - p.pos[2]) < Math.max(minDist, 2.6)) return false;
  }
  for (const c of cfg.charms) {
    if (Math.hypot(x - c.pos[0], z - c.pos[2]) < 2.1) return false;
  }
  if (night === 2) {
    if (x >= 24.5 && x <= 45.5 && Math.abs(z) <= 3.1) return false;
  }
  if (night === 3) {
    if (Math.hypot(x, z) < 3.6) return false;
    const RAMP_ANGLES = [Math.PI / 6, (5 * Math.PI) / 6];
    for (const rad of RAMP_ANGLES) {
      const s = x * Math.cos(rad) + z * Math.sin(rad);
      const t = -x * Math.sin(rad) + z * Math.cos(rad);
      if (s >= 22.0 && s <= 31.8 && Math.abs(t) <= 2.6) return false;
    }
  }
  return true;
}

function isSafeFlatGround(night, x, z) {
  const y = getGroundHeight(night, x, z);
  if (y === null) return null;
  if (night === 3) {
    for (const [ox, oz] of [[0.7, 0], [-0.7, 0], [0, 0.7], [0, -0.7]]) {
      const ny = getGroundHeight(3, x + ox, z + oz);
      if (ny === null || Math.abs(ny - y) > 0.05) return null;
    }
  } else {
    for (const [ox, oz] of [[0.6, 0], [-0.6, 0], [0, 0.6], [0, -0.6]]) {
      if (getGroundHeight(night, x + ox, z + oz) === null) return null;
    }
  }
  return y;
}

function addGardenStoneLantern(sb, fb, x, y, z, rotY, staticGlows, colliders = null) {
  sb.addCylinder(x, y + 0.14, z, 0.36, 0.28, 0.28, 6, SCENERY_COLORS.stoneCarved);
  sb.addCylinder(x, y + 0.56, z, 0.15, 0.11, 0.62, 6, SCENERY_COLORS.mossRock);
  sb.addCylinder(x, y + 0.90, z, 0.22, 0.28, 0.12, 6, SCENERY_COLORS.stoneCarved);
  fb.addOctahedron(x, y + 1.09, z, 0.15, 0.17, 0.15, rotY, PALETTE.lanternCore, 0.1, rotY);
  sb.addCone(x, y + 1.32, z, 0.36, 0.26, 6, SCENERY_COLORS.mossRock);
  staticGlows.push({ x, y: y + 1.09, z, size: 1.85, color: PALETTE.lanternLit, alpha: 0.68 });
  if (colliders) colliders.push({ x, y, z, r: 0.42, h: 1.4 });
}

function addMushroomAndFernCluster(sb, fb, x, y, z, scale, rng, staticGlows) {
  for (let m = 0; m < 2; m++) {
    const a = rng() * Math.PI * 2;
    const dist = 0.08 + rng() * 0.22;
    const mx = x + Math.cos(a) * dist, mz = z + Math.sin(a) * dist;
    const mh = (0.14 + rng() * 0.14) * scale;
    sb.addCylinder(mx, y + mh * 0.45, mz, 0.03 * scale, 0.02 * scale, mh, 5, SCENERY_COLORS.mushroomStem);
    sb.addSoftDome(mx, y + mh, mz, (0.09 + rng() * 0.06) * scale, 0.055 * scale, (0.09 + rng() * 0.06) * scale, a, SCENERY_COLORS.mushroomCap);
  }
  if (staticGlows) staticGlows.push({ x, y: y + 0.22, z, size: 0.85 * scale, color: SCENERY_COLORS.mushroomCap, alpha: 0.42 });
  for (let f = 0; f < 3; f++) {
    const fa = (f * Math.PI * 2) / 3 + rng() * 0.35;
    const fx = x + Math.cos(fa) * 0.20 * scale, fz = z + Math.sin(fa) * 0.20 * scale;
    fb.addOctahedron(fx, y + 0.14 * scale, fz, 0.22 * scale, 0.03 * scale, 0.075 * scale, -fa, jitterColor(SCENERY_COLORS.fernGreen, 0.04, rng), 0.72, fa);
  }
}

function addHarborPierAndBoat(sb, fb, staticGlows) {
  const py = -0.15;
  for (let p = 0; p < 5; p++) {
    const pz = -38.8 - p * 1.9;
    sb.addTransformedBox(0, py, pz, 3.6, 0.20, 1.50, 0, 0, 0, SCENERY_COLORS.trunkWarm);
    sb.addCylinder(-1.55, py - 1.6, pz, 0.16, 0.14, 3.8, 6, SCENERY_COLORS.trunkDark);
    sb.addCylinder(1.55, py - 1.6, pz, 0.16, 0.14, 3.8, 6, SCENERY_COLORS.trunkDark);
  }
  sb.addSegmentCylinder(1.5, py + 0.1, -46.2, 1.4, py + 2.35, -46.2, 0.11, 0.08, 6, SCENERY_COLORS.trunkDark);
  sb.addSegmentCylinder(1.4, py + 2.35, -46.2, 0.85, py + 2.42, -46.2, 0.05, 0.04, 5, SCENERY_COLORS.trunkWarm);
  fb.addOctahedron(0.85, py + 2.02, -46.2, 0.22, 0.28, 0.22, 0, PALETTE.lanternCore, 0.95, 2.1);
  staticGlows.push({ x: 0.85, y: py + 2.02, z: -46.2, size: 1.85, color: PALETTE.lanternCore, alpha: 0.72 });

  // Tapered graceful wooden sampan boat gently bobbing beside pier
  const bx = 4.6, by = -1.1, bz = -44.2;
  fb.addSoftDome(bx, by, bz, 0.95, 0.42, 2.75, 0.28, SCENERY_COLORS.trunkWarm, 0.48, 0.8, 8);
  fb.addSoftDome(bx, by + 0.24, bz, 0.72, 0.24, 1.85, 0.28, SCENERY_COLORS.trunkDark, 0.52, 0.8, 8);
  fb.addSegmentCylinder(bx - 0.5, by + 0.35, bz + 1.9, bx - 0.5, by + 1.95, bz + 1.9, 0.055, 0.04, 5, SCENERY_COLORS.trunkDark, 0.5, 0.8, 0.8);
  fb.addOctahedron(bx - 0.5, by + 1.85, bz + 1.9, 0.20, 0.25, 0.20, 0, PALETTE.lanternLit, 0.95, 0.8);
  staticGlows.push({ x: bx - 0.5, y: by + 1.85, z: bz + 1.9, size: 1.45, color: PALETTE.lanternLit, alpha: 0.65 });
}

function addBridgeBambooArches(sb, fb, staticGlows) {
  for (const sideZ of [-2.05, 2.05]) {
    sb.addSegmentCylinder(26.2, 0.82, sideZ, 43.8, 0.82, sideZ, 0.06, 0.06, 6, SCENERY_COLORS.palmTrunk);
  }
  for (const bx of [28, 35, 42]) {
    sb.addCylinder(bx, 1.65, -2.05, 0.11, 0.08, 3.3, 6, PALETTE.sand);
    sb.addCylinder(bx, 1.65, 2.05, 0.11, 0.08, 3.3, 6, PALETTE.sand);
    sb.addSegmentCylinder(bx, 3.28, -2.18, bx, 3.38, 0, 0.09, 0.11, 6, SCENERY_COLORS.trunkWarm);
    sb.addSegmentCylinder(bx, 3.38, 0, bx, 3.28, 2.18, 0.11, 0.09, 6, SCENERY_COLORS.trunkWarm);
    fb.addSegmentCylinder(bx, 3.36, 0, bx, 2.82, 0, 0.025, 0.02, 4, PALETTE.wood, 0.2, 0.8, bx);
    fb.addOctahedron(bx, 2.65, 0, 0.22, 0.27, 0.22, 0, PALETTE.lanternCore, 0.95, bx);
    staticGlows.push({ x: bx, y: 2.65, z: 0, size: 1.7, color: PALETTE.lanternCore, alpha: 0.66 });
  }
}

function addNight3BellPavilionDecor(sb, fb, staticGlows) {
  const angles = [0.68, 2.46, 3.7, 5.72];
  for (const a of angles) {
    const sx = Math.cos(a) * 6.9, sz = Math.sin(a) * 6.9;
    sb.addCylinder(sx, 6.32, sz, 0.34, 0.28, 0.66, 6, SCENERY_COLORS.stoneCarved);
    sb.addCone(sx, 6.86, sz, 0.44, 0.36, 6, SCENERY_COLORS.roofTile);
    fb.addOctahedron(sx, 6.72, sz, 0.14, 0.16, 0.14, a, PALETTE.lanternCore, 0.25, a);
    staticGlows.push({ x: sx, y: 6.72, z: sz, size: 1.25, color: PALETTE.lanternCore, alpha: 0.58 });
  }
  for (const a of [0.55, 1.2, 1.95, 2.6]) {
    const sx = Math.cos(a) * 23.0, sz = Math.sin(a) * 23.0;
    sb.addCylinder(sx, 3.28, sz, 0.30, 0.24, 0.58, 6, SCENERY_COLORS.stoneCarved);
    sb.addOctahedron(sx, 3.75, sz, 0.18, 0.24, 0.18, a, PALETTE.goldUi);
    staticGlows.push({ x: sx, y: 3.75, z: sz, size: 1.25, color: PALETTE.goldUi, alpha: 0.55 });
  }
}

function addNight3MountainRelief(sb, fb, cfg, rng, staticGlows, colliders) {
  const RAMP_ANGLES = [Math.PI / 6, (5 * Math.PI) / 6];
  const nearRamp = (a) => RAMP_ANGLES.some(ra => Math.abs(a - ra) < 0.18);

  // 1. Sculpted karst cliff strata & mossy overhangs along Tier 1 outer wall (r ~ 24.0, z > 0)
  for (let i = 0; i < 24; i++) {
    const a = 0.08 + (i / 23) * (Math.PI - 0.16);
    if (nearRamp(a)) continue;
    const cx = Math.cos(a) * 24.05;
    const cz = Math.sin(a) * 24.05;
    const colA = jitterColor(SCENERY_COLORS.cliffDeep, 0.04, rng);
    const colB = jitterColor(SCENERY_COLORS.mossRock, 0.04, rng);
    sb.addSoftDome(cx, 1.15 + (i % 2) * 0.35, cz, 1.65 + rng() * 0.7, 1.55 + rng() * 0.45, 1.45 + rng() * 0.5, a, colA, 0, 0, 8);
    sb.addSoftDome(cx * 0.99, 2.55, cz * 0.99, 1.45, 0.55, 1.35, a + 0.4, colB, 0, 0, 8);
    if (i % 3 === 1) {
      const gx = Math.cos(a) * 24.9, gz = Math.sin(a) * 24.9;
      const gCol = i % 2 === 0 ? SCENERY_COLORS.crystalCyan : SCENERY_COLORS.crystalAmber;
      sb.addOctahedron(gx, 1.65, gz, 0.24, 0.48, 0.24, a, gCol);
      staticGlows.push({ x: gx, y: 1.65, z: gz, size: 2.2, color: gCol, alpha: 0.45 });
    }
  }

  // 2. Sculpted inner crescent rock buttresses (r ~ 11.85, z > 0)
  for (let i = 0; i < 14; i++) {
    const a = 0.12 + (i / 13) * (Math.PI - 0.24);
    const cx = Math.cos(a) * 11.75;
    const cz = Math.sin(a) * 11.75;
    sb.addSoftDome(cx, 1.25 + rng() * 0.5, cz, 1.35 + rng() * 0.4, 1.45, 1.25, a, jitterColor(SCENERY_COLORS.mossRock, 0.04, rng), 0, 0, 7);
    sb.addSoftDome(cx * 1.01, 2.65, cz * 1.01, 1.15, 0.42, 1.05, a, jitterColor(SCENERY_COLORS.grassRoot, 0.03, rng), 0, 0, 7);
  }

  // 3. Sculpted Summit Peak rock cliff terrace around Tier 2 (r ~ 8.05, full 360 deg, climbing Y = 0..6)
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + rng() * 0.1;
    const rWall = 7.95 + (i % 2) * 0.25;
    const rx = Math.cos(a) * rWall;
    const rz = Math.sin(a) * rWall;
    sb.addSoftDome(rx, 1.85 + rng() * 0.5, rz, 1.55 + rng() * 0.5, 2.15, 1.45 + rng() * 0.5, a, jitterColor(SCENERY_COLORS.cliffDeep, 0.04, rng), 0, 0, 8);
    sb.addSoftDome(rx * 1.01, 4.35 + rng() * 0.4, rz * 1.01, 1.30, 1.75, 1.25, a + 0.3, jitterColor(SCENERY_COLORS.mossRock, 0.04, rng), 0, 0, 8);
    if (i % 3 === 0) {
      const vc = i % 6 === 0 ? SCENERY_COLORS.crystalAmber : SCENERY_COLORS.crystalCyan;
      sb.addOctahedron(rx * 1.10, 3.1, rz * 1.10, 0.22, 0.58, 0.22, a, vc);
      staticGlows.push({ x: rx * 1.10, y: 3.1, z: rz * 1.10, size: 2.1, color: vc, alpha: 0.46 });
    }
  }

  // 4. Decorative carved ramp side-curbs & glowing bollards flanking both 30 deg / 150 deg climbs (outside |t| <= 1.5)
  for (const rad of RAMP_ANGLES) {
    const ca = Math.cos(rad), sa = Math.sin(rad);
    for (const s of [25.0, 27.2, 29.3]) {
      const yRamp = Math.min(3.0, Math.max(0.0, 0.5 * (30.0 - s)));
      for (const side of [-1.78, 1.78]) {
        const rx = s * ca - side * sa;
        const rz = s * sa + side * ca;
        sb.addCylinder(rx, yRamp + 0.32, rz, 0.24, 0.18, 0.65, 6, SCENERY_COLORS.stoneCarved);
        fb.addOctahedron(rx, yRamp + 0.78, rz, 0.14, 0.18, 0.14, rad, PALETTE.lanternCore, 0.15, s);
        staticGlows.push({ x: rx, y: yRamp + 0.78, z: rz, size: 1.35, color: PALETTE.lanternLit, alpha: 0.58 });
      }
    }
  }

  // 5. Outer alpine rocky knolls on Level 0 flanks (clear of spawn, lanterns, ramps & charms)
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.22;
    const kr = 37.5 + (i % 2) * 3.8;
    const kx = Math.cos(a) * kr, kz = Math.sin(a) * kr;
    const ky = isSafeFlatGround(3, kx, kz);
    if (ky === null || !isClearOfGameplay(3, kx, kz, cfg, 3.8)) continue;
    const w = 1.6 + rng() * 0.9, h = 0.75 + rng() * 0.65;
    sb.addSoftDome(kx, ky + h * 0.42, kz, w, h, w * 0.85, a, jitterColor(SCENERY_COLORS.mossRock, 0.04, rng), 0, 0, 8);
    sb.addSoftDome(kx + 0.4, ky + h * 0.72, kz - 0.3, w * 0.58, h * 0.55, w * 0.55, a + 0.5, SCENERY_COLORS.grassRoot, 0, 0, 7);
    colliders.push({ x: kx, y: ky, z: kz, r: w * 0.82, h: h * 1.1 });
  }
}

function addNight3SacredCenterTree(sb, fb, rng, staticGlows) {
  const yBase = 6.0;
  // Octagonal mossy stone shrine dais (fits strictly inside r=2.0 obstacle)
  sb.addCylinder(0, yBase + 0.16, 0, 1.92, 1.72, 0.32, 8, SCENERY_COLORS.stoneCarved);
  sb.addCylinder(0, yBase + 0.42, 0, 1.56, 1.36, 0.22, 8, SCENERY_COLORS.mossRock);
  // Flared exposed sacred roots gripping the shrine terrace
  for (let r = 0; r < 6; r++) {
    const a = (r * Math.PI * 2) / 6 + 0.25;
    sb.addSegmentCylinder(0, yBase + 1.05, 0, Math.cos(a) * 1.58, yBase + 0.46, Math.sin(a) * 1.58, 0.24, 0.08, 6, SCENERY_COLORS.trunkDark);
  }

  // Tall, slender, sinuous sacred tree trunk rising from Y=6.45 to Y=18.8m
  const pts = [
    [0.00, 6.45, 0.00, 0.54],
    [0.18, 8.60, 0.10, 0.41],
    [-0.14, 11.10, -0.12, 0.33],
    [-0.22, 13.70, 0.16, 0.26],
    [0.12, 16.30, 0.08, 0.20],
    [0.04, 18.80, -0.04, 0.14]
  ];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i], p1 = pts[i + 1];
    sb.addSegmentCylinder(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], p0[3], p1[3], 8, i % 2 === 0 ? SCENERY_COLORS.trunkDark : SCENERY_COLORS.trunkWarm);
  }

  // Sweeping graceful blossom boughs high overhead (Y = 11.8..19.5m)
  const boughs = [
    [0.0, 18.8, 0.0, 2.2, 20.6, 1.1, 0.15, 0.05],
    [0.0, 18.8, 0.0, -2.0, 20.4, -1.3, 0.14, 0.05],
    [0.12, 16.3, 0.08, 3.3, 18.2, -1.2, 0.16, 0.05],
    [-0.22, 13.7, 0.16, -3.2, 16.4, 1.8, 0.17, 0.05],
    [-0.14, 11.1, -0.12, 2.8, 14.2, -2.6, 0.16, 0.05],
    [0.18, 10.2, 0.10, 0.0, 11.4, 2.15, 0.14, 0.06]
  ];
  for (let i = 0; i < boughs.length; i++) {
    const [x1, y1, z1, x2, y2, z2, r1, r2] = boughs[i];
    sb.addSegmentCylinder(x1, y1, z1, x2, y2, z2, r1, r2, 6, SCENERY_COLORS.trunkWarm);
    if (i < 5) {
      const ph = i * 1.15;
      fb.addSoftDome(x2, y2 + 0.55, z2, 2.15, 1.25, 2.15, ph, jitterColor(SCENERY_COLORS.sakuraPink, 0.03, rng), 0.72, ph, 10);
      fb.addSoftDome(x2 + 0.4, y2 + 1.05, z2 - 0.3, 1.45, 0.92, 1.45, ph + 0.7, SCENERY_COLORS.sakuraLight, 0.90, ph + 0.3, 9);
      fb.addSoftDome(x2 - 0.5, y2 + 0.15, z2 + 0.4, 1.35, 0.85, 1.35, ph + 1.4, SCENERY_COLORS.sakuraDeep, 0.65, ph + 0.5, 9);
      // Draped swaying blossom streamers & warm shrine lantern gems
      for (let g = 0; g < 3; g++) {
        const ga = ph + g * 2.1;
        const gx = x2 + Math.cos(ga) * 1.25, gz = z2 + Math.sin(ga) * 1.25;
        fb.addCone(gx, y2 - 0.55, gz, 0.18, -1.35, 6, SCENERY_COLORS.sakuraLight, 0.95, 0.20, ga);
      }
      fb.addOctahedron(x2 * 0.75, y2 - 0.48, z2 * 0.75, 0.16, 0.22, 0.16, i, PALETTE.lanternCore, 0.88, ph);
      staticGlows.push({ x: x2 * 0.75, y: y2 - 0.48, z: z2 * 0.75, size: 2.3, color: PALETTE.lanternLit, alpha: 0.68 });
      staticGlows.push({ x: x2, y: y2 + 0.7, z: z2, size: 4.5, color: SCENERY_COLORS.sakuraPink, alpha: 0.32 });
    }
  }
  // Luminous crown summit cloud
  fb.addSoftDome(0, 20.6, 0, 2.75, 1.55, 2.75, 0.3, SCENERY_COLORS.sakuraPink, 0.85, 0.5, 10);
  fb.addSoftDome(0.3, 21.4, -0.2, 1.85, 1.15, 1.85, 1.1, SCENERY_COLORS.sakuraLight, 1.0, 0.9, 9);

  // Sacred Golden Temple Bell suspended gracefully beneath forward bough (0, 11.4, 2.15)
  fb.addSegmentCylinder(0, 11.4, 2.05, 0, 10.65, 2.05, 0.035, 0.03, 5, PALETTE.goldUi, 0.2, 0.6, 0.4);
  fb.addCone(0, 10.35, 2.05, 0.44, 0.72, 10, PALETTE.goldUi, 0.7, 0.3, 0.4);
  fb.addOctahedron(0, 9.95, 2.05, 0.18, 0.18, 0.18, 0, PALETTE.lanternCore, 0.8, 0.4);
  staticGlows.push({ x: 0, y: 10.35, z: 2.05, size: 3.4, color: PALETTE.goldUi, alpha: 0.75 });
}

function addBanyanOrWillowTree(sb, fb, x, y, z, scale, rng, isWillow, staticGlows = null, colliders = null, forceSakura = false) {
  const phase = rng() * Math.PI * 2;
  const rotY = rng() * Math.PI * 2;
  const h = (3.1 + rng() * 1.15) * scale;
  const lean1X = (rng() - 0.5) * 0.48 * scale;
  const lean1Z = (rng() - 0.5) * 0.48 * scale;
  const p1 = [x + lean1X, y + h * 0.36, z + lean1Z];
  const p2 = [x + lean1X * 0.45 + (rng() - 0.5) * 0.32 * scale, y + h * 0.72, z + lean1Z * 0.45 + (rng() - 0.5) * 0.32 * scale];
  const p3 = [p2[0] + (rng() - 0.5) * 0.22 * scale, y + h, p2[2] + (rng() - 0.5) * 0.22 * scale];

  // Smoothly jointed 3-segment curved organic trunk
  sb.addSegmentCylinder(x, y, z, p1[0], p1[1], p1[2], 0.31 * scale, 0.22 * scale, 7, jitterColor(SCENERY_COLORS.trunkDark, 0.03, rng));
  sb.addSegmentCylinder(p1[0], p1[1], p1[2], p2[0], p2[1], p2[2], 0.22 * scale, 0.15 * scale, 7, jitterColor(SCENERY_COLORS.trunkWarm, 0.03, rng));
  sb.addSegmentCylinder(p2[0], p2[1], p2[2], p3[0], p3[1], p3[2], 0.15 * scale, 0.09 * scale, 6, jitterColor(SCENERY_COLORS.trunkWarm, 0.03, rng));

  // Tapered gnarled roots gripping soil
  for (let r = 0; r < 5; r++) {
    const ra = rotY + (r * Math.PI * 2) / 5;
    sb.addSegmentCylinder(x, y + 0.34 * scale, z, x + Math.cos(ra) * 0.64 * scale, y + 0.04 * scale, z + Math.sin(ra) * 0.64 * scale, 0.14 * scale, 0.05 * scale, 5, SCENERY_COLORS.trunkDark);
  }

  // Forked limbs reaching into canopy
  const branchTips = [];
  for (let b = 0; b < 4; b++) {
    const ba = rotY + (b * Math.PI * 2) / 4 + 0.3;
    const lenR = (0.85 + rng() * 0.35) * scale;
    const tipX = p2[0] + Math.cos(ba) * lenR;
    const tipY = p2[1] + (0.68 + rng() * 0.32) * scale;
    const tipZ = p2[2] + Math.sin(ba) * lenR;
    sb.addSegmentCylinder(p2[0], p2[1], p2[2], tipX, tipY, tipZ, 0.10 * scale, 0.045 * scale, 5, SCENERY_COLORS.trunkWarm);
    branchTips.push([tipX, tipY, tipZ, ba]);
  }

  // Rich canopy palette: 48% Blooming Cherry Blossom (Sakura), 28% Golden Ginkgo, 24% Emerald Banyan/Willow
  const tintRoll = rng();
  const isSakura = forceSakura || tintRoll < 0.48;
  const isGinkgo = !isSakura && tintRoll < 0.76;
  const leafMain = isSakura ? SCENERY_COLORS.sakuraPink : isGinkgo ? SCENERY_COLORS.ginkgoGold : (isWillow ? SCENERY_COLORS.leafBright : SCENERY_COLORS.leafMid);
  const leafTop = isSakura ? SCENERY_COLORS.sakuraLight : isGinkgo ? SCENERY_COLORS.ginkgoBright : SCENERY_COLORS.leafBright;
  const leafShade = isSakura ? SCENERY_COLORS.sakuraDeep : isGinkgo ? [0.85, 0.54, 0.12] : SCENERY_COLORS.leafDeep;

  // Soft mossy earth hillock + lush underbrush
  sb.addSoftDome(x, y - 0.06, z, 1.55 * scale, 0.28 * scale, 1.55 * scale, rotY, jitterColor(SCENERY_COLORS.grassRoot, 0.03, rng));
  for (let u = 0; u < 2; u++) {
    const ua = rotY + u * 2.5 + 0.6;
    fb.addSoftDome(x + Math.cos(ua) * 0.68 * scale, y + 0.14 * scale, z + Math.sin(ua) * 0.68 * scale, 0.46 * scale, 0.32 * scale, 0.44 * scale, ua, jitterColor(isSakura ? SCENERY_COLORS.leafMid : leafShade, 0.03, rng), 0.35, phase + u);
  }

  // Multi-tiered soft blossom/foliage clouds anchored on boughs
  fb.addSoftDome(p3[0], p3[1] + 0.52 * scale, p3[2], 1.72 * scale, 1.05 * scale, 1.72 * scale, rotY, jitterColor(leafMain, 0.04, rng), 0.72, phase);
  fb.addSoftDome(p3[0] + 0.38 * scale, p3[1] + 1.02 * scale, p3[2] - 0.28 * scale, 1.24 * scale, 0.85 * scale, 1.24 * scale, rotY + 0.8, jitterColor(leafTop, 0.03, rng), 0.92, phase + 0.4);
  for (let p = 0; p < branchTips.length; p++) {
    const [fx, fy, fz, pa] = branchTips[p];
    fb.addSoftDome(fx, fy + 0.22 * scale, fz, 0.95 * scale, 0.68 * scale, 0.95 * scale, pa, jitterColor(p % 2 === 0 ? leafMain : leafShade, 0.03, rng), 0.78, phase + p * 0.5);
    if (isWillow || isSakura) {
      // Tapered graceful hanging tendrils (no boxy slabs!)
      fb.addCone(fx + Math.cos(pa) * 0.28 * scale, fy - 0.52 * scale, fz + Math.sin(pa) * 0.28 * scale, 0.12 * scale, -1.25 * scale, 5, jitterColor(leafTop, 0.03, rng), 1.05, 0.25, phase + p);
    }
  }

  // Scattered fallen pink cherry blossom petals (diamond-ellipses) beneath Sakura trees
  if (isSakura && colliders) {
    for (let sp = 0; sp < 7; sp++) {
      const sa = rng() * Math.PI * 2;
      const sr = 0.65 + rng() * 1.9 * scale;
      sb.addOctahedron(x + Math.cos(sa) * sr, y + 0.02, z + Math.sin(sa) * sr, 0.09, 0.015, 0.06, sa, jitterColor(SCENERY_COLORS.sakuraPetal, 0.04, rng));
    }
  }

  // Hanging golden silk lantern on outer tree bough + canopy glow aura
  const lanTip = branchTips[0];
  const lx = lanTip[0], lz = lanTip[2], ly = lanTip[1] - 0.22;
  fb.addSegmentCylinder(lanTip[0], lanTip[1], lanTip[2], lx, ly, lz, 0.025, 0.02, 4, PALETTE.wood, 0.2, 0.85, phase);
  fb.addOctahedron(lx, ly - 0.12, lz, 0.18 * scale, 0.23 * scale, 0.18 * scale, lanTip[3], PALETTE.lanternCore, 0.9, phase);
  if (staticGlows) {
    staticGlows.push({ x: lx, y: ly - 0.12, z: lz, size: 1.85 * scale, color: PALETTE.lanternLit, alpha: 0.64 });
  }
  if (colliders) {
    colliders.push({ x, y, z, r: 0.42 * scale, h: 4.5 });
  }
}

function addArecaPalmTree(sb, fb, x, y, z, scale, rng, colliders = null) {
  const phase = rng() * Math.PI * 2;
  const rotY = rng() * Math.PI * 2;
  const h = (4.5 + rng() * 1.3) * scale;
  const curveX = (rng() - 0.5) * 0.85 * scale;
  const curveZ = (rng() - 0.5) * 0.85 * scale;
  const m1 = [x + curveX * 0.4, y + h * 0.5, z + curveZ * 0.4];
  const topX = x + curveX, topZ = z + curveZ, topY = y + h;
  sb.addSegmentCylinder(x, y, z, m1[0], m1[1], m1[2], 0.17 * scale, 0.13 * scale, 7, jitterColor(SCENERY_COLORS.palmTrunk, 0.03, rng));
  sb.addSegmentCylinder(m1[0], m1[1], m1[2], topX, topY, topZ, 0.13 * scale, 0.09 * scale, 7, jitterColor(SCENERY_COLORS.palmTrunk, 0.03, rng));
  fb.addCylinder(topX, topY + 0.25 * scale, topZ, 0.12 * scale, 0.14 * scale, 0.52 * scale, 6, SCENERY_COLORS.leafBright, 0, 0, 0.35, 0.5, phase);

  const frondCount = 7;
  for (let i = 0; i < frondCount; i++) {
    const a = rotY + (i * Math.PI * 2) / frondCount;
    const fCol = jitterColor(SCENERY_COLORS.palmLeaf, 0.04, rng);
    const rx1 = Math.cos(a) * 0.72 * scale;
    const rz1 = Math.sin(a) * 0.72 * scale;
    fb.addOctahedron(topX + rx1, topY + 0.55 * scale, topZ + rz1, 0.75 * scale, 0.07 * scale, 0.22 * scale, -a, fCol, 0.75, phase + i * 0.3);
    const rx2 = Math.cos(a) * 1.48 * scale;
    const rz2 = Math.sin(a) * 1.48 * scale;
    fb.addOctahedron(topX + rx2, topY + 0.28 * scale, topZ + rz2, 0.65 * scale, 0.05 * scale, 0.15 * scale, -a, jitterColor(SCENERY_COLORS.leafBright, 0.03, rng), 1.15, phase + i * 0.3);
  }
  if (colliders) {
    colliders.push({ x, y, z, r: 0.36 * scale, h: 4.5 });
  }
}

function addHighlandPineTree(sb, fb, x, y, z, scale, rng, colliders = null) {
  const phase = rng() * Math.PI * 2;
  const rotY = rng() * Math.PI * 2;
  const h = (3.6 + rng() * 1.3) * scale;
  const tipX = x + (rng() - 0.5) * 0.35 * scale, tipZ = z + (rng() - 0.5) * 0.35 * scale;
  sb.addSegmentCylinder(x, y, z, tipX, y + h, tipZ, 0.23 * scale, 0.08 * scale, 7, jitterColor(SCENERY_COLORS.trunkDark, 0.03, rng));
  for (let r = 0; r < 4; r++) {
    const ra = rotY + (r * Math.PI * 2) / 4;
    sb.addSegmentCylinder(x, y + 0.26 * scale, z, x + Math.cos(ra) * 0.45 * scale, y + 0.03, z + Math.sin(ra) * 0.45 * scale, 0.10 * scale, 0.03 * scale, 5, SCENERY_COLORS.trunkDark);
  }
  sb.addSoftDome(x, y - 0.05, z, 1.25 * scale, 0.24 * scale, 1.25 * scale, rotY, SCENERY_COLORS.grassRoot);
  for (let tier = 0; tier < 4; tier++) {
    const tFrac = tier / 3;
    const ty = y + h * (0.48 + tier * 0.19);
    const rad = (1.68 - tFrac * 0.92) * scale;
    const coneH = (1.05 - tFrac * 0.22) * scale;
    const cx = x + (tipX - x) * (0.4 + tFrac * 0.6);
    const cz = z + (tipZ - z) * (0.4 + tFrac * 0.6);
    fb.addCone(cx, ty, cz, rad, coneH, 8, jitterColor(SCENERY_COLORS.pineLeaf, 0.04, rng), 0.45 + tier * 0.2, 0.75 + tier * 0.2, phase + tier * 0.5);
  }
  fb.addSoftDome(tipX, y + h * 0.96, tipZ, 0.48 * scale, 0.38 * scale, 0.48 * scale, rotY, SCENERY_COLORS.leafMid, 0.95, phase);
  if (colliders) {
    colliders.push({ x, y, z, r: 0.38 * scale, h: 4.5 });
  }
}

function addBoulderAndPebbleCluster(sb, fb, x, y, z, scale, rng, staticGlows = null, colliders = null) {
  const rotY = rng() * Math.PI * 2;
  const rx = (0.55 + rng() * 0.55) * scale;
  const ry = (0.35 + rng() * 0.38) * scale;
  const rz = (0.50 + rng() * 0.50) * scale;
  sb.addSoftDome(x, y + ry * 0.45, z, rx, ry, rz, rotY, jitterColor(SCENERY_COLORS.mossRock, 0.05, rng));
  if (rng() > 0.35) {
    sb.addSoftDome(x + rx * 0.7, y + 0.12, z - rz * 0.5, rx * 0.45, ry * 0.38, rz * 0.42, rotY + 0.7, SCENERY_COLORS.pebbleWarm);
    fb.addGrassTuft(x - rx * 0.85, y, z + rz * 0.55, 1.0, rng() * 6.28, rng);
  }
  if (staticGlows && rng() > 0.45) {
    addMushroomAndFernCluster(sb, fb, x + rx * 0.75, y, z + rz * 0.65, 0.85, rng, staticGlows);
  }
  if (colliders) {
    colliders.push({ x, y, z, r: Math.max(rx, rz) * 0.85, h: ry * 1.35 });
  }
}

function addPebble(sb, x, y, z, scale, rng) {
  const cPool = [SCENERY_COLORS.pebbleGrey, SCENERY_COLORS.pebbleWarm, SCENERY_COLORS.pebbleDark];
  const col = jitterColor(cPool[Math.floor(rng() * cPool.length)], 0.04, rng);
  const rx = (0.09 + rng() * 0.14) * scale;
  const ry = (0.045 + rng() * 0.06) * scale;
  const rz = (0.08 + rng() * 0.13) * scale;
  sb.addOctahedron(x, y + ry * 0.35, z, rx, ry, rz, rng() * Math.PI * 2, col);
}

function addIslandDepthStrata(night, sb, fb, rng, staticGlows) {
  const discCenters = night === 2 ? [[0, 27.6], [70, 27.6]] : [[0, night === 1 ? 39.4 : 44.3]];

  for (const [cx, rimR] of discCenters) {
    // 1. Beveled Rim Mossy Swells (24 segments softening sharp island cylinder rims)
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2 + (rng() - 0.5) * 0.06;
      const rx = cx + Math.cos(a) * (rimR - 0.35);
      const rz = Math.sin(a) * (rimR - 0.35);
      if (night === 2 && rx >= 24.5 && rx <= 45.5 && Math.abs(rz) <= 3.6) continue;
      if (night === 1 && Math.abs(rx) < 3.4 && rz < -36.5) continue;
      sb.addSoftDome(rx, -0.18, rz, 2.8, 0.48, 2.0, a, jitterColor(SCENERY_COLORS.grassRoot, 0.03, rng));
    }

    // 2. Under-Cliff Layered Rock Strata, Hanging Stalactite Ribs & Luminous Crevice Crystals (18 buttresses)
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + rng() * 0.12;
      const shelfR = rimR * (0.74 + (i % 3) * 0.09);
      const sx = cx + Math.cos(a) * shelfR;
      const sz = Math.sin(a) * shelfR;
      const sy = -1.6 - (i % 3) * 1.45 - rng() * 0.8;
      sb.addSoftDome(sx, sy, sz, 2.9 + rng() * 1.5, 1.25 + rng() * 0.65, 2.7 + rng() * 1.3, a, jitterColor(SCENERY_COLORS.cliffDeep, 0.04, rng));
      const coneH = 3.0 + rng() * 2.8;
      sb.addCone(sx, sy - coneH * 0.45, sz, 1.3 + rng() * 0.8, -coneH, 6, jitterColor(SCENERY_COLORS.mossRock, 0.04, rng));
      if (i % 3 === 0) {
        const gCol = i % 6 === 0 ? SCENERY_COLORS.crystalCyan : SCENERY_COLORS.crystalAmber;
        const gx = sx + Math.cos(a) * 0.85, gz = sz + Math.sin(a) * 0.85;
        sb.addOctahedron(gx, sy - 0.8, gz, 0.28, 0.52, 0.28, a, gCol);
        staticGlows.push({ x: gx, y: sy - 0.8, z: gz, size: 3.2, color: gCol, alpha: 0.46 });
      }
    }
  }

  // Night 3 upper cliff rims (Tier 1 semicircle & Tier 2 sanctuary)
  if (night === 3) {
    for (let i = 0; i < 16; i++) {
      const a = 0.08 + (i / 15) * (Math.PI - 0.16);
      if (Math.abs(a - Math.PI / 6) < 0.16 || Math.abs(a - (5 * Math.PI) / 6) < 0.16) continue;
      sb.addSoftDome(Math.cos(a) * 23.6, 2.82, Math.sin(a) * 23.6, 2.1, 0.42, 1.5, a, jitterColor(SCENERY_COLORS.grassRoot, 0.03, rng));
    }
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      sb.addSoftDome(Math.cos(a) * 7.8, 5.88, Math.sin(a) * 7.8, 1.25, 0.34, 1.05, a, jitterColor(SCENERY_COLORS.grassRoot, 0.03, rng));
    }
  }
}

function addPerimeterRimScenery(night, sb, fb, cfg, rng, staticGlows, colliders) {
  const discCenters = night === 2 ? [[0, 27.6], [70, 27.6]] : [[0, night === 1 ? 39.4 : 44.3]];

  // 1. Cascading Cliff-Edge Hanging Vines draping into the cloud mist
  for (let i = 0; i < 28; i++) {
    const [cx, rimR] = discCenters[i % discCenters.length];
    const a = (i / 28) * Math.PI * 2 + rng() * 0.12;
    const vx = cx + Math.cos(a) * (rimR + 0.2);
    const vz = Math.sin(a) * (rimR + 0.2);
    if (night === 2 && vx >= 24.5 && vx <= 45.5 && Math.abs(vz) <= 3.4) continue;
    if (night === 1 && Math.abs(vx) < 3.0 && vz < -37.0) continue;
    const len = 1.8 + rng() * 2.1;
    const ph = rng() * Math.PI * 2;
    fb.addCone(vx, -len * 0.5, vz, 0.12, -len, 5, jitterColor(SCENERY_COLORS.cloverGreen, 0.05, rng), 1.15, 0.12, ph);
    if (rng() > 0.45) {
      fb.addCone(vx + Math.sin(a) * 0.3, -len * 0.35, vz - Math.cos(a) * 0.3, 0.09, -len * 0.72, 5, SCENERY_COLORS.leafBright, 0.95, 0.15, ph + 0.8);
    }
  }

  // 2. Tall Wind-Swaying Rim Reed Beds (Cỏ lau ven đảo)
  for (let i = 0; i < 20; i++) {
    const [cx, rimR] = discCenters[i % discCenters.length];
    const a = rng() * Math.PI * 2;
    const rx = cx + Math.cos(a) * (rimR - 1.4 - rng() * 2.2);
    const rz = Math.sin(a) * (rimR - 1.4 - rng() * 2.2);
    const ry = isSafeFlatGround(night, rx, rz);
    if (ry === null || !isClearOfGameplay(night, rx, rz, cfg, 2.4)) continue;
    const ph = rng() * Math.PI * 2;
    for (let s = 0; s < 3; s++) {
      const sx = rx + (rng() - 0.5) * 0.55;
      const sz = rz + (rng() - 0.5) * 0.55;
      const h = 1.25 + rng() * 0.65;
      fb.addCylinder(sx, ry + h * 0.5, sz, 0.032, 0.015, h, 4, SCENERY_COLORS.leafMid, 0, 0, 0, 0.95, ph + s * 0.4);
      fb.addOctahedron(sx, ry + h + 0.14, sz, 0.08, 0.24, 0.08, s, SCENERY_COLORS.reedPlume, 1.05, ph + s * 0.4);
    }
  }

  // 3. Glowing Spirit Crystal Clusters around rocky island overlooks
  for (let i = 0; i < 12; i++) {
    const [cx, rimR] = discCenters[i % discCenters.length];
    const a = (i / 12) * Math.PI * 2 + rng() * 0.2;
    const rx = cx + Math.cos(a) * (rimR - 1.8 - rng() * 3.5);
    const rz = Math.sin(a) * (rimR - 1.8 - rng() * 3.5);
    const ry = isSafeFlatGround(night, rx, rz);
    if (ry === null || !isClearOfGameplay(night, rx, rz, cfg, 2.6)) continue;
    const isCyan = i % 2 === 0;
    const cCol = isCyan ? SCENERY_COLORS.crystalCyan : SCENERY_COLORS.crystalAmber;
    sb.addOctahedron(rx, ry + 0.14, rz, 0.55, 0.25, 0.55, a, SCENERY_COLORS.mossRock);
    for (let c = 0; c < 3; c++) {
      const ca = a + c * 2.1;
      const cxOff = rx + Math.cos(ca) * 0.18, czOff = rz + Math.sin(ca) * 0.18;
      const ch = 0.42 + rng() * 0.45;
      sb.addOctahedron(cxOff, ry + 0.18 + ch * 0.45, czOff, 0.14, ch * 0.55, 0.14, ca, cCol);
    }
    staticGlows.push({ x: rx, y: ry + 0.55, z: rz, size: 2.1, color: cCol, alpha: 0.55 });
    colliders.push({ x: rx, y: ry, z: rz, r: 0.55, h: 1.1 });
  }

  // 4. Decorative Rim Overlook Lantern Posts
  for (let i = 0; i < 8; i++) {
    const [cx, rimR] = discCenters[i % discCenters.length];
    const a = (i / 8) * Math.PI * 2 + 0.28;
    const rx = cx + Math.cos(a) * (rimR - 1.2);
    const rz = Math.sin(a) * (rimR - 1.2);
    const ry = isSafeFlatGround(night, rx, rz);
    if (ry === null || !isClearOfGameplay(night, rx, rz, cfg, 2.8)) continue;
    // Graceful sculpted rim overlook lanterns (no boxy posts!)
    sb.addCylinder(rx, ry + 0.2, rz, 0.26, 0.20, 0.4, 6, SCENERY_COLORS.stoneCarved);
    const topArmX = rx + Math.cos(a) * 0.35, topArmZ = rz + Math.sin(a) * 0.35;
    sb.addSegmentCylinder(rx, ry + 0.35, rz, rx, ry + 2.02, rz, 0.08, 0.055, 6, SCENERY_COLORS.trunkDark);
    sb.addSegmentCylinder(rx, ry + 2.0, rz, topArmX, ry + 2.05, topArmZ, 0.045, 0.03, 5, SCENERY_COLORS.trunkWarm);
    fb.addOctahedron(topArmX, ry + 1.75, topArmZ, 0.18, 0.24, 0.18, a, PALETTE.lanternCore, 0.65, a);
    staticGlows.push({ x: topArmX, y: ry + 1.75, z: topArmZ, size: 2.05, color: PALETTE.lanternLit, alpha: 0.70 });
    colliders.push({ x: rx, y: ry, z: rz, r: 0.38, h: 2.0 });
  }
}

function addOuterArchipelagoScenery(night, sb, fb, rng, staticGlows) {
  const centerOffsetX = night === 2 ? 35 : 0;

  // 1. 10 Outer Floating Karst Peaks, Pagodas & Cascading Cloud-Waterfalls
  const isletCount = 10;
  for (let i = 0; i < isletCount; i++) {
    const a = (i * Math.PI * 2) / isletCount + rng() * 0.22;
    const dist = 54 + (i % 3) * 18 + rng() * 14;
    const ix = centerOffsetX + Math.cos(a) * dist;
    const iz = Math.sin(a) * dist;
    const iy = -4.0 + (i % 4) * 3.8 + (rng() - 0.5) * 2.5;
    const ir = 4.6 + rng() * 6.4;

    // Floating craggy base & soft mossy dome island top
    sb.addCone(ix, iy - ir * 0.72, iz, ir, -ir * 1.65, 7, SCENERY_COLORS.trunkDark);
    sb.addCone(ix + ir * 0.35, iy - ir * 0.45, iz - ir * 0.25, ir * 0.52, -ir * 1.1, 6, SCENERY_COLORS.mossRock);
    sb.addSoftDome(ix, iy + 0.08, iz, ir * 1.04, 0.85, ir * 1.04, a, SCENERY_COLORS.grassRoot);

    // Tall karst limestone spire peak on alternating islands
    if (i % 2 === 1) {
      sb.addCone(ix - ir * 0.28, iy + ir * 0.65, iz + ir * 0.18, ir * 0.38, ir * 1.45, 7, SCENERY_COLORS.mossRock);
      addHighlandPineTree(sb, fb, ix + ir * 0.25, iy + 0.45, iz - ir * 0.18, 0.75, rng);
    }

    // Scenic pine trees on floating islets
    addHighlandPineTree(sb, fb, ix + (rng() - 0.5) * 1.6, iy + 0.45, iz + (rng() - 0.5) * 1.6, 0.85, rng);
    if (ir > 6.5) {
      addHighlandPineTree(sb, fb, ix - ir * 0.42, iy + 0.45, iz + ir * 0.3, 0.65, rng);
    }

    // 3 Distant Multi-Tier Ancient Pagodas (Tháp Chùa Cổ) with glowing beacons
    if (i === 0 || i === 3 || i === 7) {
      sb.addTransformedBox(ix, iy + 0.85, iz, 2.2, 0.9, 2.2, a, 0, 0, SCENERY_COLORS.stoneCarved);
      for (let tier = 0; tier < 3; tier++) {
        const ty = iy + 1.65 + tier * 1.45;
        const w = 1.9 - tier * 0.42;
        sb.addTransformedBox(ix, ty, iz, w, 1.1, w, a, 0, 0, PALETTE.wood);
        sb.addCone(ix, ty + 0.75, iz, w * 1.15, 0.75, 4, SCENERY_COLORS.roofTile);
      }
      const topY = iy + 6.35;
      sb.addCone(ix, topY, iz, 0.22, 1.0, 6, PALETTE.goldUi);
      staticGlows.push({ x: ix, y: iy + 3.4, z: iz, size: 4.2, color: PALETTE.lanternLit, alpha: 0.72 });
      staticGlows.push({ x: ix, y: topY + 0.2, z: iz, size: 2.2, color: PALETTE.lanternCore, alpha: 0.85 });
    }

    // 3 Cascading Waterfalls pouring from islet cliffs into Sea of Clouds
    if (i === 2 || i === 5 || i === 8) {
      const toCenterAngle = Math.atan2(-iz, centerOffsetX - ix);
      const wx = ix + Math.cos(toCenterAngle) * (ir * 0.85);
      const wz = iz + Math.sin(toCenterAngle) * (ir * 0.85);
      const dropH = 14.0;
      fb.addTransformedBox(wx, iy - dropH * 0.48, wz, 0.16, dropH, 1.85, -toCenterAngle, 0, 0, SCENERY_COLORS.waterfallWater, 0.65, 0.15, i);
      staticGlows.push({ x: wx, y: iy + 0.1, z: wz, size: 3.4, color: SCENERY_COLORS.waterfallWater, alpha: 0.48 });
      staticGlows.push({ x: wx, y: iy - dropH + 1.0, z: wz, size: 6.2, color: SCENERY_COLORS.waterfallWater, alpha: 0.36 });
    }

    // Garden stone lanterns on outer cherry-blossom & pine islets (no Torii gates)
    if (i === 1 || i === 6) {
      const toCenterAngle = Math.atan2(-iz, centerOffsetX - ix);
      addBanyanOrWillowTree(sb, fb, ix + 0.6, iy + 0.45, iz - 0.4, 0.9, rng, false, staticGlows, null, true);
      addGardenStoneLantern(sb, fb, ix - 0.8, iy + 0.45, iz + 0.8, toCenterAngle, staticGlows, null);
    }
  }

  // 2. 14 Giant Floating Lotus Lanterns hovering above the Sea of Clouds (Hoa đăng sen)
  for (let i = 0; i < 14; i++) {
    const a = (i * Math.PI * 2) / 14 + rng() * 0.18;
    const dist = 45 + rng() * 25;
    const lx = centerOffsetX + Math.cos(a) * dist;
    const lz = Math.sin(a) * dist;
    const ly = -4.2 + rng() * 2.4;
    const sc = 0.85 + rng() * 0.5;
    const ph = rng() * Math.PI * 2;
    for (let p = 0; p < 6; p++) {
      const pa = (p * Math.PI * 2) / 6 + a;
      const px = lx + Math.cos(pa) * 0.55 * sc;
      const pz = lz + Math.sin(pa) * 0.55 * sc;
      fb.addOctahedron(px, ly + 0.18 * sc, pz, 0.35 * sc, 0.42 * sc, 0.22 * sc, pa, SCENERY_COLORS.flowerLotus, 0.45, ph);
    }
    fb.addOctahedron(lx, ly + 0.32 * sc, lz, 0.32 * sc, 0.35 * sc, 0.32 * sc, a, PALETTE.lanternCore, 0.45, ph);
    staticGlows.push({ x: lx, y: ly + 0.4 * sc, z: lz, size: 3.4 * sc, color: SCENERY_COLORS.flowerLotus, alpha: 0.62 });
  }

  // 3. Far Parallax Horizon Mountain Range (14 distant misty twin-peak mountain silhouettes at 108..148m)
  for (let i = 0; i < 14; i++) {
    const a = (i * Math.PI * 2) / 14 + rng() * 0.16;
    const dist = 108 + (i % 3) * 14 + rng() * 12;
    const mx = centerOffsetX + Math.cos(a) * dist;
    const mz = Math.sin(a) * dist;
    const baseY = -12.0 + rng() * 4.0;
    const rad = 18.0 + rng() * 14.0;
    const h = 22.0 + rng() * 16.0;
    const pCol = i % 2 === 0 ? SCENERY_COLORS.distantPeak : SCENERY_COLORS.distantMistPeak;
    sb.addSoftDome(mx, baseY + h * 0.25, mz, rad * 1.12, h * 0.52, rad * 1.12, a, SCENERY_COLORS.distantPeak);
    sb.addCone(mx, baseY + h * 0.52, mz, rad * 0.70, h * 0.95, 8, pCol);
    const sx = mx + Math.cos(a + 1.2) * rad * 0.65;
    const sz = mz + Math.sin(a + 1.2) * rad * 0.65;
    sb.addCone(sx, baseY + h * 0.42, sz, rad * 0.50, h * 0.72, 7, SCENERY_COLORS.distantMistPeak);
  }
}

function distToSegXZ(px, pz, ax, az, bx, bz) {
  const vx = bx - ax, vz = bz - az;
  const len2 = vx * vx + vz * vz;
  if (len2 < 1e-6) return Math.hypot(px - ax, pz - az);
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / len2));
  return Math.hypot(px - (ax + t * vx), pz - (az + t * vz));
}

function addNaturalGroundSurface(night, sb, cfg, rng) {
  const baseGrass = PALETTE.grass;
  const mossDeep = [0.14, 0.34, 0.27];
  const meadowBright = [0.24, 0.46, 0.34];
  const warmEarth = [0.35, 0.32, 0.23];
  const rimSand = [0.43, 0.39, 0.29];

  const paintVertexColor = (wx, wz, rimR, cx) => {
    const patch = Math.sin(wx * 0.24 + Math.cos(wz * 0.19) * 1.4) * Math.cos(wz * 0.22);
    const fine = Math.sin(wx * 0.82 - wz * 0.74) * 0.5 + 0.5;
    let r = baseGrass[0], g = baseGrass[1], b = baseGrass[2];
    const mix = (c, k) => {
      const w = Math.max(0, Math.min(1, k));
      r += (c[0] - r) * w;
      g += (c[1] - g) * w;
      b += (c[2] - b) * w;
    };
    if (patch > 0.1) mix(meadowBright, patch * 0.42);
    else if (patch < -0.1) mix(mossDeep, (-patch) * 0.45);
    mix(warmEarth, fine * 0.14);

    // Subtle earthen footpaths leading toward Great Lanterns & Night 1 harbor
    let minPathD = 999;
    const anchorX = night === 2 ? cx : 0;
    const anchorZ = 0;
    for (const l of cfg.lanterns) {
      if (night === 2 && Math.abs(l.pos[0] - cx) > 30) continue;
      minPathD = Math.min(minPathD, distToSegXZ(wx, wz, anchorX, anchorZ, l.pos[0], l.pos[2]));
    }
    if (night === 1) {
      minPathD = Math.min(minPathD, distToSegXZ(wx, wz, 0, 0, 0, -38.5));
    }
    if (minPathD < 2.1) {
      mix(warmEarth, (1 - minPathD / 2.1) * 0.58);
    }

    const rDist = Math.hypot(wx - cx, wz);
    if (rDist > rimR - 4.2) {
      mix(rimSand, ((rDist - (rimR - 4.2)) / 4.2) * 0.48);
    }
    const nJit = (rng() - 0.5) * 0.025;
    return [
      Math.min(1, Math.max(0, r + nJit)),
      Math.min(1, Math.max(0, g + nJit)),
      Math.min(1, Math.max(0, b + nJit))
    ];
  };

  const emitAnnularQuilt = (cx, ySurf, rMin, rMax, angStart, angSpan, rings, segs) => {
    sb.flushIfFull((rings + 1) * (segs + 1) + 16);
    const startIdx = sb.pos.length / 3;
    const rimRef = Math.max(rMax, 8);
    for (let ir = 0; ir <= rings; ir++) {
      const fr = ir / rings;
      const rad = rMin + (rMax - rMin) * fr;
      for (let is = 0; is <= segs; is++) {
        const ang = angStart + (is / segs) * angSpan;
        const wx = cx + Math.cos(ang) * rad;
        const wz = Math.sin(ang) * rad;
        const col = paintVertexColor(wx, wz, rimRef, cx);
        const nx = Math.sin(wx * 0.35 + wz * 0.25) * 0.06;
        const nz = Math.cos(wz * 0.35 - wx * 0.25) * 0.06;
        const len = Math.hypot(nx, 1.0, nz) || 1;
        sb.pushVert(wx, ySurf, wz, nx / len, 1.0 / len, nz / len, col, 0, 0);
      }
    }
    const row = segs + 1;
    for (let ir = 0; ir < rings; ir++) {
      for (let is = 0; is < segs; is++) {
        const a = startIdx + ir * row + is;
        const b = a + row;
        sb.idx.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
  };

  if (night === 1) {
    emitAnnularQuilt(0, 0.012, 0.0, 39.4, 0, Math.PI * 2, 10, 32);
  } else if (night === 2) {
    emitAnnularQuilt(0, 0.012, 0.0, 27.5, 0, Math.PI * 2, 8, 28);
    emitAnnularQuilt(70, 0.012, 0.0, 27.5, 0, Math.PI * 2, 8, 28);
  } else if (night === 3) {
    emitAnnularQuilt(0, 0.012, 7.6, 44.3, 0, Math.PI * 2, 9, 32);
    emitAnnularQuilt(0, 3.012, 12.2, 23.7, 0.03, Math.PI - 0.06, 4, 20);
    emitAnnularQuilt(0, 6.012, 0.0, 7.8, 0, Math.PI * 2, 3, 20);
  }
}

export function buildNightSceneryData(night) {
  const cfg = getNightConfig(night);
  const rng = createSceneryRng(9001 + night * 733);
  const sb = new SceneryBuilder();
  const fb = new SceneryBuilder();
  const staticGlows = [];
  const colliders = [];

  addNaturalGroundSurface(night, sb, cfg, rng);

  const flowerColors = [
    SCENERY_COLORS.flowerLotus,
    SCENERY_COLORS.flowerGold,
    SCENERY_COLORS.flowerWhite,
    SCENERY_COLORS.flowerLavender,
    SCENERY_COLORS.flowerCoral,
    SCENERY_COLORS.flowerCyan,
    SCENERY_COLORS.lampGrassCyan,
    SCENERY_COLORS.sakuraPink
  ];

  // 1. Handcrafted Landmark Structures per Night (No Torii gates — replaced with carved garden stone lanterns & curved stone paths!)
  if (night === 1) {
    addHarborPierAndBoat(sb, fb, staticGlows);
    addGardenStoneLantern(sb, fb, -2.4, 0, -9.2, 0.3, staticGlows, colliders);
    addGardenStoneLantern(sb, fb, 2.4, 0, -9.2, -0.3, staticGlows, colliders);
    addGardenStoneLantern(sb, fb, -2.3, 0, -35.5, 0.1, staticGlows, colliders);
    addGardenStoneLantern(sb, fb, 2.3, 0, -35.5, -0.1, staticGlows, colliders);
    for (const l of cfg.lanterns) {
      const steps = 7;
      for (let s = 1; s < steps; s++) {
        const t = (s / steps) * 0.84;
        const sx = l.pos[0] * t + (rng() - 0.5) * 0.35;
        const sz = l.pos[2] * t + (rng() - 0.5) * 0.35;
        if (Math.hypot(sx, sz) > 3.2) {
          sb.addOctahedron(sx, 0.02, sz, 0.42 + rng() * 0.15, 0.05, 0.34 + rng() * 0.12, Math.atan2(l.pos[2], l.pos[0]), SCENERY_COLORS.pebbleGrey);
        }
      }
    }
  } else if (night === 2) {
    addBridgeBambooArches(sb, fb, staticGlows);
    addGardenStoneLantern(sb, fb, 23.2, 0, -3.2, 0.2, staticGlows, colliders);
    addGardenStoneLantern(sb, fb, 23.2, 0, 3.2, -0.2, staticGlows, colliders);
    addGardenStoneLantern(sb, fb, 46.8, 0, -3.2, 0.2, staticGlows, colliders);
    addGardenStoneLantern(sb, fb, 46.8, 0, 3.2, -0.2, staticGlows, colliders);
  } else if (night === 3) {
    addNight3BellPavilionDecor(sb, fb, staticGlows);
    addNight3MountainRelief(sb, fb, cfg, rng, staticGlows, colliders);
    addNight3SacredCenterTree(sb, fb, rng, staticGlows);
    addGardenStoneLantern(sb, fb, -3.2, 0, -8.5, 0.2, staticGlows, colliders);
    addGardenStoneLantern(sb, fb, 3.2, 0, -8.5, -0.2, staticGlows, colliders);
  }

  const samplePos = () => {
    if (night === 2) {
      const cx = rng() < 0.5 ? 0 : 70;
      const r = 27.2 * Math.sqrt(rng());
      const a = rng() * Math.PI * 2;
      return [cx + Math.cos(a) * r, Math.sin(a) * r];
    }
    const maxR = night === 1 ? 39.0 : 44.0;
    const r = maxR * Math.sqrt(rng());
    const a = rng() * Math.PI * 2;
    return [Math.cos(a) * r, Math.sin(a) * r];
  };

  // 2. Trees (with Sakura cherry blossoms in all 3 Nights + colliders)
  const treeTarget = night === 1 ? 30 : night === 2 ? 32 : 34;
  let placedTrees = 0;
  for (let attempt = 0; attempt < 520 && placedTrees < treeTarget; attempt++) {
    let tx, tz;
    if (attempt < 24 && night !== 2) {
      const r = (night === 1 ? 32.5 : 37.5) + rng() * 5.0;
      const a = (attempt / 24) * Math.PI * 2 + (rng() - 0.5) * 0.25;
      tx = Math.cos(a) * r;
      tz = Math.sin(a) * r;
    } else {
      [tx, tz] = samplePos();
    }
    const y = isSafeFlatGround(night, tx, tz);
    if (y === null || !isClearOfGameplay(night, tx, tz, cfg, 3.7)) continue;

    const sc = 0.88 + rng() * 0.45;
    if (night === 1) {
      addBanyanOrWillowTree(sb, fb, tx, y, tz, sc, rng, rng() < 0.35, staticGlows, colliders, placedTrees % 2 === 0);
    } else if (night === 2) {
      if (rng() < 0.58) addArecaPalmTree(sb, fb, tx, y, tz, sc, rng, colliders);
      else addBanyanOrWillowTree(sb, fb, tx, y, tz, sc * 0.92, rng, false, staticGlows, colliders, true);
    } else {
      if (rng() < 0.55) addHighlandPineTree(sb, fb, tx, y, tz, sc, rng, colliders);
      else addBanyanOrWillowTree(sb, fb, tx, y, tz, sc * 0.92, rng, false, staticGlows, colliders, true);
    }
    placedTrees++;
  }

  // 3. Mossy Boulders + ferns & mushrooms + colliders
  const boulderTarget = 20;
  let placedBoulders = 0;
  for (let attempt = 0; attempt < 280 && placedBoulders < boulderTarget; attempt++) {
    const [bx, bz] = samplePos();
    const y = isSafeFlatGround(night, bx, bz);
    if (y === null || !isClearOfGameplay(night, bx, bz, cfg, 3.3)) continue;
    addBoulderAndPebbleCluster(sb, fb, bx, y, bz, 0.85 + rng() * 0.65, rng, (placedBoulders % 2 === 0 ? staticGlows : null), colliders);
    placedBoulders++;
  }

  // Extra Micro-Details: Woodland Glow Mushrooms & Lacy Ferns tucked across island
  for (let i = 0; i < 26; i++) {
    const [mx, mz] = samplePos();
    const my = isSafeFlatGround(night, mx, mz);
    if (my === null || !isClearOfGameplay(night, mx, mz, cfg, 2.0)) continue;
    addMushroomAndFernCluster(sb, fb, mx, my, mz, 0.8 + rng() * 0.45, rng, null);
  }

  // 4. Small Pebbles
  for (let i = 0; i < 160; i++) {
    let px, pz;
    if (i < 50 && cfg.lanterns.length > 0) {
      const l = cfg.lanterns[i % cfg.lanterns.length];
      const pa = rng() * Math.PI * 2;
      const pr = 1.4 + rng() * 3.0;
      px = l.pos[0] + Math.cos(pa) * pr;
      pz = l.pos[2] + Math.sin(pa) * pr;
    } else {
      [px, pz] = samplePos();
    }
    const y = isSafeFlatGround(night, px, pz);
    if (y === null) continue;
    addPebble(sb, px, y, pz, 0.8 + rng() * 0.75, rng);
  }

  // 5. Lush Wind-Swaying 3D Grass Meadows (slender single-triangle blades)
  for (let i = 0; i < 1350; i++) {
    const [gx, gz] = samplePos();
    const y = isSafeFlatGround(night, gx, gz);
    if (y === null || !isClearOfGameplay(night, gx, gz, cfg, 1.35)) continue;
    fb.addGrassTuft(gx, y, gz, 0.90 + rng() * 0.60, rng() * Math.PI * 2, rng);
  }

  // 6. Iconic Four-Leaf Clovers (Cỏ 4 lá may mắn) — near spawn + glades!
  for (let i = 0; i < 100; i++) {
    let cx, cz;
    if (i < 20) {
      const ra = (i / 20) * Math.PI * 2 + rng() * 0.2;
      const rr = 3.2 + rng() * 6.5;
      cx = cfg.spawn[0] + Math.cos(ra) * rr;
      cz = cfg.spawn[2] + Math.sin(ra) * rr;
    } else {
      [cx, cz] = samplePos();
    }
    const y = isSafeFlatGround(night, cx, cz);
    if (y === null || !isClearOfGameplay(night, cx, cz, cfg, 1.45)) continue;
    fb.addFourLeafCloverPatch(cx, y, cz, 0.95 + rng() * 0.45, rng() * Math.PI * 2, rng);
    if (i % 10 === 0) {
      staticGlows.push({ x: cx, y: y + 0.35, z: cz, size: 0.95, color: SCENERY_COLORS.cloverHighlight, alpha: 0.42 });
    }
  }

  // 7. Abundant Multi-Color Blooming Wildflowers (hoa rực rỡ khắp đảo)
  for (let i = 0; i < 250; i++) {
    let fx, fz;
    if (i < 35) {
      const ra = (i / 35) * Math.PI * 2 + rng() * 0.25;
      const rr = 2.9 + rng() * 8.0;
      fx = cfg.spawn[0] + Math.cos(ra) * rr;
      fz = cfg.spawn[2] + Math.sin(ra) * rr;
    } else {
      [fx, fz] = samplePos();
    }
    const y = isSafeFlatGround(night, fx, fz);
    if (y === null || !isClearOfGameplay(night, fx, fz, cfg, 1.45)) continue;
    const colorIdx = Math.floor(rng() * flowerColors.length);
    const fCol = flowerColors[colorIdx];
    fb.addFlowerCluster(fx, y, fz, fCol, 0.95 + rng() * 0.5, rng() * Math.PI * 2, rng);
    if (fCol === SCENERY_COLORS.lampGrassCyan) {
      staticGlows.push({
        x: fx, y: y + 0.45, z: fz,
        size: 1.45,
        color: fCol,
        alpha: 0.62
      });
    }
  }

  // 8. Island Depth Strata, Perimeter Rim Scenery & Expansive Outer World Archipelago
  addIslandDepthStrata(night, sb, fb, rng, staticGlows);
  addPerimeterRimScenery(night, sb, fb, cfg, rng, staticGlows, colliders);
  addOuterArchipelagoScenery(night, sb, fb, rng, staticGlows);

  sb.finalizeChunk();
  fb.finalizeChunk();

  // 9. 48 Multi-Color Dreamy Floating Air Fireflies
  const ambientSpores = [];
  const sporePalette = [
    PALETTE.moteCore,                 // Golden Honey
    [0.34, 0.98, 0.78],               // Mint Jade
    SCENERY_COLORS.sakuraPetal,       // Sakura Rose
    [0.42, 0.88, 1.0],                // Sky Cyan
    [0.78, 0.60, 1.0],                // Wisteria Violet
    [1.0, 0.66, 0.44],                // Peach Coral
    [0.98, 1.0, 0.56],                // Starlight Lemon
    [0.94, 0.96, 1.0]                 // Moon Pearl
  ];
  for (let i = 0; i < 48; i++) {
    const [sx, sz] = samplePos();
    const baseGround = getGroundHeight(night, sx, sz) ?? 0;
    ambientSpores.push({
      cx: sx,
      cy: baseGround + 0.75 + rng() * 5.2,
      cz: sz,
      ampX: 0.75 + rng() * 2.0,
      ampY: 0.35 + rng() * 1.1,
      ampZ: 0.75 + rng() * 2.0,
      speed: 0.35 + rng() * 0.75,
      phase: rng() * Math.PI * 2,
      size: 0.09 + rng() * 0.065,
      color: sporePalette[i % sporePalette.length]
    });
  }

  // 10. 16 Distant Ascending Sky Lanterns
  const centerOffsetX = night === 2 ? 35 : 0;
  const skyLanterns = [];
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI * 2) / 16 + rng() * 0.25;
    const dist = 46 + rng() * 38;
    skyLanterns.push({
      x: centerOffsetX + Math.cos(a) * dist,
      z: Math.sin(a) * dist,
      baseY: -3.0 + rng() * 26.0,
      speedY: 0.35 + rng() * 0.45,
      swayPhase: rng() * Math.PI * 2,
      scale: 0.55 + rng() * 0.45
    });
  }

  // 11. 8 Soaring Luminous Spirit Cranes gliding through the moonlit sky
  const spiritCranes = [];
  for (let i = 0; i < 8; i++) {
    spiritCranes.push({
      centerOffsetX,
      orbitR: 36 + (i % 4) * 14 + rng() * 6,
      baseY: 11 + (i % 3) * 5 + rng() * 4,
      speed: 0.08 + rng() * 0.06,
      phase: (i * Math.PI * 2) / 8 + rng() * 0.3,
      scale: 0.8 + rng() * 0.35
    });
  }

  // 12. 10 Celestial Aurora / Milky Way Star-River Nodes arching across the forward sky
  const auroraPalette = [
    [0.22, 0.86, 0.78],
    [0.54, 0.38, 0.95],
    [0.98, 0.82, 0.44]
  ];
  const auroraNodes = [];
  for (let i = 0; i < 10; i++) {
    const t = i / 9;
    const ax = centerOffsetX - 64 + t * 128 + Math.sin(t * Math.PI * 2.5) * 6;
    const ay = 19 + Math.sin(t * Math.PI) * 26 + Math.cos(t * 7.0) * 2.5;
    const az = 54 + Math.sin(t * Math.PI * 1.4) * 34;
    auroraNodes.push({
      x: ax,
      y: ay,
      z: az,
      size: 11 + (i % 3) * 1.5,
      color: auroraPalette[i % auroraPalette.length],
      alpha: 0.16 + 0.08 * Math.sin(t * Math.PI),
      phase: i * 0.45
    });
  }

  // 13. 10 Volumetric Soft-Blur Mist Banks & Optical Bokeh Depth Clouds
  const mistBanks = [];
  const mistColors = [SCENERY_COLORS.mistTeal, SCENERY_COLORS.mistLavender, SCENERY_COLORS.mistWarm];
  const discList = night === 2 ? [[0, 27.6], [70, 27.6]] : [[0, night === 1 ? 39.4 : 44.3]];

  for (let i = 0; i < 4; i++) {
    const [cx, rimR] = discList[i % discList.length];
    const a = (i * Math.PI * 2) / 4 + rng() * 0.25;
    const dist = rimR * (0.45 + rng() * 0.56);
    mistBanks.push({
      x: cx + Math.cos(a) * dist,
      y: -0.6 + rng() * 2.2,
      z: Math.sin(a) * dist,
      size: 5.5 + rng() * 2.5,
      color: mistColors[i % mistColors.length],
      alpha: 0.085 + rng() * 0.04,
      phase: rng() * Math.PI * 2,
      speed: 0.14 + rng() * 0.12,
      ampX: 0.9 + rng() * 1.1,
      ampY: 0.25 + rng() * 0.25
    });
  }
  for (let i = 0; i < 3; i++) {
    const [cx, rimR] = discList[i % discList.length];
    const a = (i * Math.PI * 2) / 3 + rng() * 0.2;
    const dist = rimR * (0.75 + rng() * 0.37);
    mistBanks.push({
      x: cx + Math.cos(a) * dist,
      y: -7.8 + rng() * 4.6,
      z: Math.sin(a) * dist,
      size: 8.5 + rng() * 2.5,
      color: i % 3 === 0 ? SCENERY_COLORS.mistLavender : SCENERY_COLORS.mistTeal,
      alpha: 0.12 + rng() * 0.05,
      phase: rng() * Math.PI * 2,
      speed: 0.10 + rng() * 0.10,
      ampX: 1.4 + rng() * 1.2,
      ampY: 0.3 + rng() * 0.3
    });
  }
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI * 2) / 3 + rng() * 0.22;
    const dist = 48 + rng() * 70;
    mistBanks.push({
      x: centerOffsetX + Math.cos(a) * dist,
      y: -5.0 + rng() * 17.0,
      z: Math.sin(a) * dist,
      size: 10.5 + rng() * 3.0,
      color: i % 4 === 0 ? SCENERY_COLORS.mistWarm : (i % 2 === 0 ? SCENERY_COLORS.mistLavender : SCENERY_COLORS.mistTeal),
      alpha: 0.11 + rng() * 0.05,
      phase: rng() * Math.PI * 2,
      speed: 0.08 + rng() * 0.09,
      ampX: 1.8 + rng() * 1.6,
      ampY: 0.4 + rng() * 0.4
    });
  }

  // 14. 64 Falling Pink Sakura Petals drifting across island air
  const sakuraPetals = [];
  for (let i = 0; i < 64; i++) {
    const [px, pz] = samplePos();
    const baseGround = getGroundHeight(night, px, pz) ?? 0;
    sakuraPetals.push({
      cx: px,
      cz: pz,
      groundY: baseGround,
      baseH: 3.5 + rng() * 8.5,
      fallSpeed: 0.55 + rng() * 0.65,
      swayAmp: 0.8 + rng() * 1.5,
      phase: rng() * Math.PI * 2,
      scale: 0.09 + rng() * 0.07,
      rotSpeed: 1.4 + rng() * 2.2,
      color: jitterColor(SCENERY_COLORS.sakuraPetal, 0.04, rng)
    });
  }

  // 15. 8 Overhead Moonlit Sky Cloud Banks floating high in the night sky
  const skyClouds = [];
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI * 2) / 8 + rng() * 0.25;
    const dist = 26 + (i % 4) * 20 + rng() * 16;
    const isMoonlit = i % 3 === 0;
    skyClouds.push({
      x: centerOffsetX + Math.cos(a) * dist,
      y: 22.0 + (i % 4) * 4.2 + rng() * 3.0,
      z: Math.sin(a) * dist,
      size: 10.0 + rng() * 4.0,
      color: isMoonlit ? SCENERY_COLORS.skyCloudMoon : SCENERY_COLORS.skyCloudTop,
      alpha: isMoonlit ? 0.16 + rng() * 0.05 : 0.13 + rng() * 0.05,
      phase: rng() * Math.PI * 2,
      speed: 0.05 + rng() * 0.07
    });
  }

  return {
    staticChunks: sb.chunks,
    foliageChunks: fb.chunks,
    ambientSpores,
    skyLanterns,
    staticGlows,
    spiritCranes,
    auroraNodes,
    mistBanks,
    sakuraPetals,
    skyClouds,
    colliders
  };
}
