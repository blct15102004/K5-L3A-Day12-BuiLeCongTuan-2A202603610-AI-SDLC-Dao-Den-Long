import { Mat4 } from './matrix4.js';
import { PALETTE } from '../core/constants.js';

const VS_SOURCE = `
  attribute vec3 aPosition;
  attribute vec3 aNormal;
  attribute vec3 aColor;

  uniform mat4 uModel;
  uniform mat4 uView;
  uniform mat4 uProjection;
  uniform vec3 uColorOverride;
  uniform float uUseOverride;

  varying vec3 vNormal;
  varying vec3 vFragPos;
  varying vec3 vColor;

  void main() {
    vec4 worldPos = uModel * vec4(aPosition, 1.0);
    vFragPos = worldPos.xyz;
    vNormal = mat3(uModel) * aNormal;
    vColor = mix(aColor, uColorOverride, uUseOverride);
    gl_Position = uProjection * uView * worldPos;
  }
`;

const FS_SOURCE = `
  precision mediump float;

  varying vec3 vNormal;
  varying vec3 vFragPos;
  varying vec3 vColor;

  uniform vec3 uLanternLights[7];
  uniform float uLanternLit[7];
  uniform int uLanternCount;
  uniform vec3 uPlayerPos;
  uniform float uPlayerGlowStrength;
  uniform vec3 uPulsePos;
  uniform float uPulseStrength;
  uniform float uAmbientIntensity;
  uniform vec3 uFogColor;
  uniform float uUnlitEmissive;

  void main() {
    vec3 normal = normalize(vNormal);

    // Ambient lighting scaled by progress: 0.15 + 0.55 * (lit / total)
    vec3 ambient = (vec3(0.22, 0.25, 0.36) + vec3(0.85, 0.80, 0.68) * uAmbientIntensity) * vColor;

    // Soft moon directional light
    vec3 moonDir = normalize(vec3(0.35, 0.85, 0.4));
    float diff = max(dot(normal, moonDir), 0.0);
    vec3 diffuse = diff * (0.25 + 0.45 * uAmbientIntensity) * vColor;

    // Player hanging mini-lantern light (scales with carried motes & Wind Charm)
    float pDist = length(uPlayerPos + vec3(0.0, 1.2, 0.0) - vFragPos);
    float pAtten = 1.0 / (1.0 + 0.24 * pDist + 0.06 * pDist * pDist);
    vec3 pLight = vec3(1.0, 0.78, 0.35) * pAtten * uPlayerGlowStrength;

    // Active Pulse (Tỏa Sáng) illumination burst
    float pulseDist = length(uPulsePos + vec3(0.0, 0.8, 0.0) - vFragPos);
    float pulseAtten = 1.0 / (1.0 + 0.12 * pulseDist * pulseDist);
    vec3 pulseLight = vec3(1.0, 0.85, 0.38) * pulseAtten * uPulseStrength;

    // Up to 7 Big Lanterns
    vec3 lanternTotal = vec3(0.0);
    for (int i = 0; i < 7; i++) {
      if (i >= uLanternCount) break;
      float isLit = uLanternLit[i];
      float lDist = length(uLanternLights[i] + vec3(0.0, 2.2, 0.0) - vFragPos);
      float intensity = mix(0.22, 2.85, isLit);
      float atten = intensity / (1.0 + 0.08 * lDist + 0.02 * lDist * lDist);
      vec3 lColor = mix(vec3(0.45, 0.48, 0.55), vec3(1.0, 0.76, 0.30), isLit);
      lanternTotal += lColor * atten;
    }

    vec3 litColor = ambient + diffuse + (pLight + pulseLight + lanternTotal) * vColor;
    vec3 finalColor = mix(litColor, vColor * 1.15, uUnlitEmissive);

    // Fog from #1B2350
    float distToCenter = length(vFragPos - uPlayerPos);
    float fogFactor = clamp((distToCenter - 32.0) / 72.0, 0.0, 0.88);

    gl_FragColor = vec4(mix(finalColor, uFogColor, fogFactor), 1.0);
  }
`;

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export class WebGLRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl', { antialias: true });
    if (!this.gl) return;

    this.pulseWaves = [];
    this.particles = [];
    this.dashTrails = [];
    this.initProgram();
    this.initMeshes();

    this.gl.enable(this.gl.DEPTH_TEST);
    this.gl.clearColor(PALETTE.sky[0], PALETTE.sky[1], PALETTE.sky[2], 1.0);
  }

  triggerPulseWave(pos) {
    this.pulseWaves.push({ pos: [...pos], age: 0, maxAge: 0.45 });
    this.spawnBurst([pos[0], pos[1] + 0.8, pos[2]], PALETTE.lanternCore, 16, 4.5, 1.8);
  }

  spawnBurst(pos, color, count = 10, speed = 2.5, lift = 2.0) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= 120) this.particles.shift();
      const ang = (i * Math.PI * 2) / count + Math.random() * 0.4;
      const spd = speed * (0.6 + Math.random() * 0.6);
      this.particles.push({
        pos: [pos[0], pos[1] + 0.6, pos[2]],
        vel: [Math.cos(ang) * spd, lift * (0.6 + Math.random() * 0.6), Math.sin(ang) * spd],
        color,
        size: 0.16 + Math.random() * 0.12,
        age: 0,
        maxAge: 0.45 + Math.random() * 0.25
      });
    }
  }

  spawnStream(fromPos, toPos, color, count = 10) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= 120) this.particles.shift();
      const t = 0.35 + (i / count) * 0.3;
      const dx = toPos[0] - fromPos[0];
      const dy = (toPos[1] + 2.2) - (fromPos[1] + 1.0);
      const dz = toPos[2] - fromPos[2];
      this.particles.push({
        pos: [
          fromPos[0] + (Math.random() - 0.5) * 0.4,
          fromPos[1] + 1.0 + (Math.random() - 0.5) * 0.3,
          fromPos[2] + (Math.random() - 0.5) * 0.4
        ],
        vel: [dx / t, dy / t + 1.5, dz / t],
        color,
        size: 0.18,
        age: 0,
        maxAge: t
      });
    }
  }

  initProgram() {
    const gl = this.gl;
    const vs = createShader(gl, gl.VERTEX_SHADER, VS_SOURCE);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, FS_SOURCE);
    this.program = gl.createProgram();
    gl.attachShader(this.program, vs);
    gl.attachShader(this.program, fs);
    gl.linkProgram(this.program);

    this.attribs = {
      position: gl.getAttribLocation(this.program, 'aPosition'),
      normal: gl.getAttribLocation(this.program, 'aNormal'),
      color: gl.getAttribLocation(this.program, 'aColor')
    };

    this.uniforms = {
      model: gl.getUniformLocation(this.program, 'uModel'),
      view: gl.getUniformLocation(this.program, 'uView'),
      projection: gl.getUniformLocation(this.program, 'uProjection'),
      colorOverride: gl.getUniformLocation(this.program, 'uColorOverride'),
      useOverride: gl.getUniformLocation(this.program, 'uUseOverride'),
      lanternLights: gl.getUniformLocation(this.program, 'uLanternLights'),
      lanternLit: gl.getUniformLocation(this.program, 'uLanternLit'),
      lanternCount: gl.getUniformLocation(this.program, 'uLanternCount'),
      playerPos: gl.getUniformLocation(this.program, 'uPlayerPos'),
      playerGlowStrength: gl.getUniformLocation(this.program, 'uPlayerGlowStrength'),
      pulsePos: gl.getUniformLocation(this.program, 'uPulsePos'),
      pulseStrength: gl.getUniformLocation(this.program, 'uPulseStrength'),
      ambientIntensity: gl.getUniformLocation(this.program, 'uAmbientIntensity'),
      fogColor: gl.getUniformLocation(this.program, 'uFogColor'),
      unlitEmissive: gl.getUniformLocation(this.program, 'uUnlitEmissive')
    };
  }

  initMeshes() {
    this.meshes = {
      cube: this.createCube(),
      cylinder: this.createCylinder(32),
      cone: this.createCone(24),
      sphere: this.createSphere(12, 12),
      halfAnnulus: this.createHalfAnnulus(12, 24, 3, 28),
      ramp: this.createRamp(3, 6, 3),
      ring: this.createRing(32)
    };
  }

  createBufferMesh(positions, normals, colors, indices) {
    const gl = this.gl;
    const vao = {
      posBuffer: gl.createBuffer(),
      normBuffer: gl.createBuffer(),
      colBuffer: gl.createBuffer(),
      idxBuffer: gl.createBuffer(),
      count: indices.length
    };

    gl.bindBuffer(gl.ARRAY_BUFFER, vao.posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, vao.normBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, vao.colBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, vao.idxBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

    return vao;
  }

  createCube() {
    const p = [
      -0.5,-0.5, 0.5,  0.5,-0.5, 0.5,  0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
      -0.5,-0.5,-0.5, -0.5, 0.5,-0.5,  0.5, 0.5,-0.5,  0.5,-0.5,-0.5,
      -0.5, 0.5,-0.5, -0.5, 0.5, 0.5,  0.5, 0.5, 0.5,  0.5, 0.5,-0.5,
      -0.5,-0.5,-0.5,  0.5,-0.5,-0.5,  0.5,-0.5, 0.5, -0.5,-0.5, 0.5,
       0.5,-0.5,-0.5,  0.5, 0.5,-0.5,  0.5, 0.5, 0.5,  0.5,-0.5, 0.5,
      -0.5,-0.5,-0.5, -0.5,-0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5,-0.5
    ];
    const n = [
      0,0,1, 0,0,1, 0,0,1, 0,0,1,
      0,0,-1, 0,0,-1, 0,0,-1, 0,0,-1,
      0,1,0, 0,1,0, 0,1,0, 0,1,0,
      0,-1,0, 0,-1,0, 0,-1,0, 0,-1,0,
      1,0,0, 1,0,0, 1,0,0, 1,0,0,
      -1,0,0, -1,0,0, -1,0,0, -1,0,0
    ];
    const c = new Array(24 * 3).fill(1.0);
    const idx = [
      0,1,2, 0,2,3, 4,5,6, 4,6,7,
      8,9,10, 8,10,11, 12,13,14, 12,14,15,
      16,17,18, 16,18,19, 20,21,22, 20,22,23
    ];
    return this.createBufferMesh(p, n, c, idx);
  }

  createCylinder(segs = 32) {
    const pos = [], norm = [], col = [], idx = [];
    pos.push(0, 0.5, 0); norm.push(0, 1, 0); col.push(1, 1, 1);
    pos.push(0, -0.5, 0); norm.push(0, -1, 0); col.push(1, 1, 1);

    for (let i = 0; i <= segs; i++) {
      const a = (i * Math.PI * 2) / segs;
      const x = Math.cos(a), z = Math.sin(a);
      pos.push(x, 0.5, z); norm.push(x, 0, z); col.push(1, 1, 1);
      pos.push(x, -0.5, z); norm.push(x, 0, z); col.push(1, 1, 1);
    }

    for (let i = 0; i < segs; i++) {
      const t1 = 2 + i * 2, b1 = 3 + i * 2;
      const t2 = 2 + (i + 1) * 2, b2 = 3 + (i + 1) * 2;
      idx.push(t1, b1, t2, b1, b2, t2);
      idx.push(0, t1, t2);
      idx.push(1, b2, b1);
    }
    return this.createBufferMesh(pos, norm, col, idx);
  }

  createCone(segs = 24) {
    const pos = [0, 0.5, 0], norm = [0, 1, 0], col = [1, 1, 1], idx = [];
    for (let i = 0; i <= segs; i++) {
      const a = (i * Math.PI * 2) / segs;
      const x = Math.cos(a), z = Math.sin(a);
      pos.push(x, -0.5, z);
      norm.push(x * 0.7, 0.5, z * 0.7);
      col.push(1, 1, 1);
    }
    for (let i = 0; i < segs; i++) idx.push(0, 1 + i, 2 + i);
    return this.createBufferMesh(pos, norm, col, idx);
  }

  createSphere(latBands = 12, lonBands = 12) {
    const pos = [], norm = [], col = [], idx = [];
    for (let lat = 0; lat <= latBands; lat++) {
      const theta = (lat * Math.PI) / latBands;
      const sinT = Math.sin(theta), cosT = Math.cos(theta);
      for (let lon = 0; lon <= lonBands; lon++) {
        const phi = (lon * 2 * Math.PI) / lonBands;
        const x = Math.cos(phi) * sinT, y = cosT, z = Math.sin(phi) * sinT;
        pos.push(x * 0.5, y * 0.5, z * 0.5);
        norm.push(x, y, z);
        col.push(1, 1, 1);
      }
    }
    for (let lat = 0; lat < latBands; lat++) {
      for (let lon = 0; lon < lonBands; lon++) {
        const first = lat * (lonBands + 1) + lon;
        const second = first + lonBands + 1;
        idx.push(first, second, first + 1, second, second + 1, first + 1);
      }
    }
    return this.createBufferMesh(pos, norm, col, idx);
  }

  // Night 3 Tier 1: half annulus z > 0, r from rIn to rOut, height h
  createHalfAnnulus(rIn, rOut, h, segs = 28) {
    const pos = [], norm = [], col = [], idx = [];
    const addQuad = (a, b, c, d, nx, ny, nz) => {
      const base = pos.length / 3;
      for (const v of [a, b, c, d]) {
        pos.push(v[0], v[1], v[2]);
        norm.push(nx, ny, nz);
        col.push(1, 1, 1);
      }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    };

    for (let i = 0; i < segs; i++) {
      const a0 = (i * Math.PI) / segs;
      const a1 = ((i + 1) * Math.PI) / segs;
      const c0 = Math.cos(a0), s0 = Math.sin(a0);
      const c1 = Math.cos(a1), s1 = Math.sin(a1);

      // Top face (Y = h)
      addQuad([rIn*c0, h, rIn*s0], [rOut*c0, h, rOut*s0], [rOut*c1, h, rOut*s1], [rIn*c1, h, rIn*s1], 0, 1, 0);
      // Outer cliff
      addQuad([rOut*c0, 0, rOut*s0], [rOut*c0, h, rOut*s0], [rOut*c1, h, rOut*s1], [rOut*c1, 0, rOut*s1], c0, 0, s0);
      // Inner cliff
      addQuad([rIn*c1, 0, rIn*s1], [rIn*c1, h, rIn*s1], [rIn*c0, h, rIn*s0], [rIn*c0, 0, rIn*s0], -c0, 0, -s0);
    }
    // End caps at Z = 0
    addQuad([rIn, 0, 0], [rOut, 0, 0], [rOut, h, 0], [rIn, h, 0], 0, 0, -1);
    addQuad([-rOut, 0, 0], [-rIn, 0, 0], [-rIn, h, 0], [-rOut, h, 0], 0, 0, -1);

    return this.createBufferMesh(pos, norm, col, idx);
  }

  // Ramp along +X from x=24 (Y=h) down to x=30 (Y=0), width w along Z
  createRamp(w, len, h) {
    const hw = w / 2;
    const x0 = 24, x1 = 24 + len;
    const pos = [], norm = [], col = [], idx = [];
    const addQuad = (a, b, c, d, nx, ny, nz) => {
      const base = pos.length / 3;
      for (const v of [a, b, c, d]) {
        pos.push(v[0], v[1], v[2]);
        norm.push(nx, ny, nz);
        col.push(1, 1, 1);
      }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    };
    const ny = len / Math.hypot(len, h), nx = h / Math.hypot(len, h);
    addQuad([x0, h, -hw], [x1, 0, -hw], [x1, 0, hw], [x0, h, hw], nx, ny, 0);
    addQuad([x0, 0, hw], [x1, 0, hw], [x0, h, hw], [x0, h, hw], 0, 0, 1);
    addQuad([x0, 0, -hw], [x0, h, -hw], [x1, 0, -hw], [x1, 0, -hw], 0, 0, -1);
    return this.createBufferMesh(pos, norm, col, idx);
  }

  createRing(segs = 32) {
    const pos = [], norm = [], col = [], idx = [];
    const rIn = 0.94, rOut = 1.0;
    for (let i = 0; i <= segs; i++) {
      const a = (i * Math.PI * 2) / segs;
      const c = Math.cos(a), s = Math.sin(a);
      pos.push(rIn * c, 0, rIn * s); norm.push(0, 1, 0); col.push(1, 1, 1);
      pos.push(rOut * c, 0, rOut * s); norm.push(0, 1, 0); col.push(1, 1, 1);
    }
    for (let i = 0; i < segs; i++) {
      const i0 = i * 2;
      idx.push(i0, i0 + 1, i0 + 3, i0, i0 + 3, i0 + 2);
    }
    return this.createBufferMesh(pos, norm, col, idx);
  }

  drawMesh(mesh, modelMatrix, color, emissive = 0.0) {
    const gl = this.gl;
    gl.uniformMatrix4fv(this.uniforms.model, false, modelMatrix.m);
    gl.uniform3fv(this.uniforms.colorOverride, color);
    gl.uniform1f(this.uniforms.useOverride, 1.0);
    gl.uniform1f(this.uniforms.unlitEmissive, emissive);

    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.posBuffer);
    gl.vertexAttribPointer(this.attribs.position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(this.attribs.position);

    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normBuffer);
    gl.vertexAttribPointer(this.attribs.normal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(this.attribs.normal);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.idxBuffer);
    gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0);
  }

  getViewProjection(camera) {
    const aspect = this.canvas.width / Math.max(1, this.canvas.height);
    const proj = Mat4.perspective((60 * Math.PI) / 180, aspect, 0.1, 220.0);
    const view = Mat4.lookAt(camera.eye, camera.target, [0, 1, 0]);
    return { proj, view, vp: proj.clone().multiply(view) };
  }

  projectToScreen(worldPos, camera) {
    const { vp } = this.getViewProjection(camera);
    const clip = vp.transformVec4([worldPos[0], worldPos[1], worldPos[2], 1.0]);
    const w = clip[3];
    const inFront = w > 0.001;
    const invW = Math.abs(w) > 0.001 ? 1 / Math.abs(w) : 1;
    let ndcX = clip[0] * invW;
    let ndcY = clip[1] * invW;
    if (!inFront) {
      ndcX = -ndcX;
      ndcY = -ndcY;
    }
    const screenX = (ndcX * 0.5 + 0.5) * this.canvas.width;
    const screenY = (-ndcY * 0.5 + 0.5) * this.canvas.height;
    const onScreen = inFront && Math.abs(ndcX) <= 0.95 && Math.abs(ndcY) <= 0.95;
    return { screenX, screenY, ndcX, ndcY, inFront, onScreen };
  }

  render(engine, camera, dtSec = 1 / 60, options = {}) {
    const gl = this.gl;
    if (!gl) return;
    const colorblind = !!options.colorblind;

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.program);

    const { proj, view } = this.getViewProjection(camera);
    gl.uniformMatrix4fv(this.uniforms.projection, false, proj.m);
    gl.uniformMatrix4fv(this.uniforms.view, false, view.m);

    const litCount = engine.lanterns.filter(l => l.lit).length;
    const totalLanterns = Math.max(1, engine.lanterns.length);
    const ambientIntensity = 0.15 + 0.55 * (litCount / totalLanterns);

    const activeDt = engine.state === 'paused' ? 0 : dtSec;
    const timeSec = engine.simTick / 60.0;

    const lPosArray = new Float32Array(21);
    const lLitArray = new Float32Array(7);
    const count = Math.min(7, engine.lanterns.length);
    for (let i = 0; i < count; i++) {
      const l = engine.lanterns[i];
      lPosArray[i * 3] = l.pos[0];
      lPosArray[i * 3 + 1] = l.pos[1];
      lPosArray[i * 3 + 2] = l.pos[2];
      if (l.lit) {
        const fuelRatio = Math.max(0, Math.min(1, l.fuelUnits / 6000));
        const isLow = l.fuelUnits < 1800;
        const blinkOn = !isLow || Math.floor(timeSec * 2.0) % 2 === 0;
        lLitArray[i] = blinkOn ? 0.35 + 0.65 * fuelRatio : 0.15;
      } else {
        lLitArray[i] = 0.0;
      }
    }

    const cap = Math.max(1, engine.getCarryCapacity ? engine.getCarryCapacity() : 10);
    const carryFrac = Math.min(1, engine.player.carried / cap);
    const playerGlow = 1.0 + 0.85 * carryFrac + (engine.player.charmTicks > 0 ? 0.65 : 0.0);
    const latestPulse = this.pulseWaves.length > 0 ? this.pulseWaves[this.pulseWaves.length - 1] : null;
    const pulseStrength = latestPulse ? Math.max(0, 1.0 - latestPulse.age / latestPulse.maxAge) * 2.8 : 0.0;
    const pulsePos = latestPulse ? latestPulse.pos : engine.player.pos;

    gl.uniform3fv(this.uniforms.lanternLights, lPosArray);
    gl.uniform1fv(this.uniforms.lanternLit, lLitArray);
    gl.uniform1i(this.uniforms.lanternCount, count);
    gl.uniform3fv(this.uniforms.playerPos, new Float32Array(engine.player.pos));
    gl.uniform1f(this.uniforms.playerGlowStrength, playerGlow);
    gl.uniform3fv(this.uniforms.pulsePos, new Float32Array(pulsePos));
    gl.uniform1f(this.uniforms.pulseStrength, pulseStrength);
    gl.uniform1f(this.uniforms.ambientIntensity, ambientIntensity);
    gl.uniform3fv(this.uniforms.fogColor, PALETTE.fog);

    // 0. Sea of Clouds (#12384A) + Drifting Cloud Banks + Starry Night Sky
    const cloudMat = new Mat4().translate(30, -14.5, 0).scale(240, 0.5, 240);
    this.drawMesh(this.meshes.cube, cloudMat, PALETTE.cloudSea, 0.25);

    for (let i = 0; i < 18; i++) {
      const ang = (i * Math.PI * 2) / 18 + timeSec * 0.015;
      const dist = 48 + (i % 3) * 14;
      const cx = (engine.night === 2 ? 35 : 0) + Math.cos(ang) * dist;
      const cz = Math.sin(ang) * dist;
      const cy = -8.5 + Math.sin(timeSec * 0.6 + i) * 0.7;
      const cw = 18 + (i % 4) * 5;
      this.drawMesh(this.meshes.sphere, new Mat4().translate(cx, cy, cz).scale(cw, 4.2, cw * 0.75), PALETTE.cloudSea, 0.18);
      this.drawMesh(this.meshes.sphere, new Mat4().translate(cx + 3, cy + 1.1, cz - 2).scale(cw * 0.65, 3.0, cw * 0.55), PALETTE.fog, 0.22);
    }

    // Distant Night Stars
    for (let i = 0; i < 28; i++) {
      const sa = (i * 2.39996);
      const sr = 72 + (i % 5) * 6;
      const sx = (engine.night === 2 ? 35 : 0) + Math.cos(sa) * sr;
      const sz = Math.sin(sa) * sr;
      const sy = 22 + (i % 7) * 4;
      const twinkle = 0.22 + 0.16 * Math.sin(timeSec * 2.5 + i);
      this.drawMesh(this.meshes.sphere, new Mat4().translate(sx, sy, sz).scale(twinkle, twinkle, twinkle), PALETTE.moteCore, 0.95);
    }

    // 1. Render Floating Island Geometry by Night (with tapered floating undersides)
    if (engine.night === 1) {
      this.drawMesh(this.meshes.cone, new Mat4().translate(0, -6.5, 0).scale(38, -10.0, 38), PALETTE.wood);
      this.drawMesh(this.meshes.cylinder, new Mat4().translate(0, -1.5, 0).scale(40, 3.0, 40), PALETTE.sand);
      this.drawMesh(this.meshes.cylinder, new Mat4().translate(0, -0.45, 0).scale(38.5, 1.0, 38.5), PALETTE.grass);
      // Decorative stone border markers & trees around outer rim
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI * 2) / 8 + 0.35;
        const tx = Math.cos(a) * 35.5, tz = Math.sin(a) * 35.5;
        this.drawMesh(this.meshes.cylinder, new Mat4().translate(tx, 1.1, tz).scale(0.45, 2.2, 0.45), PALETTE.wood);
        this.drawMesh(this.meshes.cone, new Mat4().translate(tx, 2.9, tz).scale(2.1, 2.4, 2.1), PALETTE.grass);
      }
    } else if (engine.night === 2) {
      for (const cx of [0, 70]) {
        this.drawMesh(this.meshes.cone, new Mat4().translate(cx, -5.8, 0).scale(26, -8.5, 26), PALETTE.wood);
        this.drawMesh(this.meshes.cylinder, new Mat4().translate(cx, -1.5, 0).scale(28, 3.0, 28), PALETTE.sand);
        this.drawMesh(this.meshes.cylinder, new Mat4().translate(cx, -0.45, 0).scale(26.5, 1.0, 26.5), PALETTE.grass);
      }
      // Bamboo bridge x in [26, 44], z in [-2, 2] with bamboo posts
      this.drawMesh(this.meshes.cube, new Mat4().translate(35, -0.25, 0).scale(18, 0.5, 4), PALETTE.wood);
      for (const bx of [28, 32, 38, 42]) {
        this.drawMesh(this.meshes.cylinder, new Mat4().translate(bx, 0.35, 1.9).scale(0.18, 0.9, 0.18), PALETTE.sand);
        this.drawMesh(this.meshes.cylinder, new Mat4().translate(bx, 0.35, -1.9).scale(0.18, 0.9, 0.18), PALETTE.sand);
      }
    } else if (engine.night === 3) {
      this.drawMesh(this.meshes.cone, new Mat4().translate(0, -7.2, 0).scale(43, -11.5, 43), PALETTE.wood);
      // Tier 0 (r=45, Y=0)
      this.drawMesh(this.meshes.cylinder, new Mat4().translate(0, -1.5, 0).scale(45, 3.0, 45), PALETTE.sand);
      this.drawMesh(this.meshes.cylinder, new Mat4().translate(0, -0.45, 0).scale(43.5, 1.0, 43.5), PALETTE.grass);
      // Tier 1 (half-annulus r=12..24, z>0, Y=3)
      this.drawMesh(this.meshes.halfAnnulus, new Mat4(), PALETTE.grass);
      // Tier 2 (disc r=8, Y=6)
      this.drawMesh(this.meshes.cylinder, new Mat4().translate(0, 3.0, 0).scale(8, 6.0, 8), PALETTE.sand);
      this.drawMesh(this.meshes.cylinder, new Mat4().translate(0, 5.6, 0).scale(7.9, 0.9, 7.9), PALETTE.grass);
      // Two ramps at 30 deg and 150 deg
      this.drawMesh(this.meshes.ramp, new Mat4().rotateY(-Math.PI / 6), PALETTE.wood);
      this.drawMesh(this.meshes.ramp, new Mat4().rotateY(-(5 * Math.PI) / 6), PALETTE.wood);
      // Bell Tower at (0, 6, 0), radius 2, height 8
      this.drawMesh(this.meshes.cylinder, new Mat4().translate(0, 10.0, 0).scale(2.0, 8.0, 2.0), PALETTE.wood);
      this.drawMesh(this.meshes.cone, new Mat4().translate(0, 15.0, 0).scale(3.4, 2.4, 3.4), PALETTE.mayScarf);
      this.drawMesh(this.meshes.cone, new Mat4().translate(0, 16.4, 0).scale(1.6, 1.2, 1.6), PALETTE.goldUi, 0.35);
      this.drawMesh(this.meshes.sphere, new Mat4().translate(0, 11.2, 0).scale(1.1, 1.3, 1.1), PALETTE.goldUi, 0.4);
    }

    // Launch Pads
    for (const pad of engine.map.launchPads) {
      const pulsePad = 1.05 + 0.1 * Math.sin(timeSec * 4.5);
      this.drawMesh(this.meshes.cylinder, new Mat4().translate(pad.pos[0], pad.pos[1] + 0.08, pad.pos[2]).scale(1.0, 0.16, 1.0), PALETTE.goldUi, 0.65);
      this.drawMesh(this.meshes.ring, new Mat4().translate(pad.pos[0], pad.pos[1] + 0.18, pad.pos[2]).scale(pulsePad, 1, pulsePad), PALETTE.lanternCore, 0.85);
    }

    // 2. Render Great Lanterns (Tiered Pagoda Lanterns + Fuel Bar + 1Hz Low-Fuel Blink + Unlit Compression/Tears)
    for (const lantern of engine.lanterns) {
      const lx = lantern.pos[0], ly = lantern.pos[1], lz = lantern.pos[2];
      // Stone base plinth & wooden post
      this.drawMesh(this.meshes.cube, new Mat4().translate(lx, ly + 0.4, lz).scale(1.3, 0.8, 1.3), PALETTE.lanternOff);
      this.drawMesh(this.meshes.cylinder, new Mat4().translate(lx, ly + 1.4, lz).scale(0.32, 1.3, 0.32), PALETTE.wood);

      if (lantern.lit) {
        const fuelRatio = Math.max(0, Math.min(1, lantern.fuelUnits / 6000));
        const isLowFuel = lantern.fuelUnits < 1800;
        const blinkOn = !isLowFuel || Math.floor(timeSec * 2.0) % 2 === 0; // 1 Hz blink

        const coreColor = blinkOn ? PALETTE.lanternCore : PALETTE.lanternOff;
        const rimColor = blinkOn ? PALETTE.lanternLit : PALETTE.lanternOff;
        const glowEmissive = blinkOn ? 0.9 : 0.1;

        this.drawMesh(this.meshes.cube, new Mat4().translate(lx, ly + 2.4, lz).scale(0.9, 0.95, 0.9), coreColor, glowEmissive);
        this.drawMesh(this.meshes.cone, new Mat4().translate(lx, ly + 3.05, lz).scale(1.85, 0.55, 1.85), rimColor, blinkOn ? 0.35 : 0.0);
        this.drawMesh(this.meshes.cone, new Mat4().translate(lx, ly + 3.45, lz).scale(1.1, 0.45, 1.1), PALETTE.wood);
        this.drawMesh(this.meshes.sphere, new Mat4().translate(lx, ly + 3.78, lz).scale(0.28, 0.28, 0.28), PALETTE.goldUi, blinkOn ? 0.8 : 0.1);

        // Safe zone ring active only when fuel >= 30
        if (!isLowFuel) {
          const ringPulse = 5.95 + 0.1 * Math.sin(timeSec * 2.5);
          this.drawMesh(this.meshes.ring, new Mat4().translate(lx, ly + 0.06, lz).scale(ringPulse, 1.0, ringPulse), PALETTE.lanternLit, 0.6);
        }

        // Fuel Bar floating above lit lantern (blinks at 1 Hz when fuel < 30)
        if (blinkOn) {
          const barW = 1.6;
          const fillW = Math.max(0.05, barW * fuelRatio);
          const barColor = isLowFuel
            ? (colorblind ? PALETTE.dangerColorblind : PALETTE.danger)
            : PALETTE.lanternCore;
          this.drawMesh(this.meshes.cube, new Mat4().translate(lx, ly + 4.35, lz).scale(barW + 0.08, 0.18, 0.08), PALETTE.shadeBody, 0.2);
          this.drawMesh(this.meshes.cube, new Mat4().translate(lx - (barW - fillW) / 2, ly + 4.35, lz).scale(fillW, 0.14, 0.12), barColor, 0.95);
        }
      } else {
        // Unlit lantern: vertically compressed by 20% + visible dark paper tears
        this.drawMesh(this.meshes.cube, new Mat4().translate(lx, ly + 2.3, lz).scale(0.95, 0.76, 0.95), PALETTE.lanternOff, 0.05);
        this.drawMesh(this.meshes.cube, new Mat4().translate(lx, ly + 2.3, lz + 0.48).rotateY(0.15).scale(0.42, 0.22, 0.05), PALETTE.shadeBody, 0.0);
        this.drawMesh(this.meshes.cube, new Mat4().translate(lx + 0.48, ly + 2.25, lz).scale(0.05, 0.28, 0.38), PALETTE.shadeBody, 0.0);
        this.drawMesh(this.meshes.cone, new Mat4().translate(lx, ly + 2.84, lz).scale(1.85, 0.44, 1.85), PALETTE.lanternOff, 0.0);
        this.drawMesh(this.meshes.cone, new Mat4().translate(lx, ly + 3.16, lz).scale(1.1, 0.36, 1.1), PALETTE.wood);
      }
    }

    // 3. Render Fireflies / Motes (Core #FFF6C2 + Soft Halo #FFE58A)
    for (const mote of engine.motes) {
      const bob = Math.sin(timeSec * 3.5 + mote.pos[0]) * 0.18 + 0.5;
      const swayX = Math.cos(timeSec * 2.2 + mote.pos[2]) * 0.1;
      const mx = mote.pos[0] + swayX, my = mote.pos[1] + bob, mz = mote.pos[2];
      this.drawMesh(this.meshes.sphere, new Mat4().translate(mx, my, mz).scale(0.3, 0.3, 0.3), PALETTE.moteCore, 0.98);
      this.drawMesh(this.meshes.sphere, new Mat4().translate(mx, my, mz).scale(0.58, 0.58, 0.58), PALETTE.moteHalo, 0.45);
    }

    // 4. Render Wind Charms (Bùa Gió: #C8102E + gold #F2C14E)
    for (const charm of engine.charms) {
      if (!charm.available) continue;
      const mapC = engine.map.charms.find(c => c.id === charm.id);
      if (!mapC) continue;
      const cx = mapC.pos[0], cy = mapC.pos[1] + 0.85 + Math.sin(timeSec * 3.0) * 0.15, cz = mapC.pos[2];
      this.drawMesh(this.meshes.cube, new Mat4().translate(cx, cy, cz).rotateY(timeSec * 2.5).scale(0.55, 0.8, 0.14), PALETTE.goldUi, 0.65);
      this.drawMesh(this.meshes.cube, new Mat4().translate(cx, cy, cz).rotateY(timeSec * 2.5).scale(0.4, 0.65, 0.18), PALETTE.mayScarf, 0.5);
    }

    // 5. Render Ink Shadows + Creative Variant ("Bóng Mực Tinh Anh" on even IDs) + Drain Siphon Beam
    const shadeRimColor = colorblind ? PALETTE.shadeRimColorblind : PALETTE.shadeRim;
    for (const shade of engine.shades) {
      const sx = shade.pos[0], sy = shade.pos[1], sz = shade.pos[2];
      const isStunned = shade.state === 'stunned';
      const isSpawning = shade.state === 'spawning';
      const isDraining = shade.state === 'drain';
      const isRecoil = shade.state === 'recoil';
      const idMatch = String(shade.id).match(/(\d+)$/);
      const isElderVariant = idMatch ? parseInt(idMatch[1], 10) % 2 === 0 : false;

      const hover = isStunned ? -0.15 : isSpawning ? -0.35 : Math.sin(timeSec * 4.0 + sx) * 0.1;
      const sc = isStunned
        ? [1.3, 0.55, 1.3]
        : isSpawning
          ? [0.6, 0.6, 0.6]
          : isRecoil
            ? [0.9, 1.15, 0.9]
            : isElderVariant
              ? [1.15, 1.45, 1.15]
              : [1.05, 1.35, 1.05];
      const bodyCol = isStunned ? PALETTE.shadeStun : PALETTE.shadeBody;
      this.drawMesh(this.meshes.sphere, new Mat4().translate(sx, sy + hover, sz).scale(sc[0], sc[1], sc[2]), bodyCol, isStunned ? 0.25 : 0.05);
      this.drawMesh(this.meshes.ring, new Mat4().translate(sx, sy - 0.65, sz).scale(isDraining ? 1.15 : 0.85, 1, isDraining ? 1.15 : 0.85), shadeRimColor, 0.85);

      // Creative Variant: Bóng Mực Tinh Anh (twin curved ink horns + elevated halo ring)
      if (isElderVariant && !isStunned) {
        const hornY = sy + hover + 0.68;
        this.drawMesh(this.meshes.cone, new Mat4().translate(sx - 0.28, hornY, sz).scale(0.18, 0.55, 0.18), PALETTE.shadeBody, 0.1);
        this.drawMesh(this.meshes.cone, new Mat4().translate(sx + 0.28, hornY, sz).scale(0.18, 0.55, 0.18), PALETTE.shadeBody, 0.1);
        this.drawMesh(this.meshes.ring, new Mat4().translate(sx, sy + hover + 0.25, sz).rotateY(-timeSec * 2.5).scale(0.95, 1, 0.95), shadeRimColor, 0.8);
      }

      // Orbiting ink wisps or dizzy stun stars
      for (let w = 0; w < 3; w++) {
        const wa = timeSec * (isStunned ? 5.5 : isDraining ? 6.0 : 3.0) + (w * Math.PI * 2) / 3;
        const wr = isStunned ? 0.55 : 0.68;
        const wy = isStunned ? sy + 0.55 : sy + hover + Math.sin(wa * 2) * 0.2;
        const wCol = isStunned ? PALETTE.goldUi : (isDraining ? shadeRimColor : PALETTE.shadeBody);
        this.drawMesh(this.meshes.sphere, new Mat4().translate(sx + Math.cos(wa) * wr, wy, sz + Math.sin(wa) * wr).scale(0.22, 0.22, 0.22), wCol, isStunned || isDraining ? 0.85 : 0.1);
      }

      // Drain Siphon Beam: pulsing orbs flowing from target low-fuel lantern to draining Shade
      if (isDraining && shade.targetLanternId) {
        const targetL = engine.lanterns.find(l => l.id === shade.targetLanternId);
        if (targetL) {
          for (let b = 0; b < 4; b++) {
            const bt = (timeSec * 1.8 + b * 0.25) % 1.0;
            const bx = targetL.pos[0] + (sx - targetL.pos[0]) * bt;
            const by = (targetL.pos[1] + 2.2) + (sy + hover - (targetL.pos[1] + 2.2)) * bt;
            const bz = targetL.pos[2] + (sz - targetL.pos[2]) * bt;
            this.drawMesh(this.meshes.sphere, new Mat4().translate(bx, by, bz).scale(0.22, 0.22, 0.22), shadeRimColor, 0.95);
          }
        }
      }

      // Eyes facing player
      const sYaw = Math.atan2(engine.player.pos[0] - sx, engine.player.pos[2] - sz);
      const ex = sx + Math.sin(sYaw) * 0.44;
      const ez = sz + Math.cos(sYaw) * 0.44;
      this.drawMesh(this.meshes.cube, new Mat4().translate(ex, sy + hover + 0.2, ez).rotateY(sYaw).scale(0.34, 0.1, 0.1), shadeRimColor, 0.95);
    }

    // 6. Render Drifters (Gió Lạc #8FA3B8) with 3-segment undulating silk ribbon trail
    for (const drifter of engine.drifters) {
      if (drifter.state === 'removed') continue;
      const dx = drifter.pos[0], dy = drifter.pos[1] + Math.sin(timeSec * 5.0) * 0.2, dz = drifter.pos[2];
      this.drawMesh(
        this.meshes.cube,
        new Mat4().translate(dx, dy, dz).rotateY(timeSec * 4.0).scale(1.3, 0.16, 0.42),
        PALETTE.drifter,
        0.65
      );
      for (let t = 1; t <= 3; t++) {
        const ta = timeSec * 4.0 - t * 0.55;
        const tx = dx - Math.cos(ta) * t * 0.35;
        const tz = dz - Math.sin(ta) * t * 0.35;
        const ty = dy + Math.sin(timeSec * 6.0 - t) * 0.12;
        this.drawMesh(this.meshes.cube, new Mat4().translate(tx, ty, tz).rotateY(ta).scale(0.55 - t * 0.1, 0.12, 0.3 - t * 0.05), PALETTE.drifter, 0.45);
      }
      if (drifter.stolen > 0) {
        this.drawMesh(this.meshes.sphere, new Mat4().translate(dx, dy + 0.35, dz).scale(0.32, 0.32, 0.32), PALETTE.moteCore, 0.9);
      }
    }

    // 7. Render Pulse Shockwaves, Burst Particles & Dash Trails (freeze while paused!)
    for (let i = this.pulseWaves.length - 1; i >= 0; i--) {
      const w = this.pulseWaves[i];
      w.age += activeDt;
      if (w.age >= w.maxAge) {
        this.pulseWaves.splice(i, 1);
        continue;
      }
      const r = 0.6 + (w.age / w.maxAge) * 5.0;
      this.drawMesh(this.meshes.ring, new Mat4().translate(w.pos[0], w.pos[1] + 0.2, w.pos[2]).scale(r, 1, r), PALETTE.lanternCore, 0.95);
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += activeDt;
      if (p.age >= p.maxAge) {
        this.particles.splice(i, 1);
        continue;
      }
      if (activeDt > 0) {
        p.pos[0] += p.vel[0] * activeDt;
        p.pos[1] += p.vel[1] * activeDt;
        p.pos[2] += p.vel[2] * activeDt;
        p.vel[1] -= 4.0 * activeDt;
      }
      const s = p.size * (1.0 - 0.6 * (p.age / p.maxAge));
      this.drawMesh(this.meshes.sphere, new Mat4().translate(p.pos[0], p.pos[1], p.pos[2]).scale(s, s, s), p.color, 0.95);
    }

    if (activeDt > 0 && engine.player.dashTicks > 0 && engine.player.respawnTicks === 0) {
      if (this.dashTrails.length >= 10) this.dashTrails.shift();
      this.dashTrails.push({ pos: [...engine.player.pos], age: 0, maxAge: 0.25 });
    }
    for (let i = this.dashTrails.length - 1; i >= 0; i--) {
      const tr = this.dashTrails[i];
      tr.age += activeDt;
      if (tr.age >= tr.maxAge) {
        this.dashTrails.splice(i, 1);
        continue;
      }
      const k = 1.0 - tr.age / tr.maxAge;
      this.drawMesh(this.meshes.cylinder, new Mat4().translate(tr.pos[0], tr.pos[1] + 0.72, tr.pos[2]).scale(0.45 * k, 0.95 * k, 0.45 * k), PALETTE.lanternCore, 0.75);
    }

    // 8. Wind Leaves Visuals on Night 3
    if (engine.night === 3 && (engine.wind.warning || engine.wind.active)) {
      const wr = (engine.wind.dir_deg * Math.PI) / 180;
      const spd = engine.wind.active ? 18.0 : 6.0;
      for (let i = 0; i < 14; i++) {
        const t = (timeSec * spd + i * 7.3) % 40;
        const ox = engine.player.pos[0] + Math.cos(wr) * (t - 20) + Math.sin(i * 2.1) * 12;
        const oz = engine.player.pos[2] + Math.sin(wr) * (t - 20) + Math.cos(i * 1.7) * 12;
        const oy = engine.player.pos[1] + 1.0 + Math.sin(timeSec * 4 + i) * 0.8;
        this.drawMesh(this.meshes.cube, new Mat4().translate(ox, oy, oz).rotateY(timeSec * 3 + i).scale(0.28, 0.08, 0.16), PALETTE.goldUi, 0.6);
      }
    }

    // 9. Creative Side Character: Ông Đăng (Elder Lantern Keeper NPC near spawn hub)
    {
      const ox = 2.8, oz = engine.night === 3 ? -14.5 : -2.5;
      const oy = 0;
      const nod = Math.sin(timeSec * 2.0) * 0.05;
      const distToMay = Math.hypot(engine.player.pos[0] - ox, engine.player.pos[2] - oz);
      const staffRaise = distToMay < 5.0 ? 0.25 + 0.1 * Math.sin(timeSec * 5.0) : 0;
      // Sage Robe & White Beard
      this.drawMesh(this.meshes.cylinder, new Mat4().translate(ox, oy + 0.82, oz).scale(0.58, 1.15, 0.58), PALETTE.wood);
      this.drawMesh(this.meshes.sphere, new Mat4().translate(ox, oy + 1.58 + nod, oz).scale(0.42, 0.42, 0.42), [0.92, 0.78, 0.68]);
      this.drawMesh(this.meshes.cone, new Mat4().translate(ox, oy + 1.38 + nod, oz + 0.18).scale(0.24, -0.36, 0.18), PALETTE.mayRobe);
      this.drawMesh(this.meshes.cone, new Mat4().translate(ox, oy + 1.88 + nod, oz).scale(1.1, 0.44, 1.1), PALETTE.sand);
      // Bamboo Staff with hanging Gourd Lantern
      this.drawMesh(this.meshes.cylinder, new Mat4().translate(ox - 0.55, oy + 1.05 + staffRaise, oz + 0.2).scale(0.08, 2.1, 0.08), PALETTE.wood);
      this.drawMesh(this.meshes.sphere, new Mat4().translate(ox - 0.55, oy + 2.15 + staffRaise, oz + 0.2).scale(0.28, 0.34, 0.28), PALETTE.lanternLit, 0.9);
      if (distToMay < 5.0) {
        this.drawMesh(this.meshes.ring, new Mat4().translate(ox, oy + 0.05, oz).scale(1.1, 1, 1.1), PALETTE.goldUi, 0.6);
      }
    }

    // 10. Render Hero Mây + Creative Spirit Guide "Đốm Tiên"
    if (engine.player.respawnTicks === 0) {
      const invulnVisible = engine.player.invulnTicks === 0 || Math.floor(engine.player.invulnTicks / 4) % 2 === 0;
      if (invulnVisible) {
        const px = engine.player.pos[0], py = engine.player.pos[1], pz = engine.player.pos[2];
        const yaw = Math.atan2(engine.player.facing[0], engine.player.facing[1]);
        const speed = Math.hypot(engine.player.vel[0], engine.player.vel[2]);
        const moving = speed > 0.2 && engine.player.grounded;
        const walkPhase = timeSec * 14.0;
        const walkBob = moving ? Math.abs(Math.sin(walkPhase)) * 0.08 : 0;
        const stride = moving ? Math.sin(walkPhase) * 0.22 : 0;

        // Animated feet
        const fx = Math.sin(yaw), fz = Math.cos(yaw);
        const rx = fz, rz = -fx;
        this.drawMesh(this.meshes.sphere, new Mat4().translate(px + rx * 0.14 + fx * stride, py + 0.14, pz + rz * 0.14 + fz * stride).scale(0.2, 0.18, 0.26), PALETTE.wood);
        this.drawMesh(this.meshes.sphere, new Mat4().translate(px - rx * 0.14 - fx * stride, py + 0.14, pz - rz * 0.14 - fz * stride).scale(0.2, 0.18, 0.26), PALETTE.wood);

        // Cream Robe (#E8E2D0)
        this.drawMesh(this.meshes.cylinder, new Mat4().translate(px, py + 0.72 + walkBob, pz).scale(0.52, 1.0, 0.52), PALETTE.mayRobe);
        // Crimson Scarf Collar & 2-Segment Flowing Tail (#C8102E)
        this.drawMesh(this.meshes.cylinder, new Mat4().translate(px, py + 1.22 + walkBob, pz).scale(0.42, 0.16, 0.42), PALETTE.mayScarf);
        const tailWave = Math.sin(timeSec * (moving ? 12.0 : 5.0)) * (moving ? 0.14 : 0.06);
        const tx1 = px - fx * 0.34 + rx * tailWave;
        const tz1 = pz - fz * 0.34 + rz * tailWave;
        this.drawMesh(this.meshes.cube, new Mat4().translate(tx1, py + 1.12 + walkBob, tz1).rotateY(yaw).scale(0.18, 0.28, 0.08), PALETTE.mayScarf);
        const tx2 = px - fx * (0.44 + (moving ? 0.12 : 0.0)) + rx * tailWave * 1.7;
        const tz2 = pz - fz * (0.44 + (moving ? 0.12 : 0.0)) + rz * tailWave * 1.7;
        this.drawMesh(this.meshes.cube, new Mat4().translate(tx2, py + 0.92 + walkBob, tz2).rotateY(yaw).scale(0.15, 0.22, 0.07), PALETTE.mayScarf);

        // Head & Conical Hat (Nón lá)
        this.drawMesh(this.meshes.sphere, new Mat4().translate(px, py + 1.46 + walkBob, pz).scale(0.44, 0.44, 0.44), [0.92, 0.78, 0.68]);
        this.drawMesh(this.meshes.cone, new Mat4().translate(px, py + 1.80 + walkBob, pz).scale(1.18, 0.48, 1.18), PALETTE.sand);

        // Hanging mini-lantern (glow & halo scale with carried/capacity)
        const sway = Math.sin(timeSec * 6.0) * 0.06;
        const lx = px + Math.sin(yaw + 0.75) * 0.6 + sway;
        const lz = pz + Math.cos(yaw + 0.75) * 0.6;
        const lanternScale = 1.0 + 0.35 * carryFrac;
        this.drawMesh(this.meshes.cube, new Mat4().translate(lx, py + 1.38 + walkBob, lz).scale(0.22 * lanternScale, 0.28 * lanternScale, 0.22 * lanternScale), PALETTE.lanternLit, 0.95);
        this.drawMesh(this.meshes.sphere, new Mat4().translate(lx, py + 1.38 + walkBob, lz).scale(0.16 * lanternScale, 0.16 * lanternScale, 0.16 * lanternScale), PALETTE.lanternCore, 1.0);

        // Wind Charm foot aura
        if (engine.player.charmTicks > 0) {
          this.drawMesh(this.meshes.ring, new Mat4().translate(px, py + 0.08, pz).rotateY(timeSec * 4.0).scale(1.05, 1, 1.05), PALETTE.mayScarf, 0.85);
          this.drawMesh(this.meshes.ring, new Mat4().translate(px, py + 0.12, pz).rotateY(-timeSec * 4.0).scale(1.22, 1, 1.22), PALETTE.goldUi, 0.85);
        }

        // Creative Spirit Guide "Đốm Tiên" orbiting Mây & leaning toward nearest urgent lantern
        const urgentLanterns = engine.lanterns.filter(l => !l.lit || l.fuelUnits < 1800);
        let guideAngle = timeSec * 2.4;
        if (urgentLanterns.length > 0) {
          urgentLanterns.sort((a, b) => Math.hypot(a.pos[0] - px, a.pos[2] - pz) - Math.hypot(b.pos[0] - px, b.pos[2] - pz));
          const u = urgentLanterns[0];
          guideAngle = Math.atan2(u.pos[2] - pz, u.pos[0] - px) + Math.sin(timeSec * 3.0) * 0.35;
        }
        const gx = px + Math.cos(guideAngle) * 1.15;
        const gz = pz + Math.sin(guideAngle) * 1.15;
        const gy = py + 1.65 + Math.sin(timeSec * 4.5) * 0.18;
        this.drawMesh(this.meshes.sphere, new Mat4().translate(gx, gy, gz).scale(0.22, 0.22, 0.22), PALETTE.moteCore, 0.98);
        this.drawMesh(this.meshes.cube, new Mat4().translate(gx, gy + 0.08, gz).rotateY(timeSec * 6.0).scale(0.48, 0.06, 0.12), PALETTE.lanternCore, 0.85);
      }
    }
  }
}
