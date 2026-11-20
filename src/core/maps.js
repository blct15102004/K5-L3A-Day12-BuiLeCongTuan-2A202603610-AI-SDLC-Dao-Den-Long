// Pure map geometry, spawn points, ground heights, cliffs, ramps, launch pads & obstacles
// Angle convention: measured from +X, counter-clockwise when viewed from above on XZ:
// x = cx + r * cos(rad), z = cz + r * sin(rad)

export function round3(v) {
  return Math.round(v * 1000) / 1000;
}

export function pointOnCircle(cx, cz, r, deg, y = 0) {
  const rad = (deg * Math.PI) / 180;
  return [round3(cx + r * Math.cos(rad)), y, round3(cz + r * Math.sin(rad))];
}

function buildNight1() {
  const moteSpawnPoints = [];
  for (let i = 0; i < 8; i++) moteSpawnPoints.push(pointOnCircle(0, 0, 12, i * 45, 0));
  for (let i = 0; i < 16; i++) moteSpawnPoints.push(pointOnCircle(0, 0, 33, i * 22.5, 0));

  const shadeSpawnPoints = [];
  for (let i = 0; i < 12; i++) shadeSpawnPoints.push(pointOnCircle(0, 0, 37, 15 + i * 30, 0));

  return {
    night: 1,
    name: 'Đêm 1 — Đảo Bến',
    introQuote: 'Ông Đăng: "Sương đen đã nuốt trọn ánh đèn bến cũ. Hãy giữ ít nhất 3/5 ngọn đèn cháy sáng cho tới lúc bình minh, Mây nhé."',
    duration: 240,
    shadeSpeed: 4.0,
    shadeIntervalTicks: 480, // 8s
    maxShades: 6,
    driftersEnabled: false,
    windEnabled: false,
    spawn: [0, 0, 0],
    lanterns: [
      { id: 'L1', pos: [0, 0, 25], deposited: 0, lit: false },
      { id: 'L2', pos: [23.8, 0, 7.7], deposited: 0, lit: false },
      { id: 'L3', pos: [14.7, 0, -20.2], deposited: 0, lit: false },
      { id: 'L4', pos: [-14.7, 0, -20.2], deposited: 0, lit: false },
      { id: 'L5', pos: [-23.8, 0, 7.7], deposited: 0, lit: false }
    ],
    moteSpawnPoints,
    shadeSpawnPoints,
    charms: [],
    launchPads: [],
    bellTower: null
  };
}

function buildNight2() {
  const moteSpawnPoints = [];
  for (const cx of [0, 70]) {
    for (let i = 0; i < 4; i++) moteSpawnPoints.push(pointOnCircle(cx, 0, 10, i * 90, 0));
    for (let i = 0; i < 8; i++) moteSpawnPoints.push(pointOnCircle(cx, 0, 22, i * 45, 0));
  }

  const shadeSpawnPoints = [];
  for (const cx of [0, 70]) {
    for (let i = 0; i < 8; i++) shadeSpawnPoints.push(pointOnCircle(cx, 0, 26, 22.5 + i * 45, 0));
  }

  return {
    night: 2,
    name: 'Đêm 2 — Đảo Cau',
    introQuote: 'Ông Đăng: "Hai bờ Đảo Cau nối qua chiếc cầu tre chênh vênh. Giữ ít nhất 4/6 ngọn đèn sáng tới bình minh, coi chừng Gió Lạc và Bóng Mực hút nhiên liệu!"',
    duration: 270,
    shadeSpeed: 4.0,
    shadeIntervalTicks: 420, // 7s
    maxShades: 8,
    driftersEnabled: true,
    windEnabled: false,
    spawn: [0, 0, 0],
    lanterns: [
      { id: 'L1', pos: [0, 0, 20], deposited: 0, lit: false },
      { id: 'L2', pos: [17, 0, -10], deposited: 0, lit: false },
      { id: 'L3', pos: [-17, 0, -10], deposited: 0, lit: false },
      { id: 'L4', pos: [70, 0, 20], deposited: 0, lit: false },
      { id: 'L5', pos: [87, 0, -10], deposited: 0, lit: false },
      { id: 'L6', pos: [53, 0, -10], deposited: 0, lit: false }
    ],
    moteSpawnPoints,
    shadeSpawnPoints,
    charms: [
      { id: 'C1', pos: [35, 0, 0] }
    ],
    launchPads: [
      { id: 'P1', pos: [20, 0, 18], radius: 1.0, velY: 14.0, horizSpeed: 24.0, target: [70, 0, 0] },
      { id: 'P2', pos: [50, 0, -18], radius: 1.0, velY: 14.0, horizSpeed: 24.0, target: [0, 0, 0] }
    ],
    bellTower: null
  };
}

