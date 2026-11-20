import { Mat4 } from './matrix4.js';
import { PALETTE } from '../core/constants.js';

const VS_SOURCE = `
  attribute vec3 aPosition;
  attribute vec3 aNormal;

  uniform mat4 uModel;
  uniform mat4 uView;
  uniform mat4 uProjection;
  uniform vec3 uColorOverride;

  varying vec3 vNormal;
  varying vec3 vFragPos;
  varying vec3 vColor;

  void main() {
    vec4 worldPos = uModel * vec4(aPosition, 1.0);
    vFragPos = worldPos.xyz;
    vNormal = mat3(uModel) * aNormal;
    vColor = uColorOverride;
    gl_Position = uProjection * uView * worldPos;
  }
`;

const VS_INST_SOURCE = `
  attribute vec3 aPosition;
  attribute vec3 aNormal;
  attribute vec4 aInstPosRot;
  attribute vec3 aInstScale;
  attribute vec3 aInstColor;

  uniform mat4 uView;
  uniform mat4 uProjection;

  varying vec3 vNormal;
  varying vec3 vFragPos;
  varying vec3 vColor;

  void main() {
    float c = cos(aInstPosRot.w);
    float s = sin(aInstPosRot.w);
    vec3 scaled = aPosition * aInstScale;
    vec3 rotated = vec3(
      c * scaled.x + s * scaled.z,
      scaled.y,
      -s * scaled.x + c * scaled.z
    );
    vec3 ns = aNormal * aInstScale;
    vNormal = vec3(
      c * ns.x + s * ns.z,
      ns.y,
      -s * ns.x + c * ns.z
    );
    vFragPos = rotated + aInstPosRot.xyz;
    vColor = aInstColor;
    gl_Position = uProjection * uView * vec4(vFragPos, 1.0);
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
    this.gl = canvas.getContext('webgl', { antialias: true, powerPreference: 'high-performance' });
    if (!this.gl) return;

    this.pulseWaves = [];
    this.particles = [];
    this.dashTrails = [];
    this.scratchMat = new Mat4();
    this.projMat = new Mat4();
    this.viewMat = new Mat4();
    this.vpMat = new Mat4();
    this.identityMat = new Mat4();
    this.rampMatA = new Mat4().rotateY(-Math.PI / 6);
    this.rampMatB = new Mat4().rotateY(-(5 * Math.PI) / 6);
    this.upVec = [0, 1, 0];
    this.lPosArray = new Float32Array(21);
    this.lLitArray = new Float32Array(7);
    this.playerPosF32 = new Float32Array(3);
    this.pulsePosF32 = new Float32Array(3);
    this.lastBoundMesh = null;
    this.instExt = this.gl.getExtension('ANGLE_instanced_arrays');
    this.MAX_INSTANCES = 512;
    this.instStrideFloats = 10;
    this.instData = new Float32Array(this.MAX_INSTANCES * this.instStrideFloats);
    this.instBuffer = this.instExt ? this.gl.createBuffer() : null;
    if (this.instBuffer) {
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.instBuffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, this.instData.byteLength, this.gl.STREAM_DRAW);
    }
    this.initProgram();
    this.initMeshes();

    this.gl.enable(this.gl.DEPTH_TEST);
    this.gl.clearColor(PALETTE.sky[0], PALETTE.sky[1], PALETTE.sky[2], 1.0);
  }

  getRendererInfo() {
    if (!this.gl) return 'WebGL unavailable';
    const gl = this.gl;
    let info = gl.getParameter(gl.RENDERER) || 'WebGL 1.0';
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    if (dbg) {
      const unmasked = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL);
      if (unmasked) info = unmasked;
    }
    return `Custom WebGL 1.0 (${info})`;
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

  collectUniforms(prog) {
    const gl = this.gl;
    return {
      model: gl.getUniformLocation(prog, 'uModel'),
      view: gl.getUniformLocation(prog, 'uView'),
      projection: gl.getUniformLocation(prog, 'uProjection'),
      colorOverride: gl.getUniformLocation(prog, 'uColorOverride'),
      lanternLights: gl.getUniformLocation(prog, 'uLanternLights'),
      lanternLit: gl.getUniformLocation(prog, 'uLanternLit'),
      lanternCount: gl.getUniformLocation(prog, 'uLanternCount'),
      playerPos: gl.getUniformLocation(prog, 'uPlayerPos'),
      playerGlowStrength: gl.getUniformLocation(prog, 'uPlayerGlowStrength'),
      pulsePos: gl.getUniformLocation(prog, 'uPulsePos'),
      pulseStrength: gl.getUniformLocation(prog, 'uPulseStrength'),
      ambientIntensity: gl.getUniformLocation(prog, 'uAmbientIntensity'),
      fogColor: gl.getUniformLocation(prog, 'uFogColor'),
      unlitEmissive: gl.getUniformLocation(prog, 'uUnlitEmissive')
    };
  }

  initProgram() {
    const gl = this.gl;
    const vs = createShader(gl, gl.VERTEX_SHADER, VS_SOURCE);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, FS_SOURCE);
    this.program = gl.createProgram();
    gl.attachShader(this.program, vs);
    gl.attachShader(this.program, fs);
    gl.bindAttribLocation(this.program, 0, 'aPosition');
    gl.bindAttribLocation(this.program, 1, 'aNormal');
    gl.linkProgram(this.program);

    this.attribs = { position: 0, normal: 1 };
    this.uniforms = this.collectUniforms(this.program);

    if (this.instExt) {
      const vsInst = createShader(gl, gl.VERTEX_SHADER, VS_INST_SOURCE);
      this.instProgram = gl.createProgram();
      gl.attachShader(this.instProgram, vsInst);
      gl.attachShader(this.instProgram, fs);
      gl.bindAttribLocation(this.instProgram, 0, 'aPosition');
      gl.bindAttribLocation(this.instProgram, 1, 'aNormal');
      gl.bindAttribLocation(this.instProgram, 2, 'aInstPosRot');
      gl.bindAttribLocation(this.instProgram, 3, 'aInstScale');
      gl.bindAttribLocation(this.instProgram, 4, 'aInstColor');
      gl.linkProgram(this.instProgram);
      this.instUniforms = this.collectUniforms(this.instProgram);
    }
  }

  initMeshes() {
    this.meshes = {
      cube: this.createCube(),
      cylinder: this.createCylinder(32),
      cone: this.createCone(24),
      sphere: this.createSphere(12, 12),
      sphereLow: this.createSphere(8, 8),
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
    gl.uniform1f(this.uniforms.unlitEmissive, emissive);

    if (this.lastBoundMesh !== mesh) {
      this.lastBoundMesh = mesh;
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.posBuffer);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(0);

      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normBuffer);
      gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(1);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.idxBuffer);
    }
    gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0);
  }

  pushInstance(count, tx, ty, tz, rotY, sx, sy, sz, col) {
    if (count >= this.MAX_INSTANCES) return count;
    const o = count * 10;
    const d = this.instData;
    d[o] = tx; d[o + 1] = ty; d[o + 2] = tz; d[o + 3] = rotY;
    d[o + 4] = sx; d[o + 5] = sy; d[o + 6] = sz;
    d[o + 7] = col[0]; d[o + 8] = col[1]; d[o + 9] = col[2];
    return count + 1;
  }

  uploadFrameUniforms(u, count, playerGlow, pulseStrength, ambientIntensity) {
    const gl = this.gl;
    gl.uniformMatrix4fv(u.projection, false, this.projMat.m);
    gl.uniformMatrix4fv(u.view, false, this.viewMat.m);
    gl.uniform3fv(u.lanternLights, this.lPosArray);
    gl.uniform1fv(u.lanternLit, this.lLitArray);
    gl.uniform1i(u.lanternCount, count);
    gl.uniform3fv(u.playerPos, this.playerPosF32);
    gl.uniform1f(u.playerGlowStrength, playerGlow);
    gl.uniform3fv(u.pulsePos, this.pulsePosF32);
    gl.uniform1f(u.pulseStrength, pulseStrength);
    gl.uniform1f(u.ambientIntensity, ambientIntensity);
    gl.uniform3fv(u.fogColor, PALETTE.fog);
  }

  beginInstancedPass(count, playerGlow, pulseStrength, ambientIntensity) {
    const gl = this.gl;
    gl.useProgram(this.instProgram);
    this.uploadFrameUniforms(this.instUniforms, count, playerGlow, pulseStrength, ambientIntensity);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instBuffer);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 40, 0);
    this.instExt.vertexAttribDivisorANGLE(2, 1);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 3, gl.FLOAT, false, 40, 16);
    this.instExt.vertexAttribDivisorANGLE(3, 1);
    gl.enableVertexAttribArray(4);
    gl.vertexAttribPointer(4, 3, gl.FLOAT, false, 40, 28);
    this.instExt.vertexAttribDivisorANGLE(4, 1);
    this.lastBoundMesh = null;
  }

  drawInstancedBatch(mesh, instCount, emissive) {
    if (instCount <= 0) return;
    const gl = this.gl;
    gl.uniform1f(this.instUniforms.unlitEmissive, emissive);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.instData.subarray(0, instCount * 10), gl.STREAM_DRAW);

    if (this.lastBoundMesh !== mesh) {
      this.lastBoundMesh = mesh;
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.posBuffer);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(0);

      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normBuffer);
      gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(1);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.idxBuffer);
    }
    this.instExt.drawElementsInstancedANGLE(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0, instCount);
  }

  endInstancedPass() {
    const gl = this.gl;
    this.instExt.vertexAttribDivisorANGLE(2, 0);
    this.instExt.vertexAttribDivisorANGLE(3, 0);
    this.instExt.vertexAttribDivisorANGLE(4, 0);
    gl.disableVertexAttribArray(2);
    gl.disableVertexAttribArray(3);
    gl.disableVertexAttribArray(4);
    gl.useProgram(this.program);
    this.lastBoundMesh = null;
  }

  getViewProjection(camera) {
    const aspect = this.canvas.width / Math.max(1, this.canvas.height);
    this.projMat.setPerspective((60 * Math.PI) / 180, aspect, 0.1, 220.0);
    this.viewMat.setLookAt(camera.eye, camera.target, this.upVec);
    this.vpMat.setMultiply(this.projMat, this.viewMat);
    return { proj: this.projMat, view: this.viewMat, vp: this.vpMat };
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
    const reducedMotion = !!options.reducedMotion;
    const benchmarkMode = !!options.benchmarkMode || !!engine.benchmarkMode;
    this.lastBoundMesh = null;

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.program);

    const { proj, view } = this.getViewProjection(camera);
    gl.uniformMatrix4fv(this.uniforms.projection, false, proj.m);
    gl.uniformMatrix4fv(this.uniforms.view, false, view.m);

    const sm = this.scratchMat;
    let litCount = 0;
    for (let i = 0; i < engine.lanterns.length; i++) {
      if (engine.lanterns[i].lit) litCount++;
    }
    const totalLanterns = Math.max(1, engine.lanterns.length);
    const ambientIntensity = 0.15 + 0.55 * (litCount / totalLanterns);

    const activeDt = engine.state === 'paused' ? 0 : dtSec;
    const timeSec = engine.simTick / 60.0;

    const lPosArray = this.lPosArray;
    const lLitArray = this.lLitArray;
    const count = Math.min(7, engine.lanterns.length);
    for (let i = 0; i < count; i++) {
      const l = engine.lanterns[i];
      lPosArray[i * 3] = l.pos[0];
      lPosArray[i * 3 + 1] = l.pos[1];
      lPosArray[i * 3 + 2] = l.pos[2];
      if (l.lit) {
        const fuelRatio = Math.max(0, Math.min(1, l.fuelUnits / 6000));
        const isLow = l.fuelUnits < 1800;
        const blinkOn = reducedMotion || !isLow || Math.floor(timeSec * 2.0) % 2 === 0;
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

    this.playerPosF32[0] = engine.player.pos[0];
    this.playerPosF32[1] = engine.player.pos[1];
    this.playerPosF32[2] = engine.player.pos[2];
    this.pulsePosF32[0] = pulsePos[0];
    this.pulsePosF32[1] = pulsePos[1];
    this.pulsePosF32[2] = pulsePos[2];

    this.uploadFrameUniforms(this.uniforms, count, playerGlow, pulseStrength, ambientIntensity);

    // 0. Sea of Clouds (#12384A) + Drifting Cloud Banks + Starry Night Sky
    this.drawMesh(this.meshes.cube, sm.setTRS(30, -14.5, 0, 240, 0.5, 240), PALETTE.cloudSea, 0.25);

    for (let i = 0; i < 18; i++) {
      const ang = (i * Math.PI * 2) / 18 + timeSec * 0.015;
      const dist = 48 + (i % 3) * 14;
      const cx = (engine.night === 2 ? 35 : 0) + Math.cos(ang) * dist;
      const cz = Math.sin(ang) * dist;
      const cy = -8.5 + Math.sin(timeSec * 0.6 + i) * 0.7;
      const cw = 18 + (i % 4) * 5;
      this.drawMesh(this.meshes.sphere, sm.setTRS(cx, cy, cz, cw, 4.2, cw * 0.75), PALETTE.cloudSea, 0.18);
      this.drawMesh(this.meshes.sphere, sm.setTRS(cx + 3, cy + 1.1, cz - 2, cw * 0.65, 3.0, cw * 0.55), PALETTE.fog, 0.22);
    }

    // Distant Night Stars
    for (let i = 0; i < 28; i++) {
      const sa = (i * 2.39996);
      const sr = 72 + (i % 5) * 6;
      const sx = (engine.night === 2 ? 35 : 0) + Math.cos(sa) * sr;
      const sz = Math.sin(sa) * sr;
      const sy = 22 + (i % 7) * 4;
      const twinkle = 0.22 + 0.16 * Math.sin(timeSec * 2.5 + i);
      this.drawMesh(this.meshes.sphereLow, sm.setTRS(sx, sy, sz, twinkle, twinkle, twinkle), PALETTE.moteCore, 0.95);
    }

    // 1. Render Floating Island Geometry by Night (with tapered floating undersides)
    if (engine.night === 1) {
      this.drawMesh(this.meshes.cone, sm.setTRS(0, -6.5, 0, 38, -10.0, 38), PALETTE.wood);
      this.drawMesh(this.meshes.cylinder, sm.setTRS(0, -1.5, 0, 40, 3.0, 40), PALETTE.sand);
      this.drawMesh(this.meshes.cylinder, sm.setTRS(0, -0.45, 0, 38.5, 1.0, 38.5), PALETTE.grass);
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI * 2) / 8 + 0.35;
        const tx = Math.cos(a) * 35.5, tz = Math.sin(a) * 35.5;
        this.drawMesh(this.meshes.cylinder, sm.setTRS(tx, 1.1, tz, 0.45, 2.2, 0.45), PALETTE.wood);
        this.drawMesh(this.meshes.cone, sm.setTRS(tx, 2.9, tz, 2.1, 2.4, 2.1), PALETTE.grass);
      }
    } else if (engine.night === 2) {
      for (const cx of [0, 70]) {
        this.drawMesh(this.meshes.cone, sm.setTRS(cx, -5.8, 0, 26, -8.5, 26), PALETTE.wood);
        this.drawMesh(this.meshes.cylinder, sm.setTRS(cx, -1.5, 0, 28, 3.0, 28), PALETTE.sand);
        this.drawMesh(this.meshes.cylinder, sm.setTRS(cx, -0.45, 0, 26.5, 1.0, 26.5), PALETTE.grass);
      }
      this.drawMesh(this.meshes.cube, sm.setTRS(35, -0.25, 0, 18, 0.5, 4), PALETTE.wood);
      for (const bx of [28, 32, 38, 42]) {
        this.drawMesh(this.meshes.cylinder, sm.setTRS(bx, 0.35, 1.9, 0.18, 0.9, 0.18), PALETTE.sand);
        this.drawMesh(this.meshes.cylinder, sm.setTRS(bx, 0.35, -1.9, 0.18, 0.9, 0.18), PALETTE.sand);
      }
    } else if (engine.night === 3) {
      this.drawMesh(this.meshes.cone, sm.setTRS(0, -7.2, 0, 43, -11.5, 43), PALETTE.wood);
      this.drawMesh(this.meshes.cylinder, sm.setTRS(0, -1.5, 0, 45, 3.0, 45), PALETTE.sand);
      this.drawMesh(this.meshes.cylinder, sm.setTRS(0, -0.45, 0, 43.5, 1.0, 43.5), PALETTE.grass);
      this.drawMesh(this.meshes.halfAnnulus, this.identityMat, PALETTE.grass);
      this.drawMesh(this.meshes.cylinder, sm.setTRS(0, 3.0, 0, 8, 6.0, 8), PALETTE.sand);
      this.drawMesh(this.meshes.cylinder, sm.setTRS(0, 5.6, 0, 7.9, 0.9, 7.9), PALETTE.grass);
      this.drawMesh(this.meshes.ramp, this.rampMatA, PALETTE.wood);
      this.drawMesh(this.meshes.ramp, this.rampMatB, PALETTE.wood);
      this.drawMesh(this.meshes.cylinder, sm.setTRS(0, 10.0, 0, 2.0, 8.0, 2.0), PALETTE.wood);
      this.drawMesh(this.meshes.cone, sm.setTRS(0, 15.0, 0, 3.4, 2.4, 3.4), PALETTE.mayScarf);
      this.drawMesh(this.meshes.cone, sm.setTRS(0, 16.4, 0, 1.6, 1.2, 1.6), PALETTE.goldUi, 0.35);
      this.drawMesh(this.meshes.sphere, sm.setTRS(0, 11.2, 0, 1.1, 1.3, 1.1), PALETTE.goldUi, 0.4);
    }

    // Launch Pads
    for (let i = 0; i < engine.map.launchPads.length; i++) {
      const pad = engine.map.launchPads[i];
      const pulsePad = 1.05 + 0.1 * Math.sin(timeSec * 4.5);
      this.drawMesh(this.meshes.cylinder, sm.setTRS(pad.pos[0], pad.pos[1] + 0.08, pad.pos[2], 1.0, 0.16, 1.0), PALETTE.goldUi, 0.65);
      this.drawMesh(this.meshes.ring, sm.setTRS(pad.pos[0], pad.pos[1] + 0.18, pad.pos[2], pulsePad, 1, pulsePad), PALETTE.lanternCore, 0.85);
    }

    // 2. Render Great Lanterns (Tiered Pagoda Lanterns + Fuel Bar + 1Hz Low-Fuel Blink + Unlit Compression/Tears)
    for (let i = 0; i < engine.lanterns.length; i++) {
      const lantern = engine.lanterns[i];
      const lx = lantern.pos[0], ly = lantern.pos[1], lz = lantern.pos[2];
      this.drawMesh(this.meshes.cube, sm.setTRS(lx, ly + 0.4, lz, 1.3, 0.8, 1.3), PALETTE.lanternOff);
      this.drawMesh(this.meshes.cylinder, sm.setTRS(lx, ly + 1.4, lz, 0.32, 1.3, 0.32), PALETTE.wood);

      if (lantern.lit) {
        const fuelRatio = Math.max(0, Math.min(1, lantern.fuelUnits / 6000));
        const isLowFuel = lantern.fuelUnits < 1800;
        const blinkOn = reducedMotion || !isLowFuel || Math.floor(timeSec * 2.0) % 2 === 0;

        const coreColor = blinkOn ? PALETTE.lanternCore : PALETTE.lanternOff;
        const rimColor = blinkOn ? PALETTE.lanternLit : PALETTE.lanternOff;
        const glowEmissive = blinkOn ? 0.9 : 0.1;

        this.drawMesh(this.meshes.cube, sm.setTRS(lx, ly + 2.4, lz, 0.9, 0.95, 0.9), coreColor, glowEmissive);
        this.drawMesh(this.meshes.cone, sm.setTRS(lx, ly + 3.05, lz, 1.85, 0.55, 1.85), rimColor, blinkOn ? 0.35 : 0.0);
        this.drawMesh(this.meshes.cone, sm.setTRS(lx, ly + 3.45, lz, 1.1, 0.45, 1.1), PALETTE.wood);
        this.drawMesh(this.meshes.sphere, sm.setTRS(lx, ly + 3.78, lz, 0.28, 0.28, 0.28), PALETTE.goldUi, blinkOn ? 0.8 : 0.1);

        if (!isLowFuel) {
          const ringPulse = 5.95 + 0.1 * Math.sin(timeSec * 2.5);
          this.drawMesh(this.meshes.ring, sm.setTRS(lx, ly + 0.06, lz, ringPulse, 1.0, ringPulse), PALETTE.lanternLit, 0.6);
        }

        if (blinkOn) {
          const barW = 1.6;
          const fillW = Math.max(0.05, barW * fuelRatio);
          const barColor = isLowFuel
            ? (colorblind ? PALETTE.dangerColorblind : PALETTE.danger)
            : PALETTE.lanternCore;
          this.drawMesh(this.meshes.cube, sm.setTRS(lx, ly + 4.35, lz, barW + 0.08, 0.18, 0.08), PALETTE.shadeBody, 0.2);
          this.drawMesh(this.meshes.cube, sm.setTRS(lx - (barW - fillW) / 2, ly + 4.35, lz, fillW, 0.14, 0.12), barColor, 0.95);
        }
      } else {
        this.drawMesh(this.meshes.cube, sm.setTRS(lx, ly + 2.3, lz, 0.95, 0.76, 0.95), PALETTE.lanternOff, 0.05);
        this.drawMesh(this.meshes.cube, sm.setTRS(lx, ly + 2.3, lz + 0.48, 0.42, 0.22, 0.05, 0.15), PALETTE.shadeBody, 0.0);
        this.drawMesh(this.meshes.cube, sm.setTRS(lx + 0.48, ly + 2.25, lz, 0.05, 0.28, 0.38), PALETTE.shadeBody, 0.0);
        this.drawMesh(this.meshes.cone, sm.setTRS(lx, ly + 2.84, lz, 1.85, 0.44, 1.85), PALETTE.lanternOff, 0.0);
        this.drawMesh(this.meshes.cone, sm.setTRS(lx, ly + 3.16, lz, 1.1, 0.36, 1.1), PALETTE.wood);
      }
    }

    const shadeRimColor = colorblind ? PALETTE.shadeRimColorblind : PALETTE.shadeRim;

    // 3 & 5. Instanced Fast Path for Motes & Ink Shades (reduces ~800 draw calls to 5 GPU draw calls)
    if (this.instExt && (engine.motes.length > 0 || engine.shades.length > 0)) {
      this.beginInstancedPass(count, playerGlow, pulseStrength, ambientIntensity);

      if (engine.motes.length > 0) {
        let mc = 0;
        for (let i = 0; i < engine.motes.length; i++) {
          const mote = engine.motes[i];
          const bob = Math.sin(timeSec * 3.5 + mote.pos[0]) * 0.18 + 0.5;
          const swayX = Math.cos(timeSec * 2.2 + mote.pos[2]) * 0.1;
          mc = this.pushInstance(mc, mote.pos[0] + swayX, mote.pos[1] + bob, mote.pos[2], 0, 0.3, 0.3, 0.3, PALETTE.moteCore);
          if (mc === this.MAX_INSTANCES) { this.drawInstancedBatch(this.meshes.sphereLow, mc, 0.98); mc = 0; }
        }
        this.drawInstancedBatch(this.meshes.sphereLow, mc, 0.98);

        mc = 0;
        for (let i = 0; i < engine.motes.length; i++) {
          const mote = engine.motes[i];
          const bob = Math.sin(timeSec * 3.5 + mote.pos[0]) * 0.18 + 0.5;
          const swayX = Math.cos(timeSec * 2.2 + mote.pos[2]) * 0.1;
          mc = this.pushInstance(mc, mote.pos[0] + swayX, mote.pos[1] + bob, mote.pos[2], 0, 0.58, 0.58, 0.58, PALETTE.moteHalo);
          if (mc === this.MAX_INSTANCES) { this.drawInstancedBatch(this.meshes.sphereLow, mc, 0.45); mc = 0; }
        }
        this.drawInstancedBatch(this.meshes.sphereLow, mc, 0.45);
      }

      if (engine.shades.length > 0) {
        let bc = 0;
        for (let i = 0; i < engine.shades.length; i++) {
          const shade = engine.shades[i];
          if (shade.state === 'stunned') continue;
          const sx = shade.pos[0], sy = shade.pos[1], sz = shade.pos[2];
          const isSpawning = shade.state === 'spawning';
          const isRecoil = shade.state === 'recoil';
          const isElderVariant = !benchmarkMode && (parseInt(String(shade.id).slice(1), 10) % 2 === 0);
          const hover = isSpawning ? -0.35 : Math.sin(timeSec * 4.0 + sx) * 0.1;
          const scx = isSpawning ? 0.6 : isRecoil ? 0.9 : isElderVariant ? 1.15 : 1.05;
          const scy = isSpawning ? 0.6 : isRecoil ? 1.15 : isElderVariant ? 1.45 : 1.35;
          bc = this.pushInstance(bc, sx, sy + hover, sz, 0, scx, scy, scx, PALETTE.shadeBody);
          if (bc === this.MAX_INSTANCES) { this.drawInstancedBatch(this.meshes.sphereLow, bc, 0.05); bc = 0; }
        }
        this.drawInstancedBatch(this.meshes.sphereLow, bc, 0.05);

        let stc = 0;
        for (let i = 0; i < engine.shades.length; i++) {
          const shade = engine.shades[i];
          if (shade.state !== 'stunned') continue;
          stc = this.pushInstance(stc, shade.pos[0], shade.pos[1] - 0.15, shade.pos[2], 0, 1.3, 0.55, 1.3, PALETTE.shadeStun);
          if (stc === this.MAX_INSTANCES) { this.drawInstancedBatch(this.meshes.sphereLow, stc, 0.25); stc = 0; }
        }
        this.drawInstancedBatch(this.meshes.sphereLow, stc, 0.25);

        let rc = 0;
        for (let i = 0; i < engine.shades.length; i++) {
          const shade = engine.shades[i];
          const rScale = shade.state === 'drain' ? 1.15 : 0.85;
          rc = this.pushInstance(rc, shade.pos[0], shade.pos[1] - 0.65, shade.pos[2], 0, rScale, 1, rScale, shadeRimColor);
          if (rc === this.MAX_INSTANCES) { this.drawInstancedBatch(this.meshes.ring, rc, 0.85); rc = 0; }
        }
        this.drawInstancedBatch(this.meshes.ring, rc, 0.85);

        let ec = 0;
        const ppx = engine.player.pos[0], ppz = engine.player.pos[2];
        for (let i = 0; i < engine.shades.length; i++) {
          const shade = engine.shades[i];
          const sx = shade.pos[0], sy = shade.pos[1], sz = shade.pos[2];
          const hover = shade.state === 'stunned' ? -0.15 : shade.state === 'spawning' ? -0.35 : Math.sin(timeSec * 4.0 + sx) * 0.1;
          const sYaw = Math.atan2(ppx - sx, ppz - sz);
          ec = this.pushInstance(ec, sx + Math.sin(sYaw) * 0.44, sy + hover + 0.2, sz + Math.cos(sYaw) * 0.44, sYaw, 0.34, 0.1, 0.1, shadeRimColor);
          if (ec === this.MAX_INSTANCES) { this.drawInstancedBatch(this.meshes.cube, ec, 0.95); ec = 0; }
        }
        this.drawInstancedBatch(this.meshes.cube, ec, 0.95);
      }

      this.endInstancedPass();

      if (!benchmarkMode) {
        for (let i = 0; i < engine.shades.length; i++) {
          const shade = engine.shades[i];
          const sx = shade.pos[0], sy = shade.pos[1], sz = shade.pos[2];
          const isStunned = shade.state === 'stunned';
          const isSpawning = shade.state === 'spawning';
          const isDraining = shade.state === 'drain';
          const isElder = !isStunned && (parseInt(String(shade.id).slice(1), 10) % 2 === 0);
          const hover = isStunned ? -0.15 : isSpawning ? -0.35 : Math.sin(timeSec * 4.0 + sx) * 0.1;
          for (let w = 0; w < 3; w++) {
            const wa = timeSec * (isStunned ? 5.5 : isDraining ? 6.0 : 3.0) + (w * Math.PI * 2) / 3;
            const wr = isStunned ? 0.55 : 0.68;
            const wy = isStunned ? sy + 0.55 : sy + hover + Math.sin(wa * 2) * 0.2;
            const wCol = isStunned ? PALETTE.goldUi : (isDraining ? shadeRimColor : PALETTE.shadeBody);
            this.drawMesh(this.meshes.sphereLow, sm.setTRS(sx + Math.cos(wa) * wr, wy, sz + Math.sin(wa) * wr, 0.22, 0.22, 0.22), wCol, isStunned || isDraining ? 0.85 : 0.1);
          }
          if (isDraining && shade.targetLanternId) {
            const targetL = engine.lanterns.find(l => l.id === shade.targetLanternId);
            if (targetL) {
              for (let b = 0; b < 4; b++) {
                const bt = (timeSec * 1.8 + b * 0.25) % 1.0;
                const bx = targetL.pos[0] + (sx - targetL.pos[0]) * bt;
                const by = (targetL.pos[1] + 2.2) + (sy + hover - (targetL.pos[1] + 2.2)) * bt;
                const bz = targetL.pos[2] + (sz - targetL.pos[2]) * bt;
                this.drawMesh(this.meshes.sphereLow, sm.setTRS(bx, by, bz, 0.22, 0.22, 0.22), shadeRimColor, 0.95);
              }
            }
          }
          if (isElder) {
            this.drawMesh(this.meshes.ring, sm.setTRS(sx, sy + hover + 0.25, sz, 0.95, 1, 0.95, -timeSec * 2.5), shadeRimColor, 0.8);
            const hornY = sy + hover + 0.68;
            this.drawMesh(this.meshes.cone, sm.setTRS(sx - 0.28, hornY, sz, 0.18, 0.55, 0.18), PALETTE.shadeBody, 0.1);
            this.drawMesh(this.meshes.cone, sm.setTRS(sx + 0.28, hornY, sz, 0.18, 0.55, 0.18), PALETTE.shadeBody, 0.1);
          }
        }
      }
    } else {
      for (let i = 0; i < engine.motes.length; i++) {
        const mote = engine.motes[i];
        const bob = Math.sin(timeSec * 3.5 + mote.pos[0]) * 0.18 + 0.5;
        const swayX = Math.cos(timeSec * 2.2 + mote.pos[2]) * 0.1;
        this.drawMesh(this.meshes.sphereLow, sm.setTRS(mote.pos[0] + swayX, mote.pos[1] + bob, mote.pos[2], 0.3, 0.3, 0.3), PALETTE.moteCore, 0.98);
        this.drawMesh(this.meshes.sphereLow, sm.setTRS(mote.pos[0] + swayX, mote.pos[1] + bob, mote.pos[2], 0.58, 0.58, 0.58), PALETTE.moteHalo, 0.45);
      }
      for (let i = 0; i < engine.shades.length; i++) {
        const shade = engine.shades[i];
        const sx = shade.pos[0], sy = shade.pos[1], sz = shade.pos[2];
        const isStunned = shade.state === 'stunned';
        const isSpawning = shade.state === 'spawning';
        const hover = isStunned ? -0.15 : isSpawning ? -0.35 : Math.sin(timeSec * 4.0 + sx) * 0.1;
        this.drawMesh(this.meshes.sphereLow, sm.setTRS(sx, sy + hover, sz, isStunned ? 1.3 : 1.05, isStunned ? 0.55 : 1.35, isStunned ? 1.3 : 1.05), isStunned ? PALETTE.shadeStun : PALETTE.shadeBody, isStunned ? 0.25 : 0.05);
        this.drawMesh(this.meshes.ring, sm.setTRS(sx, sy - 0.65, sz, 0.85, 1, 0.85), shadeRimColor, 0.85);
        const sYaw = Math.atan2(engine.player.pos[0] - sx, engine.player.pos[2] - sz);
        this.drawMesh(this.meshes.cube, sm.setTRS(sx + Math.sin(sYaw) * 0.44, sy + hover + 0.2, sz + Math.cos(sYaw) * 0.44, 0.34, 0.1, 0.1, sYaw), shadeRimColor, 0.95);
      }
    }

    // 4. Render Wind Charms (Bùa Gió: #C8102E + gold #F2C14E)
    for (let i = 0; i < engine.charms.length; i++) {
      const charm = engine.charms[i];
      if (!charm.available) continue;
      const mapC = engine.map.charms.find(c => c.id === charm.id);
      if (!mapC) continue;
      const cx = mapC.pos[0], cy = mapC.pos[1] + 0.85 + Math.sin(timeSec * 3.0) * 0.15, cz = mapC.pos[2];
      this.drawMesh(this.meshes.cube, sm.setTRS(cx, cy, cz, 0.55, 0.8, 0.14, timeSec * 2.5), PALETTE.goldUi, 0.65);
      this.drawMesh(this.meshes.cube, sm.setTRS(cx, cy, cz, 0.4, 0.65, 0.18, timeSec * 2.5), PALETTE.mayScarf, 0.5);
    }

    // 6. Render Drifters (Gió Lạc #8FA3B8) with 3-segment undulating silk ribbon trail
    for (let i = 0; i < engine.drifters.length; i++) {
      const drifter = engine.drifters[i];
      if (drifter.state === 'removed') continue;
      const dx = drifter.pos[0], dy = drifter.pos[1] + Math.sin(timeSec * 5.0) * 0.2, dz = drifter.pos[2];
      this.drawMesh(this.meshes.cube, sm.setTRS(dx, dy, dz, 1.3, 0.16, 0.42, timeSec * 4.0), PALETTE.drifter, 0.65);
      for (let t = 1; t <= 3; t++) {
        const ta = timeSec * 4.0 - t * 0.55;
        const tx = dx - Math.cos(ta) * t * 0.35;
        const tz = dz - Math.sin(ta) * t * 0.35;
        const ty = dy + Math.sin(timeSec * 6.0 - t) * 0.12;
        this.drawMesh(this.meshes.cube, sm.setTRS(tx, ty, tz, 0.55 - t * 0.1, 0.12, 0.3 - t * 0.05, ta), PALETTE.drifter, 0.45);
      }
      if (drifter.stolen > 0) {
        this.drawMesh(this.meshes.sphereLow, sm.setTRS(dx, dy + 0.35, dz, 0.32, 0.32, 0.32), PALETTE.moteCore, 0.9);
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
      this.drawMesh(this.meshes.ring, sm.setTRS(w.pos[0], w.pos[1] + 0.2, w.pos[2], r, 1, r), PALETTE.lanternCore, 0.95);
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
      this.drawMesh(this.meshes.sphereLow, sm.setTRS(p.pos[0], p.pos[1], p.pos[2], s, s, s), p.color, 0.95);
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
      this.drawMesh(this.meshes.cylinder, sm.setTRS(tr.pos[0], tr.pos[1] + 0.72, tr.pos[2], 0.45 * k, 0.95 * k, 0.45 * k), PALETTE.lanternCore, 0.75);
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
        this.drawMesh(this.meshes.cube, sm.setTRS(ox, oy, oz, 0.28, 0.08, 0.16, timeSec * 3 + i), PALETTE.goldUi, 0.6);
      }
    }

    // 9. Creative Side Character: Ông Đăng (disabled in benchmarkMode)
    if (!benchmarkMode) {
      const ox = 2.8, oz = engine.night === 3 ? -14.5 : -2.5;
      const oy = 0;
      const nod = Math.sin(timeSec * 2.0) * 0.05;
      const distToMay = Math.hypot(engine.player.pos[0] - ox, engine.player.pos[2] - oz);
      const staffRaise = distToMay < 5.0 ? 0.25 + 0.1 * Math.sin(timeSec * 5.0) : 0;
      this.drawMesh(this.meshes.cylinder, sm.setTRS(ox, oy + 0.82, oz, 0.58, 1.15, 0.58), PALETTE.wood);
      this.drawMesh(this.meshes.sphere, sm.setTRS(ox, oy + 1.58 + nod, oz, 0.42, 0.42, 0.42), [0.92, 0.78, 0.68]);
      this.drawMesh(this.meshes.cone, sm.setTRS(ox, oy + 1.38 + nod, oz + 0.18, 0.24, -0.36, 0.18), PALETTE.mayRobe);
      this.drawMesh(this.meshes.cone, sm.setTRS(ox, oy + 1.88 + nod, oz, 1.1, 0.44, 1.1), PALETTE.sand);
      this.drawMesh(this.meshes.cylinder, sm.setTRS(ox - 0.55, oy + 1.05 + staffRaise, oz + 0.2, 0.08, 2.1, 0.08), PALETTE.wood);
      this.drawMesh(this.meshes.sphere, sm.setTRS(ox - 0.55, oy + 2.15 + staffRaise, oz + 0.2, 0.28, 0.34, 0.28), PALETTE.lanternLit, 0.9);
      if (distToMay < 5.0) {
        this.drawMesh(this.meshes.ring, sm.setTRS(ox, oy + 0.05, oz, 1.1, 1, 1.1), PALETTE.goldUi, 0.6);
      }
    }

    // 10. Render Hero Mây + Creative Spirit Guide "Đốm Tiên"
    if (engine.player.respawnTicks === 0) {
      const invulnVisible = reducedMotion || engine.player.invulnTicks === 0 || Math.floor(engine.player.invulnTicks / 4) % 2 === 0;
      if (invulnVisible) {
        const px = engine.player.pos[0], py = engine.player.pos[1], pz = engine.player.pos[2];
        const yaw = Math.atan2(engine.player.facing[0], engine.player.facing[1]);
        const speed = Math.hypot(engine.player.vel[0], engine.player.vel[2]);
        const moving = speed > 0.2 && engine.player.grounded;
        const walkPhase = timeSec * 14.0;
        const walkBob = moving ? Math.abs(Math.sin(walkPhase)) * 0.08 : 0;
        const stride = moving ? Math.sin(walkPhase) * 0.22 : 0;

        const fx = Math.sin(yaw), fz = Math.cos(yaw);
        const rx = fz, rz = -fx;
        this.drawMesh(this.meshes.sphere, sm.setTRS(px + rx * 0.14 + fx * stride, py + 0.14, pz + rz * 0.14 + fz * stride, 0.2, 0.18, 0.26), PALETTE.wood);
        this.drawMesh(this.meshes.sphere, sm.setTRS(px - rx * 0.14 - fx * stride, py + 0.14, pz - rz * 0.14 - fz * stride, 0.2, 0.18, 0.26), PALETTE.wood);

        this.drawMesh(this.meshes.cylinder, sm.setTRS(px, py + 0.72 + walkBob, pz, 0.52, 1.0, 0.52), PALETTE.mayRobe);
        this.drawMesh(this.meshes.cylinder, sm.setTRS(px, py + 1.22 + walkBob, pz, 0.42, 0.16, 0.42), PALETTE.mayScarf);
        const tailWave = Math.sin(timeSec * (moving ? 12.0 : 5.0)) * (moving ? 0.14 : 0.06);
        const tx1 = px - fx * 0.34 + rx * tailWave;
        const tz1 = pz - fz * 0.34 + rz * tailWave;
        this.drawMesh(this.meshes.cube, sm.setTRS(tx1, py + 1.12 + walkBob, tz1, 0.18, 0.28, 0.08, yaw), PALETTE.mayScarf);
        const tx2 = px - fx * (0.44 + (moving ? 0.12 : 0.0)) + rx * tailWave * 1.7;
        const tz2 = pz - fz * (0.44 + (moving ? 0.12 : 0.0)) + rz * tailWave * 1.7;
        this.drawMesh(this.meshes.cube, sm.setTRS(tx2, py + 0.92 + walkBob, tz2, 0.15, 0.22, 0.07, yaw), PALETTE.mayScarf);

        this.drawMesh(this.meshes.sphere, sm.setTRS(px, py + 1.46 + walkBob, pz, 0.44, 0.44, 0.44), [0.92, 0.78, 0.68]);
        this.drawMesh(this.meshes.cone, sm.setTRS(px, py + 1.80 + walkBob, pz, 1.18, 0.48, 1.18), PALETTE.sand);

        const sway = Math.sin(timeSec * 6.0) * 0.06;
        const lx = px + Math.sin(yaw + 0.75) * 0.6 + sway;
        const lz = pz + Math.cos(yaw + 0.75) * 0.6;
        const lanternScale = 1.0 + 0.35 * carryFrac;
        this.drawMesh(this.meshes.cube, sm.setTRS(lx, py + 1.38 + walkBob, lz, 0.22 * lanternScale, 0.28 * lanternScale, 0.22 * lanternScale), PALETTE.lanternLit, 0.95);
        this.drawMesh(this.meshes.sphere, sm.setTRS(lx, py + 1.38 + walkBob, lz, 0.16 * lanternScale, 0.16 * lanternScale, 0.16 * lanternScale), PALETTE.lanternCore, 1.0);

        if (engine.player.charmTicks > 0) {
          this.drawMesh(this.meshes.ring, sm.setTRS(px, py + 0.08, pz, 1.05, 1, 1.05, timeSec * 4.0), PALETTE.mayScarf, 0.85);
          this.drawMesh(this.meshes.ring, sm.setTRS(px, py + 0.12, pz, 1.22, 1, 1.22, -timeSec * 4.0), PALETTE.goldUi, 0.85);
        }

        if (!benchmarkMode) {
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
          this.drawMesh(this.meshes.sphereLow, sm.setTRS(gx, gy, gz, 0.22, 0.22, 0.22), PALETTE.moteCore, 0.98);
          this.drawMesh(this.meshes.cube, sm.setTRS(gx, gy + 0.08, gz, 0.48, 0.06, 0.12, timeSec * 6.0), PALETTE.lanternCore, 0.85);
        }
      }
    }
  }
}
