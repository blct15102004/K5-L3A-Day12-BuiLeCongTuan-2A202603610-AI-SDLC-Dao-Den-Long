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

    // Player little lantern light
    float pDist = length(uPlayerPos + vec3(0.0, 1.2, 0.0) - vFragPos);
    float pAtten = 1.0 / (1.0 + 0.28 * pDist + 0.08 * pDist * pDist);
    vec3 pLight = vec3(1.0, 0.78, 0.35) * pAtten * 1.15;

    // Up to 7 Big Lanterns
    vec3 lanternTotal = vec3(0.0);
    for (int i = 0; i < 7; i++) {
      if (i >= uLanternCount) break;
      float isLit = uLanternLit[i];
      float lDist = length(uLanternLights[i] + vec3(0.0, 2.2, 0.0) - vFragPos);
      float intensity = mix(0.25, 2.8, isLit);
      float atten = intensity / (1.0 + 0.08 * lDist + 0.02 * lDist * lDist);
      vec3 lColor = mix(vec3(0.45, 0.48, 0.55), vec3(1.0, 0.76, 0.30), isLit);
      lanternTotal += lColor * atten;
    }

    vec3 litColor = ambient + diffuse + (pLight + lanternTotal) * vColor;
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
    this.initProgram();
    this.initMeshes();

    this.gl.enable(this.gl.DEPTH_TEST);
    this.gl.clearColor(PALETTE.sky[0], PALETTE.sky[1], PALETTE.sky[2], 1.0);
  }

  triggerPulseWave(pos) {
    this.pulseWaves.push({ pos: [...pos], age: 0, maxAge: 0.45 });
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

  render(engine, camera, dtSec = 1 / 60) {
    const gl = this.gl;
    if (!gl) return;

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.program);

    const { proj, view } = this.getViewProjection(camera);
    gl.uniformMatrix4fv(this.uniforms.projection, false, proj.m);
    gl.uniformMatrix4fv(this.uniforms.view, false, view.m);

    const litCount = engine.lanterns.filter(l => l.lit).length;
    const totalLanterns = Math.max(1, engine.lanterns.length);
    const ambientIntensity = 0.15 + 0.55 * (litCount / totalLanterns);

    const lPosArray = new Float32Array(21);
    const lLitArray = new Float32Array(7);
    const count = Math.min(7, engine.lanterns.length);
    for (let i = 0; i < count; i++) {
      const l = engine.lanterns[i];
      lPosArray[i * 3] = l.pos[0];
      lPosArray[i * 3 + 1] = l.pos[1];
      lPosArray[i * 3 + 2] = l.pos[2];
      lLitArray[i] = l.lit ? 1.0 : 0.0;
    }

    gl.uniform3fv(this.uniforms.lanternLights, lPosArray);
    gl.uniform1fv(this.uniforms.lanternLit, lLitArray);
    gl.uniform1i(this.uniforms.lanternCount, count);
    gl.uniform3fv(this.uniforms.playerPos, new Float32Array(engine.player.pos));
    gl.uniform1f(this.uniforms.ambientIntensity, ambientIntensity);
    gl.uniform3fv(this.uniforms.fogColor, PALETTE.fog);

    const timeSec = engine.simTick / 60.0;

    // 0. Sea of Clouds plane (#12384A)
    const cloudMat = new Mat4().translate(30, -14.0, 0).scale(220, 0.5, 220);
    this.drawMesh(this.meshes.cube, cloudMat, PALETTE.cloudSea, 0.25);

    // 1. Render Island Geometry by Night
    if (engine.night === 1) {
      this.drawMesh(this.meshes.cylinder, new Mat4().translate(0, -1.5, 0).scale(40, 3.0, 40), PALETTE.sand);
      this.drawMesh(this.meshes.cylinder, new Mat4().translate(0, -0.45, 0).scale(38.5, 1.0, 38.5), PALETTE.grass);
    } else if (engine.night === 2) {
      for (const cx of [0, 70]) {
        this.drawMesh(this.meshes.cylinder, new Mat4().translate(cx, -1.5, 0).scale(28, 3.0, 28), PALETTE.sand);
        this.drawMesh(this.meshes.cylinder, new Mat4().translate(cx, -0.45, 0).scale(26.5, 1.0, 26.5), PALETTE.grass);
      }
      // Bamboo bridge x in [26, 44], z in [-2, 2]
      this.drawMesh(this.meshes.cube, new Mat4().translate(35, -0.25, 0).scale(18, 0.5, 4), PALETTE.wood);
    } else if (engine.night === 3) {
      // Tier 0 (r=45, Y=0)
      this.drawMesh(this.meshes.cylinder, new Mat4().translate(0, -1.5, 0).scale(45, 3.0, 45), PALETTE.sand);
      this.drawMesh(this.meshes.cylinder, new Mat4().translate(0, -0.45, 0).scale(43.5, 1.0, 43.5), PALETTE.grass);
      // Tier 1 (half-annulus r=12..24, z>0, Y=3)
      this.drawMesh(this.meshes.halfAnnulus, new Mat4(), PALETTE.grass);
      // Tier 2 (disc r=8, Y=6)
      this.drawMesh(this.meshes.cylinder, new Mat4().translate(0, 3.0, 0).scale(8, 6.0, 8), PALETTE.sand);
      this.drawMesh(this.meshes.cylinder, new Mat4().translate(0, 5.6, 0).scale(7.9, 0.9, 7.9), PALETTE.grass);
      // Two ramps at 30 deg and 150 deg (rotateY(-rad) maps +X to (cos, sin))
      this.drawMesh(this.meshes.ramp, new Mat4().rotateY(-Math.PI / 6), PALETTE.wood);
      this.drawMesh(this.meshes.ramp, new Mat4().rotateY(-(5 * Math.PI) / 6), PALETTE.wood);
      // Bell Tower at (0, 6, 0), radius 2, height 8
      this.drawMesh(this.meshes.cylinder, new Mat4().translate(0, 10.0, 0).scale(2.0, 8.0, 2.0), PALETTE.wood);
      this.drawMesh(this.meshes.cone, new Mat4().translate(0, 15.0, 0).scale(3.2, 2.2, 3.2), PALETTE.mayScarf);
      this.drawMesh(this.meshes.sphere, new Mat4().translate(0, 11.2, 0).scale(1.1, 1.3, 1.1), PALETTE.goldUi, 0.4);
    }

    // Launch Pads
    for (const pad of engine.map.launchPads) {
      this.drawMesh(this.meshes.cylinder, new Mat4().translate(pad.pos[0], pad.pos[1] + 0.08, pad.pos[2]).scale(1.0, 0.16, 1.0), PALETTE.goldUi, 0.65);
      this.drawMesh(this.meshes.ring, new Mat4().translate(pad.pos[0], pad.pos[1] + 0.18, pad.pos[2]).scale(1.1, 1, 1.1), PALETTE.lanternCore, 0.8);
    }

    // 2. Render Lanterns
    for (const lantern of engine.lanterns) {
      const lx = lantern.pos[0], ly = lantern.pos[1], lz = lantern.pos[2];
      this.drawMesh(this.meshes.cube, new Mat4().translate(lx, ly + 0.5, lz).scale(1.1, 1.0, 1.1), PALETTE.wood);
      this.drawMesh(this.meshes.cylinder, new Mat4().translate(lx, ly + 1.5, lz).scale(0.35, 1.2, 0.35), PALETTE.wood);
      const coreColor = lantern.lit ? PALETTE.lanternCore : PALETTE.lanternOff;
      const rimColor = lantern.lit ? PALETTE.lanternLit : PALETTE.lanternOff;
      this.drawMesh(this.meshes.cube, new Mat4().translate(lx, ly + 2.4, lz).scale(0.85, 0.85, 0.85), coreColor, lantern.lit ? 0.85 : 0.05);
      this.drawMesh(this.meshes.cone, new Mat4().translate(lx, ly + 3.1, lz).scale(1.7, 0.65, 1.7), rimColor, lantern.lit ? 0.35 : 0.0);
      if (lantern.lit) {
        this.drawMesh(this.meshes.ring, new Mat4().translate(lx, ly + 0.06, lz).scale(6.0, 1.0, 6.0), PALETTE.lanternLit, 0.55);
      }
    }

    // 3. Render Motes (Core #FFF6C2 + Halo #FFE58A)
    for (const mote of engine.motes) {
      const bob = Math.sin(timeSec * 3.5 + mote.pos[0]) * 0.18 + 0.45;
      const mx = mote.pos[0], my = mote.pos[1] + bob, mz = mote.pos[2];
      this.drawMesh(this.meshes.sphere, new Mat4().translate(mx, my, mz).scale(0.32, 0.32, 0.32), PALETTE.moteCore, 0.95);
      this.drawMesh(this.meshes.sphere, new Mat4().translate(mx, my, mz).scale(0.55, 0.55, 0.55), PALETTE.moteHalo, 0.45);
    }

    // 4. Render Wind Charms (Bùa Gió: #C8102E + gold #F2C14E)
    for (const charm of engine.charms) {
      if (!charm.available) continue;
      const mapC = engine.map.charms.find(c => c.id === charm.id);
      if (!mapC) continue;
      const cx = mapC.pos[0], cy = mapC.pos[1] + 0.8 + Math.sin(timeSec * 3.0) * 0.15, cz = mapC.pos[2];
      this.drawMesh(this.meshes.cube, new Mat4().translate(cx, cy, cz).rotateY(timeSec * 2.5).scale(0.55, 0.8, 0.14), PALETTE.goldUi, 0.65);
      this.drawMesh(this.meshes.cube, new Mat4().translate(cx, cy, cz).rotateY(timeSec * 2.5).scale(0.4, 0.65, 0.18), PALETTE.mayScarf, 0.5);
    }

    // 5. Render Shades (Body #120A1A, Rim #7A3CFF, Stunned #3A3450)
    for (const shade of engine.shades) {
      const sx = shade.pos[0], sy = shade.pos[1], sz = shade.pos[2];
      const isStunned = shade.state === 'stunned';
      const isSpawning = shade.state === 'spawning';
      const sc = isStunned ? [1.3, 0.55, 1.3] : isSpawning ? [0.6, 0.6, 0.6] : [1.05, 1.35, 1.05];
      const bodyCol = isStunned ? PALETTE.shadeStun : PALETTE.shadeBody;
      this.drawMesh(this.meshes.sphere, new Mat4().translate(sx, sy, sz).scale(sc[0], sc[1], sc[2]), bodyCol, isStunned ? 0.25 : 0.05);
      this.drawMesh(this.meshes.ring, new Mat4().translate(sx, sy - 0.65, sz).scale(0.8, 1, 0.8), PALETTE.shadeRim, 0.75);
      this.drawMesh(this.meshes.cube, new Mat4().translate(sx, sy + 0.2, sz + 0.38).scale(0.28, 0.12, 0.12), PALETTE.shadeRim, 0.9);
    }

    // 6. Render Drifters (Gió Lạc #8FA3B8)
    for (const drifter of engine.drifters) {
      if (drifter.state === 'removed') continue;
      const dx = drifter.pos[0], dy = drifter.pos[1] + Math.sin(timeSec * 5.0) * 0.2, dz = drifter.pos[2];
      this.drawMesh(
        this.meshes.cube,
        new Mat4().translate(dx, dy, dz).rotateY(timeSec * 4.0).scale(1.4, 0.18, 0.45),
        PALETTE.drifter,
        0.55
      );
      if (drifter.stolen > 0) {
        this.drawMesh(this.meshes.sphere, new Mat4().translate(dx, dy + 0.35, dz).scale(0.32, 0.32, 0.32), PALETTE.moteCore, 0.9);
      }
    }

    // 7. Render Pulse Shockwaves
    for (let i = this.pulseWaves.length - 1; i >= 0; i--) {
      const w = this.pulseWaves[i];
      w.age += dtSec;
      if (w.age >= w.maxAge) {
        this.pulseWaves.splice(i, 1);
        continue;
      }
      const r = 0.6 + (w.age / w.maxAge) * 5.0;
      this.drawMesh(this.meshes.ring, new Mat4().translate(w.pos[0], w.pos[1] + 0.2, w.pos[2]).scale(r, 1, r), PALETTE.lanternCore, 0.95);
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

    // 9. Render Mây (Hide during respawn wait, blink when invuln)
    if (engine.player.respawnTicks === 0) {
      const invulnVisible = engine.player.invulnTicks === 0 || Math.floor(engine.player.invulnTicks / 4) % 2 === 0;
      if (invulnVisible) {
        const px = engine.player.pos[0], py = engine.player.pos[1], pz = engine.player.pos[2];
        const yaw = Math.atan2(engine.player.facing[0], engine.player.facing[1]);

        // Robe (#E8E2D0)
        this.drawMesh(this.meshes.cylinder, new Mat4().translate(px, py + 0.75, pz).scale(0.55, 1.05, 0.55), PALETTE.mayRobe);
        // Red Scarf (#C8102E)
        this.drawMesh(this.meshes.cylinder, new Mat4().translate(px, py + 1.25, pz).scale(0.42, 0.18, 0.42), PALETTE.mayScarf);
        // Head
        this.drawMesh(this.meshes.sphere, new Mat4().translate(px, py + 1.48, pz).scale(0.46, 0.46, 0.46), [0.92, 0.78, 0.68]);
        // Conical Hat (Nón lá)
        this.drawMesh(this.meshes.cone, new Mat4().translate(px, py + 1.82, pz).scale(1.15, 0.48, 1.15), PALETTE.sand);
        // Hanging mini lantern on brim
        const sway = Math.sin(timeSec * 6.0) * 0.08;
        const lx = px + Math.sin(yaw + 0.7) * 0.55 + sway;
        const lz = pz + Math.cos(yaw + 0.7) * 0.55;
        this.drawMesh(this.meshes.cube, new Mat4().translate(lx, py + 1.38, lz).scale(0.22, 0.28, 0.22), PALETTE.lanternLit, 0.9);
      }
    }
  }
}