function buildNight3() {
  const moteSpawnPoints = [];
  // Tier 0 (Y=0): 18 points at r=34 every 20 deg
  for (let i = 0; i < 18; i++) moteSpawnPoints.push(pointOnCircle(0, 0, 34, i * 20, 0));
  // Tier 1 (Y=3): 8 points at r=18 at 20, 40, ..., 160 deg
  for (let i = 1; i <= 8; i++) moteSpawnPoints.push(pointOnCircle(0, 0, 18, i * 20, 3));
  // Tier 2 (Y=6): 4 points at r=5 at 45, 135, 225, 315 deg
  for (const deg of [45, 135, 225, 315]) moteSpawnPoints.push(pointOnCircle(0, 0, 5, deg, 6));

  const shadeSpawnPoints = [];
  for (let i = 0; i < 16; i++) shadeSpawnPoints.push(pointOnCircle(0, 0, 43, i * 22.5, 0));

  return {
    night: 3,
    name: 'Đêm 3 — Đảo Chuông',
    introQuote: 'Ông Đăng: "Đêm cuối rồi! Giữ ít nhất 5/7 ngọn đèn rực sáng trên Đảo Chuông ba tầng gió lộng cho tới bình minh!"',
    duration: 300,
    shadeSpeed: 4.5,
    shadeIntervalTicks: 360, // 6s
    maxShades: 10,
    driftersEnabled: true,
    windEnabled: true,
    spawn: [0, 0, -12],
    lanterns: [
      { id: 'L1', pos: [0, 6, 6], deposited: 0, lit: false },
      { id: 'L2', pos: [18, 3, 10], deposited: 0, lit: false },
      { id: 'L3', pos: [-18, 3, 10], deposited: 0, lit: false },
      { id: 'L4', pos: [35, 0, -10], deposited: 0, lit: false },
      { id: 'L5', pos: [-35, 0, -10], deposited: 0, lit: false },
      { id: 'L6', pos: [20, 0, -35], deposited: 0, lit: false },
      { id: 'L7', pos: [-20, 0, -35], deposited: 0, lit: false }
    ],
    moteSpawnPoints,
    shadeSpawnPoints,
    charms: [
      { id: 'C1', pos: [30, 0, 25] },
      { id: 'C2', pos: [-30, 0, 25] }
    ],
    launchPads: [
      { id: 'P1', pos: [0, 3, 13], radius: 1.0, velY: 12.0, horizSpeed: 8.0, dir: [0, -1] }
    ],
    bellTower: { x: 0, z: 0, radius: 2.0, baseY: 6.0, topY: 14.0 }
  };
}

const NIGHT_CONFIGS = {
  1: buildNight1(),
  2: buildNight2(),
  3: buildNight3()
};

export function getNightConfig(night) {
  const cfg = NIGHT_CONFIGS[night];
  if (!cfg) throw new Error(`Invalid night: ${night}`);
  return {
    ...cfg,
    spawn: [...cfg.spawn],
    lanterns: cfg.lanterns.map(l => ({ ...l, pos: [...l.pos] })),
    moteSpawnPoints: cfg.moteSpawnPoints.map(p => [...p]),
    shadeSpawnPoints: cfg.shadeSpawnPoints.map(p => [...p]),
    charms: cfg.charms.map(c => ({ ...c, pos: [...c.pos] })),
    launchPads: cfg.launchPads.map(p => ({
      ...p,
      pos: [...p.pos],
      target: p.target ? [...p.target] : undefined,
      dir: p.dir ? [...p.dir] : undefined
    })),
    bellTower: cfg.bellTower ? { ...cfg.bellTower } : null
  };
}

const RAMP_ANGLES = [Math.PI / 6, (5 * Math.PI) / 6]; // 30 deg, 150 deg

export function getGroundHeight(night, x, z) {
  if (night === 1) {
    return Math.hypot(x, z) <= 40.0 ? 0.0 : null;
  }
  if (night === 2) {
    if (Math.hypot(x, z) <= 28.0) return 0.0;
    if (Math.hypot(x - 70.0, z) <= 28.0) return 0.0;
    if (x >= 26.0 && x <= 44.0 && z >= -2.0 && z <= 2.0) return 0.0;
    return null;
  }
  if (night === 3) {
    const r = Math.hypot(x, z);
    if (r > 45.0) return null;
    if (r <= 8.0) return 6.0;
    if (r >= 12.0 && r <= 24.0 && z > 0.0) return 3.0;
    for (const rad of RAMP_ANGLES) {
      const ca = Math.cos(rad);
      const sa = Math.sin(rad);
      const s = x * ca + z * sa;
      const t = -x * sa + z * ca;
      if (s >= 23.8 && s <= 30.0 && Math.abs(t) <= 1.5) {
        return Math.min(3.0, Math.max(0.0, 0.5 * (30.0 - s)));
      }
    }
    return 0.0;
  }
  return null;
}

export function getSupportingGroundHeight(night, x, z, y) {
  const topH = getGroundHeight(night, x, z);
  if (topH === null) return null;
  if (night === 3 && y < topH - 0.55) {
    return 0.0;
  }
  return topH;
}

export function isPointInsideIsland(night, x, z) {
  return getGroundHeight(night, x, z) !== null;
}

function isStepAllowed(night, y, nx, nz) {
  const h = getGroundHeight(night, nx, nz);
  if (h === null) return true; // Stepping into void is allowed (player falls)
  return h <= y + 0.5;
}

export function resolveHorizontalMovement(night, oldPos, targetX, targetZ) {
  let x = targetX;
  let z = targetZ;
  const y = oldPos[1];
  let blocked = false;

  // Vertical cliff wall check (primarily Night 3 tiers & ramp sides)
  if (!isStepAllowed(night, y, x, z)) {
    blocked = true;
    const okX = isStepAllowed(night, y, targetX, oldPos[2]);
    const okZ = isStepAllowed(night, y, oldPos[0], targetZ);
    if (okX && !okZ) {
      x = targetX;
      z = oldPos[2];
    } else if (okZ && !okX) {
      x = oldPos[0];
      z = targetZ;
    } else {
      x = oldPos[0];
      z = oldPos[2];
    }
  }

  // Bell Tower solid cylinder obstacle at (0, 0), radius 2.0, Y in [6, 14)
  if (night === 3 && y >= 5.5 && y < 14.0) {
    const r = Math.hypot(x, z);
    if (r < 2.0) {
      blocked = true;
      if (r < 0.0001) {
        x = 2.001;
        z = 0;
      } else {
        const scale = 2.001 / r;
        x *= scale;
        z *= scale;
      }
    }
  }

  return { x: round3(x), z: round3(z), blocked };
}

export function resolveEntityObstacle(night, x, z, y = 0, clampIsland = false) {
  let nx = x;
  let nz = z;
  let blocked = false;

  if (night === 3 && y >= 5.5 && y < 14.0) {
    const r = Math.hypot(nx, nz);
    if (r < 2.0) {
      blocked = true;
      if (r < 0.0001) {
        nx = 2.001;
        nz = 0;
      } else {
        const scale = 2.001 / r;
        nx *= scale;
        nz *= scale;
      }
    }
  }

  if (clampIsland && !isPointInsideIsland(night, nx, nz)) {
    blocked = true;
    if (night === 1) {
      const r = Math.hypot(nx, nz);
      if (r > 40.0) {
        nx = (nx / r) * 39.9;
        nz = (nz / r) * 39.9;
      }
    } else if (night === 2) {
      const cx = nx < 35.0 ? 0.0 : 70.0;
      const dx = nx - cx;
      const r = Math.hypot(dx, nz);
      if (r > 28.0) {
        nx = cx + (dx / r) * 27.9;
        nz = (nz / r) * 27.9;
      }
    } else if (night === 3) {
      const r = Math.hypot(nx, nz);
      if (r > 45.0) {
        nx = (nx / r) * 44.9;
        nz = (nz / r) * 44.9;
      }
    }
  }

  return { x: round3(nx), z: round3(nz), blocked };
}
