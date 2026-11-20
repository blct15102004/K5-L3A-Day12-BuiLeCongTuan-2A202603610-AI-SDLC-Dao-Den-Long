import { Mat4 } from './matrix4.js';
import { PALETTE } from '../core/constants.js';
import { buildNightSceneryData } from './scenery.js';
import { uploadHeroModel, renderHeroModel } from './hero-model.js';
import { uploadEntityModels, renderGreatLanterns, renderSculptedMonsters, renderDetailedFireflies, renderSkillCardsAndProjectiles, getShadeVariant, getMoteColor } from './entity-models.js';

const SHARED_FS_BODY = `
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
  uniform vec3 uCameraPos;
  uniform float uUnlitEmissive;

  void main() {
    vec3 hdrColor;
    if (uUnlitEmissive > 0.94) {
      hdrColor = vColor * 1.28;
    } else {
      vec3 normal = normalize(vNormal);
      vec3 viewDir = normalize(uCameraPos - vFragPos);

      // Hemisphere twilight ambient + 3D vertical depth AO
      float hemi = normal.y * 0.5 + 0.5;
      vec3 groundBounce = vec3(0.11, 0.25, 0.33);
      vec3 skyBounce = vec3(0.30, 0.38, 0.62);
      float verticalAO = clamp((vFragPos.y + 8.5) / 9.2, 0.46, 1.04);
      vec3 ambient = mix(groundBounce, skyBounce, hemi) * (0.95 + 1.35 * uAmbientIntensity) * verticalAO * vColor;

      // Velvety Anime Cel-Shading + Violet-Rose Subsurface Terminator + Cartoon Ink-Edge
      vec3 moonDir = vec3(0.24, 0.62, 0.75);
      float ndl = dot(normal, moonDir) * 0.5 + 0.5;
      float cel = smoothstep(0.20, 0.34, ndl) * 0.64 + smoothstep(0.56, 0.70, ndl) * 0.36;
      float softWrap = mix(ndl * ndl, cel, 0.82);
      vec3 diffuse = softWrap * (0.50 + 0.52 * uAmbientIntensity) * vec3(0.94, 0.97, 1.0) * verticalAO * vColor;
      float term = smoothstep(0.36, 0.48, ndl) * (1.0 - smoothstep(0.48, 0.62, ndl));
      vec3 sss = vec3(0.38, 0.20, 0.48) * term * 0.30 * vColor;

      // Fast Cubic Fresnel & Cartoon / Anime Ink-Contour Silhouette Edge (zero pow/smoothstep)
      float ndv = max(dot(normal, viewDir), 0.0);
      float invNdv = 1.0 - ndv;
      float fresnel = invNdv * invNdv * invNdv;
      float cartoonEdge = 1.0 - fresnel * 0.38;

      // Stylized anime specular highlight
      vec3 halfV = normalize(moonDir + viewDir);
      float spec = smoothstep(0.86, 0.95, max(dot(normal, halfV), 0.0)) * 0.30;
      vec3 specCol = vec3(0.95, 0.98, 1.0) * spec * (0.45 + 0.55 * uAmbientIntensity);

      // Dual Fresnel Rim (moonlight + warm lantern glow)
      vec3 rimMoon = vec3(0.44, 0.72, 1.0) * fresnel * (0.28 + 0.18 * uAmbientIntensity);

      // Player handheld swinging lantern warm light (sqrt-free attenuation)
      vec3 pVec = uPlayerPos - vFragPos;
      float pDistSq = dot(pVec, pVec);
      float pAtten = 1.0 / (1.0 + 0.085 * pDistSq);
      vec3 pLight = vec3(1.0, 0.76, 0.34) * pAtten * uPlayerGlowStrength;
      vec3 rimLantern = vec3(1.0, 0.74, 0.30) * fresnel * clamp(pAtten * 1.4, 0.0, 1.0) * 0.42;

      // Pulse illumination wave
      vec3 pulseVec = uPulsePos + vec3(0.0, 0.8, 0.0) - vFragPos;
      float pulseAtten = 1.0 / (1.0 + 0.11 * dot(pulseVec, pulseVec));
      vec3 pulseLight = vec3(1.0, 0.86, 0.42) * pulseAtten * uPulseStrength;

      // Up to 7 Lit Great Lanterns (packed active lights only, zero wasted loop iterations!)
      vec3 lanternTotal = vec3(0.0);
      for (int i = 0; i < 7; i++) {
        if (i >= uLanternCount) break;
        vec3 lVec = uLanternLights[i] + vec3(0.0, 2.2, 0.0) - vFragPos;
        float atten = (3.05 * uLanternLit[i]) / (1.0 + 0.032 * dot(lVec, lVec));
        lanternTotal += vec3(1.0, 0.76, 0.30) * atten;
      }

      hdrColor = (ambient + diffuse + sss) * cartoonEdge + specCol + rimMoon + rimLantern + (pLight + pulseLight + lanternTotal) * vColor;
      hdrColor = mix(hdrColor, vColor * 1.28, uUnlitEmissive);
    }

    // Vibrance boost + ACES Filmic Tone-Mapping
    float luma = dot(hdrColor, vec3(0.2126, 0.7152, 0.0722));
    vec3 vibColor = mix(vec3(luma), hdrColor, 1.16);
    vec3 x = max(vec3(0.0), vibColor);
    vec3 mapped = clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);

    // Multi-stage aerial perspective & horizon depth mist (single sqrt per pixel)
    float camDist = length(vFragPos - uCameraPos);
    float distFog = smoothstep(22.0, 128.0, camDist) * 0.92;
    float heightMist = clamp((0.25 - vFragPos.y) / 9.5, 0.0, 0.64);
    float fogFactor = clamp(max(distFog, heightMist * 0.78), 0.0, 0.94);
    vec3 skyFog = mix(uFogColor, vec3(0.22, 0.34, 0.58), clamp((vFragPos.y + 8.0) / 48.0, 0.0, 0.68));

    gl_FragColor = vec4(mix(mapped, skyFog, fogFactor), 1.0);
  }
`;

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

const VS_SCENERY_SOURCE = `
  attribute vec3 aPosition;
  attribute vec3 aNormal;
  attribute vec3 aColor;

  uniform mat4 uView;
  uniform mat4 uProjection;

  varying vec3 vNormal;
  varying vec3 vFragPos;
  varying vec3 vColor;

  void main() {
    vFragPos = aPosition;
    vNormal = aNormal;
    vColor = aColor;
    gl_Position = uProjection * uView * vec4(aPosition, 1.0);
  }
`;

const VS_COLORED_MODEL_SOURCE = `
  attribute vec3 aPosition;
  attribute vec3 aNormal;
  attribute vec3 aColor;

  uniform mat4 uModel;
  uniform mat4 uView;
  uniform mat4 uProjection;

  varying vec3 vNormal;
  varying vec3 vFragPos;
  varying vec3 vColor;

  void main() {
    vec4 worldPos = uModel * vec4(aPosition, 1.0);
    vFragPos = worldPos.xyz;
    vNormal = mat3(uModel) * aNormal;
    vColor = aColor;
    gl_Position = uProjection * uView * worldPos;
  }
`;

const VS_FOLIAGE_SOURCE = `
  attribute vec3 aPosition;
  attribute vec3 aNormal;
  attribute vec3 aColor;
  attribute vec2 aSway;

  uniform mat4 uView;
  uniform mat4 uProjection;
  uniform float uTime;
  uniform vec2 uWindDir;
  uniform float uWindStrength;

  varying vec3 vNormal;
  varying vec3 vFragPos;
  varying vec3 vColor;

  void main() {
    vec3 wp = aPosition;
    float w = aSway.x;
    float ph = aSway.y;
    if (w > 0.001) {
      float quadW = w * w;
      float wave = sin(uTime * 1.9 + wp.x * 0.16 + wp.z * 0.14 + ph);
      float gust = cos(uTime * 1.05 - wp.x * 0.09 + wp.z * 0.11);
      float bend = (gust * 0.65 + wave * 0.55) * uWindStrength;
      wp.x += (uWindDir.x * (0.09 + 0.15 * uWindStrength) + 0.12 * bend) * quadW;
      wp.z += (uWindDir.y * (0.09 + 0.15 * uWindStrength) + 0.10 * wave * uWindStrength) * quadW;
      wp.y -= min(0.22, 0.07 * abs(bend)) * quadW;
    }
    vFragPos = wp;
    vNormal = aNormal;
    vColor = aColor;
    gl_Position = uProjection * uView * vec4(wp, 1.0);
  }
`;

const VS_GLOW_SOURCE = `
  attribute vec2 aQuad;
  attribute vec4 aGlowPosSize;
  attribute vec4 aGlowColorAlpha;

  uniform mat4 uView;
  uniform mat4 uProjection;
  uniform vec3 uCamRight;
  uniform vec3 uCamUp;

  varying vec2 vUv;
  varying vec4 vColorAlpha;

  void main() {
    vec3 worldPos = aGlowPosSize.xyz + (uCamRight * aQuad.x + uCamUp * aQuad.y) * aGlowPosSize.w;
    vUv = aQuad.xy * 2.0;
    vColorAlpha = aGlowColorAlpha;
    gl_Position = uProjection * uView * vec4(worldPos, 1.0);
  }
`;

const VS_GLOW_FALLBACK_SOURCE = `
  attribute vec2 aQuad;

  uniform mat4 uView;
  uniform mat4 uProjection;
  uniform vec3 uCamRight;
  uniform vec3 uCamUp;
  uniform vec4 uGlowPosSize;
  uniform vec4 uGlowColorAlpha;

  varying vec2 vUv;
  varying vec4 vColorAlpha;

  void main() {
    vec3 worldPos = uGlowPosSize.xyz + (uCamRight * aQuad.x + uCamUp * aQuad.y) * uGlowPosSize.w;
    vUv = aQuad.xy * 2.0;
    vColorAlpha = uGlowColorAlpha;
    gl_Position = uProjection * uView * vec4(worldPos, 1.0);
  }
`;

const FS_GLOW_SOURCE = `
  precision mediump float;

  varying vec2 vUv;
  varying vec4 vColorAlpha;

  void main() {
    float r2 = dot(vUv, vUv);
    if (r2 >= 1.0) discard;
    float edge = 1.0 - r2;
    float e2 = edge * edge;
    float e4 = e2 * e2;
    float softBlur = edge * e2;
    float dreamyHalo = e4 * e2 * 0.45;
    float brightCore = e4 * e4 * e4 * 0.55;
    float alpha = clamp((softBlur + dreamyHalo + brightCore) * vColorAlpha.a, 0.0, 1.0);
    vec3 col = mix(vColorAlpha.rgb, vec3(1.0, 0.99, 0.93), brightCore * 0.42);
    gl_FragColor = vec4(col, alpha);
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

const HUMAN_PALETTE = {
  skin: [0.95, 0.79, 0.66],
  cheek: [0.94, 0.56, 0.54],
  hair: [0.11, 0.12, 0.18],
  eyeWhite: [0.98, 0.98, 1.0],
  pants: [0.18, 0.21, 0.30],
  legWrap: [0.87, 0.84, 0.75],
  sandal: [0.43, 0.29, 0.19],
  moonDisc: [1.0, 0.96, 0.84],
  moonHalo: [0.94, 0.88, 0.68],
  ember: [1.0, 0.72, 0.28],
  lanternRib: [0.92, 0.42, 0.16],
  jadeAmulet: [0.25, 0.96, 0.78]
};

export class WebGLRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      depth: true,
      stencil: false,
      powerPreference: 'high-performance'
    });
    if (!this.gl) return;

    this.pulseWaves = [];
    this.particles = [];
    this.dashTrails = [];
    this.dashSmoke = [];
    this.pickupFlies = [];
    this.pickupRings = [];
    this.skillBursts = [];
    this.monsterVis = new Map();
    this.monsterVisFrame = 0;

    // Reusable scratch & hierarchy joint matrices (zero per-frame heap allocations)
    this.scratchMat = new Mat4();
    this.projMat = new Mat4();
    this.viewMat = new Mat4();
    this.vpMat = new Mat4();
    this.identityMat = new Mat4();
    this.rampMatA = new Mat4().rotateY(-Math.PI / 6);
    this.rampMatB = new Mat4().rotateY(-(5 * Math.PI) / 6);
    this.upVec = [0, 1, 0];

    this.jRoot = new Mat4();
    this.jPelvis = new Mat4();
    this.jTorso = new Mat4();
    this.jHead = new Mat4();
    this.jHip = new Mat4();
    this.jKnee = new Mat4();
    this.jFoot = new Mat4();
    this.jShoulder = new Mat4();
    this.jElbow = new Mat4();
    this.jHand = new Mat4();
    this.jStick = new Mat4();
    this.jLantern = new Mat4();
    this.jDraw = new Mat4();
    this.jFlap = new Mat4();
    this.jChain = new Mat4();

    this.mayStridePhase = 0;
    this.mayVisualYaw = 0;
    this.mayVisualYawInit = false;
    this.mayVisualSpeed = 0;
    this.mayBankRoll = 0;
    this.mayDashBlend = 0;
    this.mayWindWorldX = 0;
    this.mayWindWorldZ = 0;
    this.mayLanternPos = [0, 1.2, 0];
    this.mayJadePos = [0, 0.7, 0];
    this.camPosF32 = new Float32Array(3);
    this.camRightF32 = new Float32Array(3);
    this.camUpF32 = new Float32Array(3);
    this.windDirF32 = new Float32Array([0.85, 0.52]);

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

    this.MAX_GLOWS = 2048;
    this.glowStrideFloats = 8;
    this.glowData = new Float32Array(this.MAX_GLOWS * this.glowStrideFloats);
    this.glowBuffer = this.instExt ? this.gl.createBuffer() : null;
    if (this.glowBuffer) {
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.glowBuffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, this.glowData.byteLength, this.gl.STREAM_DRAW);
    }
    this.glowPosSizeTmp = new Float32Array(4);
    this.glowColAlphaTmp = new Float32Array(4);

    this.nightSceneryGpuCache = {};

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

  resetVisualTrails() {
    this.pulseWaves.length = 0;
    this.particles.length = 0;
    this.dashTrails.length = 0;
    this.dashSmoke.length = 0;
    this.pickupFlies.length = 0;
    this.pickupRings.length = 0;
    this.skillBursts.length = 0;
    this.monsterVis.clear();
    this.mayVisualYawInit = false;
    this.mayVisualSpeed = 0;
    this.mayBankRoll = 0;
    this.mayDashBlend = 0;
    this.mayWindWorldX = 0;
    this.mayWindWorldZ = 0;
  }

  triggerMotePickupVfx(fromPos, color = PALETTE.moteCore) {
    this.pickupRings.push({
      pos: [fromPos[0], fromPos[1] + 0.08, fromPos[2]],
      color,
      age: 0,
      maxAge: 0.42
    });
    this.pickupFlies.push({
      from: [fromPos[0], fromPos[1] + 0.65, fromPos[2]],
      color,
      age: 0,
      maxAge: 0.46
    });
    this.spawnBurst(fromPos, color, 8, 2.4, 2.0);
  }

  triggerSkillImpactVfx(pos, color, coreColor) {
    this.skillBursts.push({
      pos: [pos[0], pos[1], pos[2]],
      color,
      coreColor: coreColor || PALETTE.moteCore,
      age: 0,
      maxAge: 0.56
    });
    this.spawnBurst(pos, color, 16, 5.2, 2.8);
    this.spawnBurst(pos, coreColor || PALETTE.moteCore, 8, 3.2, 3.6);
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
      cameraPos: gl.getUniformLocation(prog, 'uCameraPos'),
      unlitEmissive: gl.getUniformLocation(prog, 'uUnlitEmissive'),
      time: gl.getUniformLocation(prog, 'uTime'),
      windDir: gl.getUniformLocation(prog, 'uWindDir'),
      windStrength: gl.getUniformLocation(prog, 'uWindStrength')
    };
  }

  initProgram() {
    const gl = this.gl;
    const fs = createShader(gl, gl.FRAGMENT_SHADER, SHARED_FS_BODY);

    // 1. Standard Mesh Program
    const vs = createShader(gl, gl.VERTEX_SHADER, VS_SOURCE);
    this.program = gl.createProgram();
    gl.attachShader(this.program, vs);
    gl.attachShader(this.program, fs);
    gl.bindAttribLocation(this.program, 0, 'aPosition');
    gl.bindAttribLocation(this.program, 1, 'aNormal');
    gl.linkProgram(this.program);
    this.uniforms = this.collectUniforms(this.program);

    // 2. Instanced Entity Program
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

    // 3. Static Scenery Batch Program (aColor loc 2)
    const vsScenery = createShader(gl, gl.VERTEX_SHADER, VS_SCENERY_SOURCE);
    this.sceneryProgram = gl.createProgram();
    gl.attachShader(this.sceneryProgram, vsScenery);
    gl.attachShader(this.sceneryProgram, fs);
    gl.bindAttribLocation(this.sceneryProgram, 0, 'aPosition');
    gl.bindAttribLocation(this.sceneryProgram, 1, 'aNormal');
    gl.bindAttribLocation(this.sceneryProgram, 2, 'aColor');
    gl.linkProgram(this.sceneryProgram);
    this.sceneryUniforms = this.collectUniforms(this.sceneryProgram);

    // 4. Wind-Swaying Foliage Batch Program (aColor loc 2, aSway loc 3)
    const vsFoliage = createShader(gl, gl.VERTEX_SHADER, VS_FOLIAGE_SOURCE);
    this.foliageProgram = gl.createProgram();
    gl.attachShader(this.foliageProgram, vsFoliage);
    gl.attachShader(this.foliageProgram, fs);
    gl.bindAttribLocation(this.foliageProgram, 0, 'aPosition');
    gl.bindAttribLocation(this.foliageProgram, 1, 'aNormal');
    gl.bindAttribLocation(this.foliageProgram, 2, 'aColor');
    gl.bindAttribLocation(this.foliageProgram, 3, 'aSway');
    gl.linkProgram(this.foliageProgram);
    this.foliageUniforms = this.collectUniforms(this.foliageProgram);

    // 4b. Sculpted Multi-Colored Hero Model Program (aColor loc 2)
    const vsColoredModel = createShader(gl, gl.VERTEX_SHADER, VS_COLORED_MODEL_SOURCE);
    this.coloredModelProgram = gl.createProgram();
    gl.attachShader(this.coloredModelProgram, vsColoredModel);
    gl.attachShader(this.coloredModelProgram, fs);
    gl.bindAttribLocation(this.coloredModelProgram, 0, 'aPosition');
    gl.bindAttribLocation(this.coloredModelProgram, 1, 'aNormal');
    gl.bindAttribLocation(this.coloredModelProgram, 2, 'aColor');
    gl.linkProgram(this.coloredModelProgram);
    this.coloredModelUniforms = this.collectUniforms(this.coloredModelProgram);

    // 5. Soft-Blur Billboard Glow Program
    const fsGlow = createShader(gl, gl.FRAGMENT_SHADER, FS_GLOW_SOURCE);
    const vsGlow = createShader(gl, gl.VERTEX_SHADER, this.instExt ? VS_GLOW_SOURCE : VS_GLOW_FALLBACK_SOURCE);
    this.glowProgram = gl.createProgram();
    gl.attachShader(this.glowProgram, vsGlow);
    gl.attachShader(this.glowProgram, fsGlow);
    gl.bindAttribLocation(this.glowProgram, 0, 'aQuad');
    if (this.instExt) {
      gl.bindAttribLocation(this.glowProgram, 1, 'aGlowPosSize');
      gl.bindAttribLocation(this.glowProgram, 2, 'aGlowColorAlpha');
    }
    gl.linkProgram(this.glowProgram);
    this.glowUniforms = {
      view: gl.getUniformLocation(this.glowProgram, 'uView'),
      projection: gl.getUniformLocation(this.glowProgram, 'uProjection'),
      camRight: gl.getUniformLocation(this.glowProgram, 'uCamRight'),
      camUp: gl.getUniformLocation(this.glowProgram, 'uCamUp'),
      posSize: gl.getUniformLocation(this.glowProgram, 'uGlowPosSize'),
      colorAlpha: gl.getUniformLocation(this.glowProgram, 'uGlowColorAlpha')
    };
  }

  initMeshes() {
    this.meshes = {
      cube: this.createCube(),
      cylinder: this.createCylinder(24),
      limb: this.createCylinder(10),
      cone: this.createCone(20),
      sphere: this.createSphere(12, 12),
      sphereLow: this.createSphere(8, 8),
      halfAnnulus: this.createHalfAnnulus(12, 24, 3, 28),
      ramp: this.createRamp(3, 6, 3),
      ring: this.createRing(24),
      quad: this.createBillboardQuad()
    };
    this.heroModel = uploadHeroModel(this.gl);
    this.entityModels = null;
  }

  getEntityModels() {
    if (!this.entityModels && this.gl) {
      this.entityModels = uploadEntityModels(this.gl);
    }
    return this.entityModels;
  }

  createBillboardQuad() {
    const gl = this.gl;
    const posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5]), gl.STATIC_DRAW);
    const idxBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
    return { posBuffer: posBuf, idxBuffer: idxBuf, count: 6 };
  }

  createBufferMesh(positions, normals, colors, indices) {
    const gl = this.gl;
    const vao = {
      posBuffer: gl.createBuffer(),
      normBuffer: gl.createBuffer(),
      idxBuffer: gl.createBuffer(),
      count: indices.length
    };

    gl.bindBuffer(gl.ARRAY_BUFFER, vao.posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, vao.normBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, vao.idxBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

    return vao;
  }

  uploadSceneryChunk(chunk, withSway) {
    const gl = this.gl;
    const obj = {
      posBuffer: gl.createBuffer(),
      normBuffer: gl.createBuffer(),
      colBuffer: gl.createBuffer(),
      swayBuffer: withSway ? gl.createBuffer() : null,
      idxBuffer: gl.createBuffer(),
      count: chunk.count
    };
    gl.bindBuffer(gl.ARRAY_BUFFER, obj.posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, chunk.positions, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, obj.normBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, chunk.normals, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, obj.colBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, chunk.colors, gl.STATIC_DRAW);
    if (withSway) {
      gl.bindBuffer(gl.ARRAY_BUFFER, obj.swayBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, chunk.sway, gl.STATIC_DRAW);
    }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, obj.idxBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, chunk.indices, gl.STATIC_DRAW);
    return obj;
  }

  getNightScenery(night) {
    if (!this.nightSceneryGpuCache[night]) {
      const raw = buildNightSceneryData(night);
      this.nightSceneryGpuCache[night] = {
        staticChunks: raw.staticChunks.map(c => this.uploadSceneryChunk(c, false)),
        foliageChunks: raw.foliageChunks.map(c => this.uploadSceneryChunk(c, true)),
        ambientSpores: raw.ambientSpores,
        skyLanterns: raw.skyLanterns,
        staticGlows: raw.staticGlows || [],
        spiritCranes: raw.spiritCranes || [],
        auroraNodes: raw.auroraNodes || [],
        mistBanks: raw.mistBanks || [],
        sakuraPetals: raw.sakuraPetals || [],
        skyClouds: raw.skyClouds || [],
        colliders: raw.colliders || []
      };
    }
    return this.nightSceneryGpuCache[night];
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
    const idx = [
      0,1,2, 0,2,3, 4,5,6, 4,6,7,
      8,9,10, 8,10,11, 12,13,14, 12,14,15,
      16,17,18, 16,18,19, 20,21,22, 20,22,23
    ];
    return this.createBufferMesh(p, n, [], idx);
  }

  createCylinder(segs = 32) {
    const pos = [], norm = [], idx = [];
    pos.push(0, 0.5, 0); norm.push(0, 1, 0);
    pos.push(0, -0.5, 0); norm.push(0, -1, 0);

    for (let i = 0; i <= segs; i++) {
      const a = (i * Math.PI * 2) / segs;
      const x = Math.cos(a), z = Math.sin(a);
      pos.push(x, 0.5, z); norm.push(x, 0, z);
      pos.push(x, -0.5, z); norm.push(x, 0, z);
    }

    for (let i = 0; i < segs; i++) {
      const t1 = 2 + i * 2, b1 = 3 + i * 2;
      const t2 = 2 + (i + 1) * 2, b2 = 3 + (i + 1) * 2;
      idx.push(t1, b1, t2, b1, b2, t2);
      idx.push(0, t1, t2);
      idx.push(1, b2, b1);
    }
    return this.createBufferMesh(pos, norm, [], idx);
  }

  createCone(segs = 24) {
    const pos = [0, 0.5, 0], norm = [0, 1, 0], idx = [];
    for (let i = 0; i <= segs; i++) {
      const a = (i * Math.PI * 2) / segs;
      const x = Math.cos(a), z = Math.sin(a);
      pos.push(x, -0.5, z);
      norm.push(x * 0.7, 0.5, z * 0.7);
    }
    for (let i = 0; i < segs; i++) idx.push(0, 1 + i, 2 + i);
    return this.createBufferMesh(pos, norm, [], idx);
  }

  createSphere(latBands = 12, lonBands = 12) {
    const pos = [], norm = [], idx = [];
    for (let lat = 0; lat <= latBands; lat++) {
      const theta = (lat * Math.PI) / latBands;
      const sinT = Math.sin(theta), cosT = Math.cos(theta);
      for (let lon = 0; lon <= lonBands; lon++) {
        const phi = (lon * 2 * Math.PI) / lonBands;
        const x = Math.cos(phi) * sinT, y = cosT, z = Math.sin(phi) * sinT;
        pos.push(x * 0.5, y * 0.5, z * 0.5);
        norm.push(x, y, z);
      }
    }
    for (let lat = 0; lat < latBands; lat++) {
      for (let lon = 0; lon < lonBands; lon++) {
        const first = lat * (lonBands + 1) + lon;
        const second = first + lonBands + 1;
        idx.push(first, second, first + 1, second, second + 1, first + 1);
      }
    }
    return this.createBufferMesh(pos, norm, [], idx);
  }

  createHalfAnnulus(rIn, rOut, h, segs = 28) {
    const pos = [], norm = [], idx = [];
    const addQuad = (a, b, c, d, nx, ny, nz) => {
      const base = pos.length / 3;
      for (const v of [a, b, c, d]) {
        pos.push(v[0], v[1], v[2]);
        norm.push(nx, ny, nz);
      }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    };

    for (let i = 0; i < segs; i++) {
      const a0 = (i * Math.PI) / segs;
      const a1 = ((i + 1) * Math.PI) / segs;
      const c0 = Math.cos(a0), s0 = Math.sin(a0);
      const c1 = Math.cos(a1), s1 = Math.sin(a1);
      addQuad([rIn*c0, h, rIn*s0], [rOut*c0, h, rOut*s0], [rOut*c1, h, rOut*s1], [rIn*c1, h, rIn*s1], 0, 1, 0);
      addQuad([rOut*c0, 0, rOut*s0], [rOut*c0, h, rOut*s0], [rOut*c1, h, rOut*s1], [rOut*c1, 0, rOut*s1], c0, 0, s0);
      addQuad([rIn*c1, 0, rIn*s1], [rIn*c1, h, rIn*s1], [rIn*c0, h, rIn*s0], [rIn*c0, 0, rIn*s0], -c0, 0, -s0);
    }
    addQuad([rIn, 0, 0], [rOut, 0, 0], [rOut, h, 0], [rIn, h, 0], 0, 0, -1);
    addQuad([-rOut, 0, 0], [-rIn, 0, 0], [-rIn, h, 0], [-rOut, h, 0], 0, 0, -1);
    return this.createBufferMesh(pos, norm, [], idx);
  }

  createRamp(w, len, h) {
    const hw = w / 2;
    const x0 = 24, x1 = 24 + len;
    const pos = [], norm = [], idx = [];
    const addQuad = (a, b, c, d, nx, ny, nz) => {
      const base = pos.length / 3;
      for (const v of [a, b, c, d]) {
        pos.push(v[0], v[1], v[2]);
        norm.push(nx, ny, nz);
      }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    };
    const ny = len / Math.hypot(len, h), nx = h / Math.hypot(len, h);
    addQuad([x0, h, -hw], [x1, 0, -hw], [x1, 0, hw], [x0, h, hw], nx, ny, 0);
    addQuad([x0, 0, hw], [x1, 0, hw], [x0, h, hw], [x0, h, hw], 0, 0, 1);
    addQuad([x0, 0, -hw], [x0, h, -hw], [x1, 0, -hw], [x1, 0, -hw], 0, 0, -1);
    return this.createBufferMesh(pos, norm, [], idx);
  }

  createRing(segs = 32) {
    const pos = [], norm = [], idx = [];
    const rIn = 0.94, rOut = 1.0;
    for (let i = 0; i <= segs; i++) {
      const a = (i * Math.PI * 2) / segs;
      const c = Math.cos(a), s = Math.sin(a);
      pos.push(rIn * c, 0, rIn * s); norm.push(0, 1, 0);
      pos.push(rOut * c, 0, rOut * s); norm.push(0, 1, 0);
    }
    for (let i = 0; i < segs; i++) {
      const i0 = i * 2;
      idx.push(i0, i0 + 1, i0 + 3, i0, i0 + 3, i0 + 2);
    }
    return this.createBufferMesh(pos, norm, [], idx);
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

  pushGlow(count, x, y, z, size, col, alpha) {
    if (count >= this.MAX_GLOWS) return count;
    const o = count * 8;
    const d = this.glowData;
    d[o] = x; d[o + 1] = y; d[o + 2] = z; d[o + 3] = size;
    d[o + 4] = col[0]; d[o + 5] = col[1]; d[o + 6] = col[2]; d[o + 7] = alpha;
    return count + 1;
  }

  uploadFrameUniforms(u, count, playerGlow, pulseStrength, ambientIntensity) {
    const gl = this.gl;
    if (u.projection) gl.uniformMatrix4fv(u.projection, false, this.projMat.m);
    if (u.view) gl.uniformMatrix4fv(u.view, false, this.viewMat.m);
    gl.uniform3fv(u.lanternLights, this.lPosArray);
    gl.uniform1fv(u.lanternLit, this.lLitArray);
    gl.uniform1i(u.lanternCount, count);
    gl.uniform3fv(u.playerPos, this.playerPosF32);
    gl.uniform1f(u.playerGlowStrength, playerGlow);
    gl.uniform3fv(u.pulsePos, this.pulsePosF32);
    gl.uniform1f(u.pulseStrength, pulseStrength);
    gl.uniform1f(u.ambientIntensity, ambientIntensity);
    gl.uniform3fv(u.fogColor, PALETTE.fog);
    gl.uniform3fv(u.cameraPos, this.camPosF32);
  }

  drawSceneryChunks(chunks, withSway, timeSec, windStrength, count, playerGlow, pulseStrength, ambientIntensity) {
    if (!chunks || chunks.length === 0) return;
    const gl = this.gl;
    const prog = withSway ? this.foliageProgram : this.sceneryProgram;
    const u = withSway ? this.foliageUniforms : this.sceneryUniforms;
    gl.useProgram(prog);
    this.uploadFrameUniforms(u, count, playerGlow, pulseStrength, ambientIntensity);
    gl.uniform1f(u.unlitEmissive, 0.0);
    if (withSway) {
      gl.uniform1f(u.time, timeSec);
      gl.uniform2fv(u.windDir, this.windDirF32);
      gl.uniform1f(u.windStrength, windStrength);
    }

    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      gl.bindBuffer(gl.ARRAY_BUFFER, c.posBuffer);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(0);

      gl.bindBuffer(gl.ARRAY_BUFFER, c.normBuffer);
      gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(1);

      gl.bindBuffer(gl.ARRAY_BUFFER, c.colBuffer);
      gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(2);

      if (withSway) {
        gl.bindBuffer(gl.ARRAY_BUFFER, c.swayBuffer);
        gl.vertexAttribPointer(3, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(3);
      }

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, c.idxBuffer);
      gl.drawElements(gl.TRIANGLES, c.count, gl.UNSIGNED_SHORT, 0);
    }

    gl.disableVertexAttribArray(2);
    if (withSway) gl.disableVertexAttribArray(3);
    gl.useProgram(this.program);
    this.lastBoundMesh = null;
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
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.instData.subarray(0, instCount * 10));

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

  beginColoredModelPass(count, playerGlow, pulseStrength, ambientIntensity) {
    const gl = this.gl;
    gl.useProgram(this.coloredModelProgram);
    this.uploadFrameUniforms(this.coloredModelUniforms, count, playerGlow, pulseStrength, ambientIntensity);
    gl.enableVertexAttribArray(0);
    gl.enableVertexAttribArray(1);
    gl.enableVertexAttribArray(2);
    this.lastBoundMesh = null;
  }

  drawColoredModel(mesh, modelMatrix, emissive = 0.0) {
    if (!mesh) return;
    const gl = this.gl;
    gl.uniformMatrix4fv(this.coloredModelUniforms.model, false, modelMatrix.m);
    gl.uniform1f(this.coloredModelUniforms.unlitEmissive, emissive);

    if (this.lastBoundMesh !== mesh) {
      this.lastBoundMesh = mesh;
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.posBuffer);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normBuffer);
      gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.colBuffer);
      gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.idxBuffer);
    }
    gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0);
  }

  endColoredModelPass() {
    const gl = this.gl;
    gl.disableVertexAttribArray(2);
    gl.useProgram(this.program);
    this.lastBoundMesh = null;
  }

  flushGlowPass(glowCount) {
    if (glowCount <= 0) return;
    const gl = this.gl;
    const u = this.glowUniforms;
    const q = this.meshes.quad;

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.depthMask(false);

    gl.useProgram(this.glowProgram);
    gl.uniformMatrix4fv(u.projection, false, this.projMat.m);
    gl.uniformMatrix4fv(u.view, false, this.viewMat.m);
    gl.uniform3fv(u.camRight, this.camRightF32);
    gl.uniform3fv(u.camUp, this.camUpF32);

    gl.bindBuffer(gl.ARRAY_BUFFER, q.posBuffer);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, q.idxBuffer);

    if (this.instExt && this.glowBuffer) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.glowBuffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.glowData.subarray(0, glowCount * 8));
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 0);
      this.instExt.vertexAttribDivisorANGLE(1, 1);
      gl.enableVertexAttribArray(2);
      gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 32, 16);
      this.instExt.vertexAttribDivisorANGLE(2, 1);

      this.instExt.drawElementsInstancedANGLE(gl.TRIANGLES, q.count, gl.UNSIGNED_SHORT, 0, glowCount);

      this.instExt.vertexAttribDivisorANGLE(1, 0);
      this.instExt.vertexAttribDivisorANGLE(2, 0);
      gl.disableVertexAttribArray(1);
      gl.disableVertexAttribArray(2);
    } else {
      for (let i = 0; i < glowCount; i++) {
        const o = i * 8;
        this.glowPosSizeTmp.set(this.glowData.subarray(o, o + 4));
        this.glowColAlphaTmp.set(this.glowData.subarray(o + 4, o + 8));
        gl.uniform4fv(u.posSize, this.glowPosSizeTmp);
        gl.uniform4fv(u.colorAlpha, this.glowColAlphaTmp);
        gl.drawElements(gl.TRIANGLES, q.count, gl.UNSIGNED_SHORT, 0);
      }
    }

    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.useProgram(this.program);
    this.lastBoundMesh = null;
  }

  drawJointBox(jointMat, lx, ly, lz, sx, sy, sz, col, emissive = 0.0, rotX = 0) {
    this.jDraw.copy(jointMat);
    if (lx !== 0 || ly !== 0 || lz !== 0) this.jDraw.mulTranslate(lx, ly, lz);
    if (rotX !== 0) this.jDraw.mulRotateX(rotX);
    this.jDraw.mulScale(sx, sy, sz);
    this.drawMesh(this.meshes.cube, this.jDraw, col, emissive);
  }

  drawJointSphere(jointMat, lx, ly, lz, sx, sy, sz, col, emissive = 0.0) {
    this.jDraw.copy(jointMat);
    if (lx !== 0 || ly !== 0 || lz !== 0) this.jDraw.mulTranslate(lx, ly, lz);
    this.jDraw.mulScale(sx, sy, sz);
    this.drawMesh(this.meshes.sphereLow, this.jDraw, col, emissive);
  }

  drawJointCyl(jointMat, lx, ly, lz, sx, sy, sz, col, emissive = 0.0) {
    this.jDraw.copy(jointMat);
    if (lx !== 0 || ly !== 0 || lz !== 0) this.jDraw.mulTranslate(lx, ly, lz);
    this.jDraw.mulScale(sx, sy, sz);
    this.drawMesh(this.meshes.limb, this.jDraw, col, emissive);
  }

  drawJointCone(jointMat, lx, ly, lz, sx, sy, sz, col, emissive = 0.0) {
    this.jDraw.copy(jointMat);
    if (lx !== 0 || ly !== 0 || lz !== 0) this.jDraw.mulTranslate(lx, ly, lz);
    this.jDraw.mulScale(sx, sy, sz);
    this.drawMesh(this.meshes.cone, this.jDraw, col, emissive);
  }

  renderHeroMay(engine, timeSec, carryFrac, reducedMotion, benchmarkMode, frameLights, activeDt, renderPlayerPos) {
    return renderHeroModel(this, engine, timeSec, carryFrac, reducedMotion, benchmarkMode, frameLights, activeDt, renderPlayerPos);
  }

  renderOngDang(engine, timeSec) {
    const ox = 2.8, oz = engine.night === 3 ? -14.5 : -2.5;
    const oy = 0;
    const nod = Math.sin(timeSec * 2.0) * 0.04;
    const distToMay = Math.hypot(engine.player.pos[0] - ox, engine.player.pos[2] - oz);
    const staffRaise = distToMay < 5.0 ? 0.18 + 0.08 * Math.sin(timeSec * 5.0) : 0;

    this.jRoot.setTranslate(ox, oy, oz).mulRotateY(Math.atan2(engine.player.pos[0] - ox, engine.player.pos[2] - oz));
    // Lower sandals & elder robe
    this.drawJointBox(this.jRoot, 0.12, 0.04, 0.04, 0.13, 0.06, 0.24, HUMAN_PALETTE.sandal);
    this.drawJointBox(this.jRoot, -0.12, 0.04, 0.04, 0.13, 0.06, 0.24, HUMAN_PALETTE.sandal);
    this.drawJointCyl(this.jRoot, 0, 0.62, 0, 0.26, 1.15, 0.22, PALETTE.wood);
    this.drawJointCyl(this.jRoot, 0, 1.02, 0, 0.22, 0.35, 0.18, PALETTE.mayScarf);
    // Arms (left folded gently, right holding gourd staff)
    this.drawJointCyl(this.jRoot, 0.26, 0.95, 0.05, 0.075, 0.42, 0.075, PALETTE.wood);
    this.drawJointSphere(this.jRoot, 0.26, 0.72, 0.10, 0.10, 0.10, 0.10, HUMAN_PALETTE.skin);
    this.drawJointCyl(this.jRoot, -0.28, 0.98 + staffRaise * 0.4, 0.08, 0.075, 0.42, 0.075, PALETTE.wood);
    this.drawJointSphere(this.jRoot, -0.32, 0.88 + staffRaise, 0.16, 0.10, 0.10, 0.10, HUMAN_PALETTE.skin);
    // Head, white beard & hat
    this.drawJointSphere(this.jRoot, 0, 1.42 + nod, 0, 0.34, 0.35, 0.34, HUMAN_PALETTE.skin);
    this.drawJointSphere(this.jRoot, 0.07, 1.42 + nod, 0.15, 0.04, 0.03, 0.02, HUMAN_PALETTE.hair);
    this.drawJointSphere(this.jRoot, -0.07, 1.42 + nod, 0.15, 0.04, 0.03, 0.02, HUMAN_PALETTE.hair);
    this.drawJointCone(this.jRoot, 0, 1.18 + nod, 0.14, 0.12, -0.44, 0.10, PALETTE.mayRobe);
    this.drawJointCone(this.jRoot, 0, 1.72 + nod, 0, 0.62, 0.42, 0.62, PALETTE.sand);
    // Bamboo staff + glowing gourd lantern
    this.drawJointCyl(this.jRoot, -0.34, 1.05 + staffRaise, 0.18, 0.04, 2.05, 0.04, PALETTE.wood);
    this.drawJointSphere(this.jRoot, -0.34, 2.12 + staffRaise, 0.22, 0.24, 0.30, 0.24, PALETTE.lanternLit, 0.92);
    this.jDraw.copy(this.jRoot).mulTranslate(-0.34, 2.12 + staffRaise, 0.22);
    const gourdPos = [0, 0, 0];
    this.jDraw.getTranslation(gourdPos);
    if (distToMay < 5.0) {
      this.drawMesh(this.meshes.ring, this.scratchMat.setTRS(ox, oy + 0.05, oz, 1.1, 1, 1.1), PALETTE.goldUi, 0.6);
    }
    return gourdPos;
  }

  getViewProjection(camera) {
    const aspect = this.canvas.width / Math.max(1, this.canvas.height);
    this.projMat.setPerspective((60 * Math.PI) / 180, aspect, 0.1, 300.0);
    this.viewMat.setLookAt(camera.eye, camera.target, this.upVec);
    this.vpMat.setMultiply(this.projMat, this.viewMat);
    return { proj: this.projMat, view: this.viewMat, vp: this.vpMat };
  }

  projectToScreen(worldPos, camera, reuseVp = false) {
    const vp = reuseVp ? this.vpMat : this.getViewProjection(camera).vp;
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
    const cw = this.canvas.clientWidth || this.canvas.width;
    const ch = this.canvas.clientHeight || this.canvas.height;
    const screenX = (ndcX * 0.5 + 0.5) * cw;
    const screenY = (-ndcY * 0.5 + 0.5) * ch;
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

    this.getViewProjection(camera);
    const vm = this.viewMat.m;
    this.camPosF32[0] = camera.eye[0];
    this.camPosF32[1] = camera.eye[1];
    this.camPosF32[2] = camera.eye[2];
    this.camRightF32[0] = vm[0]; this.camRightF32[1] = vm[4]; this.camRightF32[2] = vm[8];
    this.camUpF32[0] = vm[1]; this.camUpF32[1] = vm[5]; this.camUpF32[2] = vm[9];

    const sm = this.scratchMat;
    let litCount = 0;
    for (let i = 0; i < engine.lanterns.length; i++) {
      if (engine.lanterns[i].lit) litCount++;
    }
    const totalLanterns = Math.max(1, engine.lanterns.length);
    const ambientIntensity = 0.15 + 0.55 * (litCount / totalLanterns);

    const activeDt = engine.state === 'paused' ? 0 : dtSec;
    const timeSec = engine.simTick / 60.0;
    const speed = Math.hypot(engine.player.vel[0], engine.player.vel[2]);
    if (activeDt > 0 && engine.player.respawnTicks === 0 && speed > 0.15) {
      this.mayStridePhase += activeDt * (7.5 + speed * 0.95);
    }

    const lPosArray = this.lPosArray;
    const lLitArray = this.lLitArray;
    let count = 0;
    for (let i = 0; i < engine.lanterns.length && count < 7; i++) {
      const l = engine.lanterns[i];
      if (!l.lit) continue;
      lPosArray[count * 3] = l.pos[0];
      lPosArray[count * 3 + 1] = l.pos[1];
      lPosArray[count * 3 + 2] = l.pos[2];
      const fuelRatio = Math.max(0, Math.min(1, l.fuelUnits / 6000));
      const isLow = l.fuelUnits < 1800;
      const blinkOn = reducedMotion || !isLow || Math.floor(timeSec * 2.0) % 2 === 0;
      lLitArray[count] = blinkOn ? 0.35 + 0.65 * fuelRatio : 0.15;
      count++;
    }

    const cap = Math.max(1, engine.getCarryCapacity ? engine.getCarryCapacity() : 10);
    const carryFrac = Math.min(1, engine.player.carried / cap);
    const playerGlow = 1.05 + 0.9 * carryFrac + (engine.player.charmTicks > 0 ? 0.65 : 0.0);
    const latestPulse = this.pulseWaves.length > 0 ? this.pulseWaves[this.pulseWaves.length - 1] : null;
    const pulseStrength = latestPulse ? Math.max(0, 1.0 - latestPulse.age / latestPulse.maxAge) * 2.8 : 0.0;
    const pulsePos = latestPulse ? latestPulse.pos : engine.player.pos;

    const pPos = options.renderPlayerPos || engine.player.pos;
    // Approximate Mây lantern light pos before hero rig runs (left-front matching bamboo pole side)
    const pYaw = Math.atan2(engine.player.facing[0], engine.player.facing[1]);
    this.playerPosF32[0] = pPos[0] + Math.sin(pYaw + 0.38) * 0.85;
    this.playerPosF32[1] = pPos[1] + 1.15;
    this.playerPosF32[2] = pPos[2] + Math.cos(pYaw + 0.38) * 0.85;
    this.pulsePosF32[0] = pulsePos[0];
    this.pulsePosF32[1] = pulsePos[1];
    this.pulsePosF32[2] = pulsePos[2];

    this.uploadFrameUniforms(this.uniforms, count, playerGlow, pulseStrength, ambientIntensity);

    // 1. Floating Island Base Geometry FIRST for Hardware Early-Z (skip duplicate grass tops when scenery provides them)
    if (engine.night === 1) {
      this.drawMesh(this.meshes.cone, sm.setTRS(0, -6.5, 0, 38, -10.0, 38), PALETTE.wood);
      this.drawMesh(this.meshes.cylinder, sm.setTRS(0, -1.5, 0, 40, 3.0, 40), PALETTE.sand);
      if (benchmarkMode) this.drawMesh(this.meshes.cylinder, sm.setTRS(0, -0.45, 0, 38.5, 1.0, 38.5), PALETTE.grass);
    } else if (engine.night === 2) {
      for (const cx of [0, 70]) {
        this.drawMesh(this.meshes.cone, sm.setTRS(cx, -5.8, 0, 26, -8.5, 26), PALETTE.wood);
        this.drawMesh(this.meshes.cylinder, sm.setTRS(cx, -1.5, 0, 28, 3.0, 28), PALETTE.sand);
        if (benchmarkMode) this.drawMesh(this.meshes.cylinder, sm.setTRS(cx, -0.45, 0, 26.5, 1.0, 26.5), PALETTE.grass);
      }
      this.drawMesh(this.meshes.cube, sm.setTRS(35, -0.25, 0, 18, 0.5, 4), PALETTE.wood);
      for (const bx of [28, 32, 38, 42]) {
        this.drawMesh(this.meshes.cylinder, sm.setTRS(bx, 0.35, 1.9, 0.18, 0.9, 0.18), PALETTE.sand);
        this.drawMesh(this.meshes.cylinder, sm.setTRS(bx, 0.35, -1.9, 0.18, 0.9, 0.18), PALETTE.sand);
      }
    } else if (engine.night === 3) {
      this.drawMesh(this.meshes.cone, sm.setTRS(0, -7.2, 0, 43, -11.5, 43), PALETTE.wood);
      this.drawMesh(this.meshes.cylinder, sm.setTRS(0, -1.5, 0, 45, 3.0, 45), PALETTE.sand);
      if (benchmarkMode) this.drawMesh(this.meshes.cylinder, sm.setTRS(0, -0.45, 0, 43.5, 1.0, 43.5), PALETTE.grass);
      this.drawMesh(this.meshes.halfAnnulus, this.identityMat, PALETTE.grass);
      this.drawMesh(this.meshes.cylinder, sm.setTRS(0, 3.0, 0, 8, 6.0, 8), PALETTE.sand);
      if (benchmarkMode) this.drawMesh(this.meshes.cylinder, sm.setTRS(0, 5.6, 0, 7.9, 0.9, 7.9), PALETTE.grass);
      this.drawMesh(this.meshes.ramp, this.rampMatA, PALETTE.wood);
      this.drawMesh(this.meshes.ramp, this.rampMatB, PALETTE.wood);
      if (benchmarkMode) {
        this.drawMesh(this.meshes.cylinder, sm.setTRS(0, 10.0, 0, 2.0, 8.0, 2.0), PALETTE.wood);
        this.drawMesh(this.meshes.cone, sm.setTRS(0, 15.0, 0, 3.4, 2.4, 3.4), PALETTE.mayScarf);
        this.drawMesh(this.meshes.cone, sm.setTRS(0, 16.4, 0, 1.6, 1.2, 1.6), PALETTE.goldUi, 0.35);
        this.drawMesh(this.meshes.sphere, sm.setTRS(0, 11.2, 0, 1.1, 1.3, 1.1), PALETTE.goldUi, 0.4);
      }
    }

    // 1b. Batched Island Nature, Trees, Pebbles, Boulders, Wildflowers & Landmarks (disabled in benchmarkMode)
    let sceneryData = null;
    if (!benchmarkMode) {
      sceneryData = this.getNightScenery(engine.night);
      if (engine.night === 3 && engine.wind.active) {
        const wr = (engine.wind.dir_deg * Math.PI) / 180;
        this.windDirF32[0] = Math.cos(wr);
        this.windDirF32[1] = Math.sin(wr);
      } else {
        this.windDirF32[0] = 0.85;
        this.windDirF32[1] = 0.52;
      }
      const windStrength = reducedMotion ? 0.22 : (engine.night === 3 && engine.wind.active ? 2.25 : 1.0);
      this.drawSceneryChunks(sceneryData.staticChunks, false, timeSec, windStrength, count, playerGlow, pulseStrength, ambientIntensity);
      this.drawSceneryChunks(sceneryData.foliageChunks, true, timeSec, windStrength, count, playerGlow, pulseStrength, ambientIntensity);
    }

    // Launch Pads (with rising spiraling Anemo wind rings in gameplay)
    for (let i = 0; i < engine.map.launchPads.length; i++) {
      const pad = engine.map.launchPads[i];
      const pulsePad = 1.05 + 0.1 * Math.sin(timeSec * 4.5);
      this.drawMesh(this.meshes.cylinder, sm.setTRS(pad.pos[0], pad.pos[1] + 0.08, pad.pos[2], 1.0, 0.16, 1.0), PALETTE.goldUi, 0.65);
      this.drawMesh(this.meshes.ring, sm.setTRS(pad.pos[0], pad.pos[1] + 0.18, pad.pos[2], pulsePad, 1, pulsePad), PALETTE.lanternCore, 0.85);
      if (!benchmarkMode) {
        for (let k = 0; k < 2; k++) {
          const wt = (timeSec * 1.15 + k * 0.5 + i * 0.3) % 1.0;
          const wr = 0.72 + Math.sin(wt * Math.PI) * 0.45;
          this.drawMesh(this.meshes.ring, sm.setTRS(pad.pos[0], pad.pos[1] + 0.25 + wt * 2.1, pad.pos[2], wr, 1, wr, timeSec * 4.0 + k), [0.38, 0.96, 0.88], (1 - wt) * 0.95);
        }
      }
    }

    // 2. Render Great Lanterns (lightweight baseline primitives in benchmarkMode; sculpted Vietnamese pavilions in gameplay)
    if (benchmarkMode) {
      for (let i = 0; i < engine.lanterns.length; i++) {
        const l = engine.lanterns[i];
        const lx = l.pos[0], ly = l.pos[1], lz = l.pos[2];
        this.drawMesh(this.meshes.cylinder, sm.setTRS(lx, ly + 0.15, lz, 0.72, 0.3, 0.72), PALETTE.sand);
        this.drawMesh(this.meshes.cylinder, sm.setTRS(lx, ly + 1.0, lz, 0.18, 1.8, 0.18), PALETTE.wood);
        if (l.lit) {
          const fuelRatio = Math.max(0, Math.min(1, l.fuelUnits / 6000));
          const isLowFuel = l.fuelUnits < 1800;
          const blinkOn = reducedMotion || !isLowFuel || Math.floor(timeSec * 2.0) % 2 === 0;
          this.drawMesh(this.meshes.cube, sm.setTRS(lx, ly + 2.3, lz, 0.78, 1.0, 0.78), blinkOn ? PALETTE.lanternLit : PALETTE.lanternOff, blinkOn ? 0.92 : 0.15);
          if (!isLowFuel) {
            const ringPulse = 5.95 + 0.08 * Math.sin(timeSec * 2.5 + i);
            this.drawMesh(this.meshes.ring, sm.setTRS(lx, ly + 0.06, lz, ringPulse, 1, ringPulse), PALETTE.lanternLit, 0.65);
          }
          if (blinkOn) {
            const barW = 1.6;
            const fillW = Math.max(0.05, barW * fuelRatio);
            const barColor = isLowFuel
              ? (colorblind ? PALETTE.dangerColorblind : PALETTE.danger)
              : PALETTE.lanternCore;
            this.drawMesh(this.meshes.cube, sm.setTRS(lx, ly + 4.05, lz, barW + 0.08, 0.16, 0.08), PALETTE.shadeBody, 0.2);
            this.drawMesh(this.meshes.cube, sm.setTRS(lx - (barW - fillW) / 2, ly + 4.05, lz, fillW, 0.12, 0.12), barColor, 0.95);
          }
        } else {
          this.drawMesh(this.meshes.cube, sm.setTRS(lx, ly + 2.3, lz, 0.72, 0.95, 0.72), PALETTE.lanternOff, 0.05);
        }
        this.drawMesh(this.meshes.cone, sm.setTRS(lx, ly + 3.15, lz, 1.15, 0.65, 1.15), PALETTE.mayScarf);
      }
    } else {
      renderGreatLanterns(this, engine, timeSec, reducedMotion, colorblind, benchmarkMode, {
        count,
        playerGlow,
        pulseStrength,
        ambientIntensity
      });
    }

    const shadeRimColor = colorblind ? PALETTE.shadeRimColorblind : PALETTE.shadeRim;

    // 3 & 5. Benchmark Instanced Fast Path vs Gameplay Unique Sculpted Monsters & Rain of Sakura Petals
    if (benchmarkMode) {
      if (this.instExt && (engine.motes.length > 0 || engine.shades.length > 0)) {
        this.beginInstancedPass(count, playerGlow, pulseStrength, ambientIntensity);
        if (engine.motes.length > 0) {
          let mc = 0;
          for (let i = 0; i < engine.motes.length; i++) {
            const mote = engine.motes[i];
            const bob = Math.sin(timeSec * 3.5 + mote.pos[0]) * 0.18 + 0.5;
            const swayX = Math.cos(timeSec * 2.2 + mote.pos[2]) * 0.1;
            mc = this.pushInstance(mc, mote.pos[0] + swayX, mote.pos[1] + bob, mote.pos[2], 0, 0.28, 0.28, 0.28, PALETTE.moteCore);
            if (mc === this.MAX_INSTANCES) { this.drawInstancedBatch(this.meshes.sphereLow, mc, 0.98); mc = 0; }
          }
          this.drawInstancedBatch(this.meshes.sphereLow, mc, 0.98);
        }
        if (engine.shades.length > 0) {
          let bc = 0;
          for (let i = 0; i < engine.shades.length; i++) {
            const shade = engine.shades[i];
            if (shade.state === 'stunned') continue;
            const sx = shade.pos[0], sy = shade.pos[1], sz = shade.pos[2];
            const hover = Math.sin(timeSec * 4.0 + sx) * 0.1;
            bc = this.pushInstance(bc, sx, sy + hover, sz, 0, 1.05, 1.35, 1.05, PALETTE.shadeBody);
            if (bc === this.MAX_INSTANCES) { this.drawInstancedBatch(this.meshes.sphereLow, bc, 0.05); bc = 0; }
          }
          this.drawInstancedBatch(this.meshes.sphereLow, bc, 0.05);

          let rc = 0;
          for (let i = 0; i < engine.shades.length; i++) {
            const shade = engine.shades[i];
            rc = this.pushInstance(rc, shade.pos[0], shade.pos[1] - 0.65, shade.pos[2], 0, 0.85, 1, 0.85, shadeRimColor);
            if (rc === this.MAX_INSTANCES) { this.drawInstancedBatch(this.meshes.ring, rc, 0.85); rc = 0; }
          }
          this.drawInstancedBatch(this.meshes.ring, rc, 0.85);

          let ec = 0;
          const ppx = engine.player.pos[0], ppz = engine.player.pos[2];
          for (let i = 0; i < engine.shades.length; i++) {
            const shade = engine.shades[i];
            const sx = shade.pos[0], sy = shade.pos[1], sz = shade.pos[2];
            const hover = Math.sin(timeSec * 4.0 + sx) * 0.1;
            const sYaw = Math.atan2(ppx - sx, ppz - sz);
            ec = this.pushInstance(ec, sx + Math.sin(sYaw) * 0.44, sy + hover + 0.2, sz + Math.cos(sYaw) * 0.44, sYaw, 0.34, 0.1, 0.1, shadeRimColor);
            if (ec === this.MAX_INSTANCES) { this.drawInstancedBatch(this.meshes.cube, ec, 0.95); ec = 0; }
          }
          this.drawInstancedBatch(this.meshes.cube, ec, 0.95);
        }
        this.endInstancedPass();
      } else {
        for (let i = 0; i < engine.motes.length; i++) {
          const mote = engine.motes[i];
          const bob = Math.sin(timeSec * 3.5 + mote.pos[0]) * 0.18 + 0.5;
          const swayX = Math.cos(timeSec * 2.2 + mote.pos[2]) * 0.1;
          this.drawMesh(this.meshes.sphereLow, sm.setTRS(mote.pos[0] + swayX, mote.pos[1] + bob, mote.pos[2], 0.28, 0.28, 0.28), PALETTE.moteCore, 0.98);
        }
        for (let i = 0; i < engine.shades.length; i++) {
          const shade = engine.shades[i];
          const sx = shade.pos[0], sy = shade.pos[1], sz = shade.pos[2];
          const hover = Math.sin(timeSec * 4.0 + sx) * 0.1;
          this.drawMesh(this.meshes.sphereLow, sm.setTRS(sx, sy + hover, sz, 1.05, 1.35, 1.05), PALETTE.shadeBody, 0.05);
          this.drawMesh(this.meshes.ring, sm.setTRS(sx, sy - 0.65, sz, 0.85, 1, 0.85), shadeRimColor, 0.85);
          const sYaw = Math.atan2(engine.player.pos[0] - sx, engine.player.pos[2] - sz);
          this.drawMesh(this.meshes.cube, sm.setTRS(sx + Math.sin(sYaw) * 0.44, sy + hover + 0.2, sz + Math.cos(sYaw) * 0.44, 0.34, 0.1, 0.1, sYaw), shadeRimColor, 0.95);
        }
      }
    } else {
      // Gameplay Unique Sculpted Articulated Monsters & Smooth Walking Motion
      renderSculptedMonsters(this, engine, timeSec, reducedMotion, colorblind, {
        count,
        playerGlow,
        pulseStrength,
        ambientIntensity
      }, activeDt);

      // Instanced Falling Cherry Blossom (Sakura) Petals across the island (swept by wind gusts!)
      if (this.instExt && sceneryData && sceneryData.sakuraPetals.length > 0) {
        this.beginInstancedPass(count, playerGlow, pulseStrength, ambientIntensity);
        let spc = 0;
        const petals = sceneryData.sakuraPetals;
        const isWindStormP = engine.night === 3 && engine.wind.active;
        const isWindWarnP = engine.night === 3 && engine.wind.warning;
        const wrP = engine.night === 3 ? (engine.wind.dir_deg * Math.PI) / 180 : 0.55;
        const windDriftSpd = isWindStormP ? 7.5 : isWindWarnP ? 3.2 : 0.9;
        const wCos = Math.cos(wrP), wSin = Math.sin(wrP);
        for (let i = 0; i < petals.length; i++) {
          const pt = petals[i];
          const cycleH = 9.0;
          const fallY = pt.groundY + ((pt.baseH - timeSec * pt.fallSpeed) % cycleH + cycleH) % cycleH;
          const windCycle = reducedMotion ? 0 : ((timeSec * windDriftSpd + pt.phase * 2.5) % 14.0) - 7.0;
          const px = pt.cx + Math.sin(timeSec * 1.15 + pt.phase) * pt.swayAmp + wCos * windCycle * (isWindStormP ? 1.0 : 0.35);
          const pz = pt.cz + Math.cos(timeSec * 0.95 + pt.phase) * pt.swayAmp + wSin * windCycle * (isWindStormP ? 1.0 : 0.35);
          const ry = reducedMotion ? pt.phase : timeSec * pt.rotSpeed + pt.phase;
          spc = this.pushInstance(spc, px, fallY, pz, ry, pt.scale * 1.3, 0.018, pt.scale, pt.color);
          if (spc === this.MAX_INSTANCES) { this.drawInstancedBatch(this.meshes.cube, spc, 0.35); spc = 0; }
        }
        this.drawInstancedBatch(this.meshes.cube, spc, 0.35);
        this.endInstancedPass();
      }
    }

    // 4. Wind Charms (Sculpted Emerald-Gold Pinwheel Talisman in gameplay)
    if (engine.charms.length > 0) {
      if (benchmarkMode) {
        for (let i = 0; i < engine.charms.length; i++) {
          const charm = engine.charms[i];
          if (!charm.available) continue;
          const mapC = engine.map.charms.find(c => c.id === charm.id);
          if (!mapC) continue;
          const cx = mapC.pos[0], cy = mapC.pos[1] + 0.85 + Math.sin(timeSec * 3.0) * 0.15, cz = mapC.pos[2];
          this.drawMesh(this.meshes.cube, sm.setTRS(cx, cy, cz, 0.55, 0.8, 0.14, timeSec * 2.5), PALETTE.goldUi, 0.65);
        }
      } else {
        const em = this.getEntityModels();
        if (em) {
          this.beginColoredModelPass(count, playerGlow, pulseStrength, ambientIntensity);
          for (let i = 0; i < engine.charms.length; i++) {
            const charm = engine.charms[i];
            if (!charm.available) continue;
            const mapC = engine.map.charms.find(c => c.id === charm.id);
            if (!mapC) continue;
            const cx = mapC.pos[0], cy = mapC.pos[1] + 0.95 + Math.sin(timeSec * 3.0 + i) * 0.15, cz = mapC.pos[2];
            this.jRoot.setTranslate(cx, cy, cz).mulRotateY(timeSec * 2.4 + i);
            this.drawColoredModel(em.charmTalisman, this.jRoot, 0.85);
          }
          this.endColoredModelPass();
        }
      }
    }

    // 7. Pulse Waves, Particles, Dash Trails, Mote Pickup Rings, Fly-in Lifecycle & Skill Bursts
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

    for (let i = this.pickupRings.length - 1; i >= 0; i--) {
      const pr = this.pickupRings[i];
      pr.age += activeDt;
      if (pr.age >= pr.maxAge) {
        this.pickupRings.splice(i, 1);
        continue;
      }
      const r = 0.35 + (pr.age / pr.maxAge) * 1.45;
      this.drawMesh(this.meshes.ring, sm.setTRS(pr.pos[0], pr.pos[1], pr.pos[2], r, 1, r), pr.color, 0.96);
    }

    for (let i = this.skillBursts.length - 1; i >= 0; i--) {
      const sb = this.skillBursts[i];
      sb.age += activeDt;
      if (sb.age >= sb.maxAge) {
        this.skillBursts.splice(i, 1);
        continue;
      }
      const frac = sb.age / sb.maxAge;
      const r1 = 0.5 + frac * 3.8;
      const r2 = 0.25 + frac * 2.2;
      this.drawMesh(this.meshes.ring, sm.setTRS(sb.pos[0], sb.pos[1] + 0.12, sb.pos[2], r1, 1, r1, frac * 5), sb.color, 0.98);
      this.drawMesh(this.meshes.ring, sm.setTRS(sb.pos[0], sb.pos[1] + 0.35, sb.pos[2], r2, 1, r2, -frac * 6), sb.coreColor, 0.98);
    }

    for (let i = this.pickupFlies.length - 1; i >= 0; i--) {
      const pf = this.pickupFlies[i];
      pf.age += activeDt;
      if (pf.age >= pf.maxAge) {
        this.spawnBurst([this.mayLanternPos[0], this.mayLanternPos[1] - 0.5, this.mayLanternPos[2]], pf.color, 5, 1.4, 1.2);
        this.pickupFlies.splice(i, 1);
      }
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
    }

    // Detailed Billowing Multi-Puff 3D Dash Cloud Smoke (smoothly trailing Mây's feet & waist)
    if (activeDt > 0 && engine.player.dashTicks > 0 && engine.player.respawnTicks === 0) {
      const yaw = this.mayVisualYaw || 0;
      const rightX = Math.cos(yaw), rightZ = -Math.sin(yaw);
      for (let k = 0; k < 2; k++) {
        if (this.dashSmoke.length >= 32) this.dashSmoke.shift();
        const side = (k === 0 ? -1 : 1) * (0.14 + Math.random() * 0.16);
        const hOff = k === 0 ? 0.18 + Math.random() * 0.22 : 0.45 + Math.random() * 0.32;
        this.dashSmoke.push({
          pos: [
            pPos[0] + rightX * side + (Math.random() - 0.5) * 0.14,
            pPos[1] + hOff,
            pPos[2] + rightZ * side + (Math.random() - 0.5) * 0.14
          ],
          vel: [
            rightX * side * 1.8 + (Math.random() - 0.5) * 0.6,
            0.55 + Math.random() * 0.65,
            rightZ * side * 1.8 + (Math.random() - 0.5) * 0.6
          ],
          rx: 0.20 + Math.random() * 0.12,
          ry: 0.16 + Math.random() * 0.10,
          rz: 0.20 + Math.random() * 0.12,
          rotY: Math.random() * Math.PI * 2,
          isCore: k === 1,
          age: 0,
          maxAge: 0.36 + Math.random() * 0.10
        });
      }
    }
    for (let i = this.dashSmoke.length - 1; i >= 0; i--) {
      const smk = this.dashSmoke[i];
      smk.age += activeDt;
      if (smk.age >= smk.maxAge) {
        this.dashSmoke.splice(i, 1);
        continue;
      }
      if (activeDt > 0) {
        smk.pos[0] += smk.vel[0] * activeDt;
        smk.pos[1] += smk.vel[1] * activeDt;
        smk.pos[2] += smk.vel[2] * activeDt;
        smk.vel[0] *= 0.92;
        smk.vel[2] *= 0.92;
      }
    }

    if (this.particles.length > 0 || this.dashSmoke.length > 0) {
      if (this.instExt) {
        this.beginInstancedPass(count, playerGlow, pulseStrength, ambientIntensity);
        if (this.particles.length > 0) {
          let pc = 0;
          for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            const s = p.size * (1.0 - 0.6 * (p.age / p.maxAge));
            pc = this.pushInstance(pc, p.pos[0], p.pos[1], p.pos[2], 0, s, s, s, p.color);
            if (pc === this.MAX_INSTANCES) { this.drawInstancedBatch(this.meshes.sphereLow, pc, 0.95); pc = 0; }
          }
          this.drawInstancedBatch(this.meshes.sphereLow, pc, 0.95);
        }
        if (this.dashSmoke.length > 0) {
          let dc = 0;
          for (let i = 0; i < this.dashSmoke.length; i++) {
            const smk = this.dashSmoke[i];
            const frac = smk.age / smk.maxAge;
            const swell = Math.sin(Math.min(1, frac * 1.35) * Math.PI);
            const scale = (0.55 + frac * 1.15) * (0.45 + 0.55 * swell);
            const col = smk.isCore
              ? [0.96 - frac * 0.28, 0.94 - frac * 0.20, 1.0 - frac * 0.08]
              : [0.76 - frac * 0.20, 0.84 - frac * 0.16, 0.96 - frac * 0.06];
            dc = this.pushInstance(dc, smk.pos[0], smk.pos[1], smk.pos[2], smk.rotY + frac * 1.8, smk.rx * scale, smk.ry * scale, smk.rz * scale, col);
            if (dc === this.MAX_INSTANCES) { this.drawInstancedBatch(this.meshes.sphereLow, dc, 0.65); dc = 0; }
          }
          this.drawInstancedBatch(this.meshes.sphereLow, dc, 0.65);
        }
        this.endInstancedPass();
      } else {
        for (let i = 0; i < this.particles.length; i++) {
          const p = this.particles[i];
          const s = p.size * (1.0 - 0.6 * (p.age / p.maxAge));
          this.drawMesh(this.meshes.sphereLow, sm.setTRS(p.pos[0], p.pos[1], p.pos[2], s, s, s), p.color, 0.95);
        }
        for (let i = 0; i < this.dashSmoke.length; i++) {
          const smk = this.dashSmoke[i];
          const frac = smk.age / smk.maxAge;
          const swell = Math.sin(Math.min(1, frac * 1.35) * Math.PI);
          const scale = (0.55 + frac * 1.15) * (0.45 + 0.55 * swell);
          const col = smk.isCore
            ? [0.96 - frac * 0.28, 0.94 - frac * 0.20, 1.0 - frac * 0.08]
            : [0.76 - frac * 0.20, 0.84 - frac * 0.16, 0.96 - frac * 0.06];
          this.drawMesh(this.meshes.sphereLow, sm.setTRS(smk.pos[0], smk.pos[1], smk.pos[2], smk.rx * scale, smk.ry * scale, smk.rz * scale, smk.rotY + frac * 1.8), col, 0.65);
        }
      }
    }

    // 8. Volumetric Wind Gust Leaves (no solid "flying threads"; volumetric wind-mist billows render in Glow Pass)
    if (!benchmarkMode && !reducedMotion && engine.night === 3 && (engine.wind.active || engine.wind.warning)) {
      const isWindStorm = engine.wind.active;
      const wr = (engine.wind.dir_deg * Math.PI) / 180;
      const cosW = Math.cos(wr), sinW = Math.sin(wr);
      const spd = isWindStorm ? 15.5 : 8.0;
      for (let i = 0; i < 8; i++) {
        const cycle = ((timeSec * spd + i * 4.5) % 28) - 14;
        const lat = Math.cos(i * 1.9) * 10;
        const ox = pPos[0] + cosW * cycle - sinW * lat;
        const oz = pPos[2] + sinW * cycle + cosW * lat;
        const oy = pPos[1] + 0.65 + Math.sin(timeSec * 4.5 + i) * 0.75;
        this.drawMesh(this.meshes.cone, sm.setTRS(ox, oy, oz, 0.11, 0.20, 0.03, timeSec * 4 + i), [0.72, 0.96, 0.88], 0.82);
      }
    }

    // 9. Side Character Ông Đăng (disabled in benchmarkMode)
    let gourdPos = null;
    if (!benchmarkMode) {
      gourdPos = this.renderOngDang(engine, timeSec);
    }

    // 10. Articulated Hero Mây, Collectible Fireflies & Skill Cards/Projectiles
    let domTienPos = null;
    let mayVisible = false;
    if (engine.player.respawnTicks === 0) {
      const invulnVisible = reducedMotion || engine.player.invulnTicks === 0 || Math.floor(engine.player.invulnTicks / 4) % 2 === 0;
      if (invulnVisible) {
        mayVisible = true;
        domTienPos = this.renderHeroMay(engine, timeSec, carryFrac, reducedMotion, benchmarkMode, {
          count,
          playerGlow,
          pulseStrength,
          ambientIntensity
        }, activeDt, pPos);
      }
    }

    const skillState = options.skillState || null;
    if (!benchmarkMode) {
      renderDetailedFireflies(this, engine, timeSec, {
        count,
        playerGlow,
        pulseStrength,
        ambientIntensity
      });
      if (skillState) {
        renderSkillCardsAndProjectiles(this, skillState.cards, skillState.projectiles, skillState.lockTargetPos, skillState.lockColor, timeSec, {
          count,
          playerGlow,
          pulseStrength,
          ambientIntensity
        });
      }
    }

    // 11. Sculpted Distant Sky Lanterns & Luminous Spirit Cranes (!benchmarkMode)
    if (!benchmarkMode && sceneryData) {
      const em = this.getEntityModels();
      if (em) {
        this.beginColoredModelPass(count, playerGlow, pulseStrength, ambientIntensity);
        for (let i = 0; i < sceneryData.skyLanterns.length; i++) {
          const sl = sceneryData.skyLanterns[i];
          const cycleY = ((sl.baseY + timeSec * sl.speedY + 4) % 34) - 4;
          const driftX = sl.x + Math.sin(timeSec * 0.4 + sl.swayPhase) * 1.4;
          const driftZ = sl.z + Math.cos(timeSec * 0.35 + sl.swayPhase) * 1.4;
          this.jRoot.setTranslate(driftX, cycleY, driftZ).mulRotateY(sl.swayPhase + timeSec * 0.2).mulScale(sl.scale, sl.scale, sl.scale);
          this.drawColoredModel(em.skyLanternMesh, this.jRoot, 0.94);
        }

        const cranes = sceneryData.spiritCranes;
        for (let i = 0; i < cranes.length; i++) {
          const cr = cranes[i];
          const ang = cr.phase + timeSec * cr.speed;
          const cx = cr.centerOffsetX + Math.cos(ang) * cr.orbitR;
          const cz = Math.sin(ang) * cr.orbitR;
          const cy = cr.baseY + Math.sin(timeSec * 1.6 + cr.phase) * 1.1;
          const hdg = Math.atan2(-Math.sin(ang), Math.cos(ang));
          const flap = reducedMotion ? 0.1 : Math.sin(timeSec * 5.2 + cr.phase) * 0.48;
          const sc = cr.scale;

          this.jRoot.setTranslate(cx, cy, cz).mulRotateY(hdg).mulScale(sc, sc, sc);
          this.drawColoredModel(em.craneBody, this.jRoot, 0.90);
          this.jShoulder.copy(this.jRoot).mulTranslate(0.10, 0.04, 0.02).mulRotateZ(flap);
          this.drawColoredModel(em.craneWing, this.jShoulder, 0.88);
          this.jShoulder.copy(this.jRoot).mulTranslate(-0.10, 0.04, 0.02).mulScale(-1, 1, 1).mulRotateZ(flap);
          this.drawColoredModel(em.craneWing, this.jShoulder, 0.88);
        }
        this.endColoredModelPass();
      }
    }

    // 11b. Background Sea of Clouds, Drifting Cloud Banks, Harvest Moon & Stars (drawn AFTER foreground for hardware Early-Z!)
    this.drawMesh(this.meshes.cube, sm.setTRS(30, -14.5, 0, 260, 0.5, 260), [0.10, 0.15, 0.28], 0.96);

    const centerOffset = engine.night === 2 ? 35 : 0;
    const moonX = centerOffset + 24, moonY = 33, moonZ = 78;
    this.drawMesh(this.meshes.sphere, sm.setTRS(moonX, moonY, moonZ, 14.5, 14.5, 14.5), HUMAN_PALETTE.moonDisc, 1.0);
    this.drawMesh(this.meshes.sphereLow, sm.setTRS(moonX - 1.8, moonY + 1.4, moonZ - 6.1, 4.2, 4.2, 1.4), HUMAN_PALETTE.moonHalo, 0.95);
    this.drawMesh(this.meshes.sphereLow, sm.setTRS(moonX + 2.4, moonY - 1.6, moonZ - 6.0, 3.0, 3.0, 1.2), HUMAN_PALETTE.moonHalo, 0.95);

    if (this.instExt) {
      this.beginInstancedPass(count, playerGlow, pulseStrength, ambientIntensity);
      let cc = 0;
      for (let i = 0; i < 18; i++) {
        const ang = (i * Math.PI * 2) / 18 + timeSec * 0.015;
        const dist = 48 + (i % 3) * 14;
        const cx = centerOffset + Math.cos(ang) * dist;
        const cz = Math.sin(ang) * dist;
        const cy = -8.5 + Math.sin(timeSec * 0.6 + i) * 0.7;
        const cw = 18 + (i % 4) * 5;
        cc = this.pushInstance(cc, cx, cy, cz, 0, cw, 4.2, cw * 0.75, [0.13, 0.20, 0.36]);
        cc = this.pushInstance(cc, cx + 3, cy + 1.1, cz - 2, 0, cw * 0.65, 3.0, cw * 0.55, [0.16, 0.24, 0.42]);
      }
      this.drawInstancedBatch(this.meshes.sphereLow, cc, 0.96);

      let sc = 0;
      for (let i = 0; i < 84; i++) {
        const sa = i * 2.39996;
        const sr = 66 + (i % 7) * 6;
        const sx = centerOffset + Math.cos(sa) * sr;
        const sz = Math.sin(sa) * sr;
        const sy = 19 + (i % 11) * 3.2;
        const twinkle = 0.20 + 0.16 * Math.sin(timeSec * 2.5 + i * 1.1);
        sc = this.pushInstance(sc, sx, sy, sz, 0, twinkle, twinkle, twinkle, PALETTE.moteCore);
      }
      this.drawInstancedBatch(this.meshes.sphereLow, sc, 0.96);
      this.endInstancedPass();
    } else {
      for (let i = 0; i < 18; i++) {
        const ang = (i * Math.PI * 2) / 18 + timeSec * 0.015;
        const dist = 48 + (i % 3) * 14;
        const cx = centerOffset + Math.cos(ang) * dist;
        const cz = Math.sin(ang) * dist;
        const cy = -8.5 + Math.sin(timeSec * 0.6 + i) * 0.7;
        const cw = 18 + (i % 4) * 5;
        this.drawMesh(this.meshes.sphere, sm.setTRS(cx, cy, cz, cw, 4.2, cw * 0.75), [0.13, 0.20, 0.36], 0.96);
        this.drawMesh(this.meshes.sphere, sm.setTRS(cx + 3, cy + 1.1, cz - 2, cw * 0.65, 3.0, cw * 0.55), [0.16, 0.24, 0.42], 0.96);
      }

      for (let i = 0; i < 84; i++) {
        const sa = i * 2.39996;
        const sr = 66 + (i % 7) * 6;
        const sx = centerOffset + Math.cos(sa) * sr;
        const sz = Math.sin(sa) * sr;
        const sy = 19 + (i % 11) * 3.2;
        const twinkle = 0.20 + 0.16 * Math.sin(timeSec * 2.5 + i * 1.1);
        this.drawMesh(this.meshes.sphereLow, sm.setTRS(sx, sy, sz, twinkle, twinkle, twinkle), PALETTE.moteCore, 0.96);
      }
    }

    // 12. Soft-Blur Radial Glow & Atmospheric Firefly Particle Pass
    let gc = 0;
    // Blazing Harvest Moon corona + Cloud-Sea moonpath shimmer
    if (benchmarkMode) {
      gc = this.pushGlow(gc, moonX, moonY, moonZ, 32.0, HUMAN_PALETTE.moonHalo, 0.38);
      gc = this.pushGlow(gc, moonX, moonY, moonZ, 16.0, HUMAN_PALETTE.moonDisc, 0.80);
    } else {
      gc = this.pushGlow(gc, moonX, moonY, moonZ, 34.0, HUMAN_PALETTE.moonHalo, 0.22);
      gc = this.pushGlow(gc, moonX, moonY, moonZ, 19.0, HUMAN_PALETTE.moonDisc, 0.55);
      gc = this.pushGlow(gc, moonX, moonY, moonZ, 13.0, HUMAN_PALETTE.moonDisc, 0.78);
      gc = this.pushGlow(gc, centerOffset + 18, -7.2, 60, 18.0, HUMAN_PALETTE.moonHalo, 0.18);
    }

    // Mây handheld lantern volumetric bloom, tiny swirling fireflies INSIDE the lantern, jade halo & embers
    if (mayVisible) {
      const lx = this.mayLanternPos[0], ly = this.mayLanternPos[1], lz = this.mayLanternPos[2];
      const haloSz = 1.35 + 0.55 * carryFrac + (engine.player.charmTicks > 0 ? 0.35 : 0);
      gc = this.pushGlow(gc, lx, ly, lz, haloSz, PALETTE.lanternLit, 0.78);
      gc = this.pushGlow(gc, lx, ly, lz, haloSz * 0.50, PALETTE.lanternCore, 0.88);
      if (!benchmarkMode) {
        gc = this.pushGlow(gc, this.mayJadePos[0], this.mayJadePos[1], this.mayJadePos[2], 0.58, HUMAN_PALETTE.jadeAmulet, 0.72);
        for (let e = 0; e < 3; e++) {
          const et = (timeSec * 0.85 + e * 0.33) % 1.0;
          const ang = timeSec * 4.2 + e * 2.09;
          const ex = lx + Math.sin(ang) * (0.16 + 0.14 * et);
          const ez = lz + Math.cos(ang * 0.9) * (0.16 + 0.14 * et);
          const ey = ly - 0.08 + et * 0.75;
          gc = this.pushGlow(gc, ex, ey, ez, 0.22 * (1.0 - et * 0.55), HUMAN_PALETTE.ember, 0.88 * (1.0 - et));
        }
        // Tiny fireflies swirling harmoniously inside Mây's handheld Hội An lantern (no trailing chain)
        if (engine.player.respawnTicks === 0 && engine.player.carried > 0) {
          const tcX = this.camPosF32[0] - lx;
          const tcY = this.camPosF32[1] - ly;
          const tcZ = this.camPosF32[2] - lz;
          const tcLen = Math.hypot(tcX, tcY, tcZ) || 1;
          const biasX = (tcX / tcLen) * 0.16;
          const biasY = (tcY / tcLen) * 0.12;
          const biasZ = (tcZ / tcLen) * 0.16;
          const inCount = Math.min(10, engine.player.carried);
          for (let f = 0; f < inCount; f++) {
            const ang = timeSec * (3.2 + (f % 3) * 0.7) + f * 1.618;
            const orbitR = 0.04 + (f % 3) * 0.028;
            const ix = lx + biasX + Math.cos(ang) * orbitR;
            const iy = ly + biasY + Math.sin(ang * 1.5 + f) * 0.095;
            const iz = lz + biasZ + Math.sin(ang) * orbitR;
            const fc = getMoteColor(f + 1);
            gc = this.pushGlow(gc, ix, iy, iz, 0.16, fc, 0.88);
            if (f < 6) gc = this.pushGlow(gc, ix, iy, iz, 0.075, PALETTE.moteCore, 0.98);
          }
        }
      }
    }

    // Mote pickup spiral fly-in to Mây's handheld lantern
    if (!benchmarkMode && this.pickupFlies.length > 0) {
      const lx = this.mayLanternPos[0], ly = this.mayLanternPos[1], lz = this.mayLanternPos[2];
      for (let i = 0; i < this.pickupFlies.length; i++) {
        const pf = this.pickupFlies[i];
        const t = Math.max(0, Math.min(1, pf.age / pf.maxAge));
        const inv = 1 - t;
        const midX = (pf.from[0] + lx) * 0.5 + Math.cos(t * 9 + i) * 0.65;
        const midY = Math.max(pf.from[1], ly) + 1.35;
        const midZ = (pf.from[2] + lz) * 0.5 + Math.sin(t * 9 + i) * 0.65;
        const bx = inv * inv * pf.from[0] + 2 * inv * t * midX + t * t * lx;
        const by = inv * inv * pf.from[1] + 2 * inv * t * midY + t * t * ly;
        const bz = inv * inv * pf.from[2] + 2 * inv * t * midZ + t * t * lz;
        gc = this.pushGlow(gc, bx, by, bz, 0.75 * (1 - t * 0.4), pf.color, 0.88);
        gc = this.pushGlow(gc, bx, by, bz, 0.32 * (1 - t * 0.3), PALETTE.moteCore, 0.98);
        if (gc >= this.MAX_GLOWS - 8) { this.flushGlowPass(gc); gc = 0; }
      }
    }

    // Lit Great Lantern soft volumetric bloom, ground light pool & rising golden embers + 3D Overhead Arrow Halos
    for (let i = 0; i < engine.lanterns.length; i++) {
      const l = engine.lanterns[i];
      if (!l.lit) continue;
      const isLowFuel = l.fuelUnits < 1800;
      const blinkOn = reducedMotion || !isLowFuel || Math.floor(timeSec * 2.0) % 2 === 0;
      if (!blinkOn) continue;
      const pulse = 1.0 + 0.08 * Math.sin(timeSec * 3.0 + i);
      const glowOuter = benchmarkMode ? 3.8 : 5.0;
      const glowInner = benchmarkMode ? 1.7 : 2.2;
      gc = this.pushGlow(gc, l.pos[0], l.pos[1] + 2.3, l.pos[2], glowOuter * pulse, PALETTE.lanternLit, benchmarkMode ? 0.45 : 0.50);
      gc = this.pushGlow(gc, l.pos[0], l.pos[1] + 2.3, l.pos[2], glowInner * pulse, PALETTE.lanternCore, benchmarkMode ? 0.65 : 0.76);
      if (!benchmarkMode) {
        gc = this.pushGlow(gc, l.pos[0], l.pos[1] + 0.45, l.pos[2], 5.0 * pulse, PALETTE.lanternLit, 0.18);
        for (let e = 0; e < 3; e++) {
          const et = (timeSec * 0.65 + e * 0.33 + i * 0.19) % 1.0;
          const ex = l.pos[0] + Math.sin(timeSec * 2.4 + e * 2.3 + i) * 0.44;
          const ez = l.pos[2] + Math.cos(timeSec * 2.1 + e * 1.9 + i) * 0.44;
          const ey = l.pos[1] + 2.6 + et * 2.4;
          gc = this.pushGlow(gc, ex, ey, ez, 0.30 * (1.0 - et * 0.5), HUMAN_PALETTE.ember, 0.78 * (1.0 - et));
        }
      }
    }
    if (!benchmarkMode) {
      for (let i = 0; i < engine.lanterns.length; i++) {
        const l = engine.lanterns[i];
        const isLowFuel = l.lit && l.fuelUnits < 1800;
        if (l.lit && !isLowFuel) continue;
        const bob = reducedMotion ? 0 : (isLowFuel ? Math.sin(timeSec * 6.0 + i * 1.1) * 0.24 : Math.sin(timeSec * 3.4 + i * 1.1) * 0.22);
        const arrowY = l.pos[1] + (isLowFuel ? 5.55 : 5.15) + bob;
        const arrowCol = isLowFuel ? (colorblind ? PALETTE.dangerColorblind : PALETTE.danger) : PALETTE.goldUi;
        gc = this.pushGlow(gc, l.pos[0], arrowY, l.pos[2], isLowFuel ? 2.5 : 2.1, arrowCol, isLowFuel ? 0.58 : 0.48);
        if (gc >= this.MAX_GLOWS - 8) { this.flushGlowPass(gc); gc = 0; }
      }
    }

    // Collectible Fireflies larger vivid multi-color beacon bloom in gameplay (single lean glow in benchmarkMode)
    for (let i = 0; i < engine.motes.length; i++) {
      const m = engine.motes[i];
      const bob = Math.sin(timeSec * 3.5 + m.pos[0]) * 0.16 + 0.74;
      const swayX = Math.cos(timeSec * 2.2 + m.pos[2]) * 0.1;
      const tw = 0.88 + 0.22 * Math.sin(timeSec * 5.0 + i);
      if (benchmarkMode) {
        gc = this.pushGlow(gc, m.pos[0] + swayX, m.pos[1] + bob, m.pos[2], 1.15 * tw, PALETTE.moteHalo, 0.68);
      } else {
        const mc = getMoteColor(m.id);
        gc = this.pushGlow(gc, m.pos[0] + swayX, m.pos[1] + bob, m.pos[2], 2.25 * tw, mc, 0.78);
        gc = this.pushGlow(gc, m.pos[0] + swayX, m.pos[1] + bob, m.pos[2], 0.98 * tw, PALETTE.moteCore, 0.96);
      }
      if (gc >= this.MAX_GLOWS - 8) { this.flushGlowPass(gc); gc = 0; }
    }

    // Eerie Monster ("Ma mị") double miasma aura & soul core
    for (let i = 0; i < engine.shades.length; i++) {
      const sh = engine.shades[i];
      const isSpawning = !benchmarkMode && sh.state === 'spawning';
      const shCol = benchmarkMode ? shadeRimColor : getShadeVariant(engine.seed, sh.id, colorblind).accentColor;
      const mv = !benchmarkMode && this.monsterVis ? this.monsterVis.get(sh.id) : null;
      const sx = mv ? mv.x : sh.pos[0];
      const sy = mv ? mv.y : sh.pos[1];
      const sz = mv ? mv.z : sh.pos[2];
      gc = this.pushGlow(gc, sx, sy + 0.1, sz, isSpawning ? 3.1 : 2.35, shCol, isSpawning ? 0.62 : 0.30);
      if (!benchmarkMode) {
        const soulPulse = 0.82 + 0.18 * Math.sin(timeSec * 6.5 + i * 1.7);
        gc = this.pushGlow(gc, sx, sy + 0.32, sz, 0.95 * soulPulse, shCol, 0.45);
      }
      if (gc >= this.MAX_GLOWS - 8) { this.flushGlowPass(gc); gc = 0; }
    }

    // Soft Volumetric Dash Smoke Halos & True Volumetric Wind-Mist Gust Billows (zero extra draw calls!)
    if (!benchmarkMode) {
      for (let i = 0; i < this.dashSmoke.length; i++) {
        const smk = this.dashSmoke[i];
        const frac = smk.age / smk.maxAge;
        gc = this.pushGlow(
          gc,
          smk.pos[0],
          smk.pos[1],
          smk.pos[2],
          (0.85 + frac * 1.15) * (smk.isCore ? 1.1 : 0.9),
          smk.isCore ? PALETTE.lanternCore : [0.74, 0.86, 1.0],
          (1 - frac) * (smk.isCore ? 0.42 : 0.28)
        );
        if (gc >= this.MAX_GLOWS - 8) { this.flushGlowPass(gc); gc = 0; }
      }

      if (!reducedMotion) {
        const isWindStorm = engine.night === 3 && engine.wind.active;
        const isWindWarn = engine.night === 3 && engine.wind.warning;
        const wr = engine.night === 3 ? (engine.wind.dir_deg * Math.PI) / 180 : 0.55;
        const cosW = Math.cos(wr), sinW = Math.sin(wr);
        const gustCount = isWindStorm ? 4 : isWindWarn ? 3 : 2;
        const gustSpd = isWindStorm ? 15.0 : isWindWarn ? 8.5 : 3.2;
        const gustAlphaBase = isWindStorm ? 0.11 : isWindWarn ? 0.075 : 0.04;
        const gustColor = isWindStorm ? [0.72, 0.95, 0.98] : [0.66, 0.88, 0.96];
        for (let g = 0; g < gustCount; g++) {
          const prog = ((timeSec * gustSpd + g * 8.0) % 34) - 17;
          const fade = Math.sin(((prog + 17) / 34) * Math.PI);
          const lat = Math.sin(g * 2.3 + timeSec * 0.45) * (isWindStorm ? 11.0 : 9.0);
          const gx = pPos[0] + cosW * prog - sinW * lat;
          const gz = pPos[2] + sinW * prog + cosW * lat;
          const gy = pPos[1] + 1.1 + (g % 2) * 0.85 + Math.sin(timeSec * 2.4 + g) * 0.35;
          const gSize = (isWindStorm ? 5.2 : 4.2) + (g % 2) * 1.1;
          gc = this.pushGlow(gc, gx, gy, gz, gSize, gustColor, gustAlphaBase * fade);
        }
        if (gc >= this.MAX_GLOWS - 8) { this.flushGlowPass(gc); gc = 0; }
      }
    }

    // Skill Card pickups, Flying Projectiles & Elemental Burst Shocks
    if (!benchmarkMode && skillState) {
      if (skillState.cards) {
        for (let i = 0; i < skillState.cards.length; i++) {
          const c = skillState.cards[i];
          const hover = Math.sin(timeSec * 3.4 + i * 1.7) * 0.16;
          gc = this.pushGlow(gc, c.pos[0], c.pos[1] + 1.05 + hover, c.pos[2], 2.25, c.skill.color, 0.72);
          gc = this.pushGlow(gc, c.pos[0], c.pos[1] + 1.05 + hover, c.pos[2], 1.05, c.skill.core, 0.92);
          if (gc >= this.MAX_GLOWS - 8) { this.flushGlowPass(gc); gc = 0; }
        }
      }
      if (skillState.projectiles) {
        for (let i = 0; i < skillState.projectiles.length; i++) {
          const p = skillState.projectiles[i];
          gc = this.pushGlow(gc, p.pos[0], p.pos[1], p.pos[2], 2.1, p.skill.color, 0.85);
          gc = this.pushGlow(gc, p.pos[0], p.pos[1], p.pos[2], 0.95, p.skill.core, 0.98);
          if (p.trail) {
            for (let t = 0; t < p.trail.length; t++) {
              const tp = p.trail[t];
              gc = this.pushGlow(gc, tp[0], tp[1], tp[2], 0.75 * (1 - t / p.trail.length), p.skill.color, 0.65);
            }
          }
          if (gc >= this.MAX_GLOWS - 8) { this.flushGlowPass(gc); gc = 0; }
        }
      }
      for (let i = 0; i < this.skillBursts.length; i++) {
        const sb = this.skillBursts[i];
        const frac = sb.age / sb.maxAge;
        gc = this.pushGlow(gc, sb.pos[0], sb.pos[1] + 0.4, sb.pos[2], 2.4 + frac * 4.5, sb.color, (1 - frac) * 0.85);
        if (gc >= this.MAX_GLOWS - 8) { this.flushGlowPass(gc); gc = 0; }
      }
    }

    if (!benchmarkMode) {
      if (gourdPos) {
        gc = this.pushGlow(gc, gourdPos[0], gourdPos[1], gourdPos[2], 1.35, PALETTE.lanternLit, 0.65);
      }
      if (domTienPos) {
        gc = this.pushGlow(gc, domTienPos[0], domTienPos[1], domTienPos[2], 0.95, PALETTE.moteCore, 0.82);
      }

      // Sparser, smaller ambient drifting sparkles
      if (sceneryData) {
        const driftScale = reducedMotion ? 0.2 : 1.0;
        const windShift = (engine.night === 3 && engine.wind.active) ? timeSec * 1.4 : 0;
        for (let i = 0; i < sceneryData.ambientSpores.length; i++) {
          const sp = sceneryData.ambientSpores[i];
          const t = timeSec * sp.speed * driftScale + sp.phase;
          const sx = sp.cx + Math.sin(t) * sp.ampX + Math.sin(windShift + sp.phase) * 0.4;
          const sy = sp.cy + Math.sin(t * 1.3 + 0.8) * sp.ampY;
          const sz = sp.cz + Math.cos(t * 0.9) * sp.ampZ;
          const flicker = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(timeSec * 3.1 + sp.phase * 2.0));
          gc = this.pushGlow(gc, sx, sy, sz, sp.size * 2.1, sp.color, 0.62 * flicker);
          if (gc >= this.MAX_GLOWS - 8) { this.flushGlowPass(gc); gc = 0; }
        }

        // Overhead Moonlit Sky Cloud Banks drifting high across the sky
        const skyClouds = sceneryData.skyClouds;
        for (let i = 0; i < skyClouds.length; i++) {
          const sc = skyClouds[i];
          const t = reducedMotion ? sc.phase : timeSec * sc.speed + sc.phase;
          const cx = sc.x + Math.sin(t) * 3.2;
          const cy = sc.y + Math.cos(t * 0.6) * 0.9;
          const cz = sc.z + Math.cos(t * 0.8) * 3.2;
          gc = this.pushGlow(gc, cx, cy, cz, sc.size, sc.color, sc.alpha);
          if (gc >= this.MAX_GLOWS - 8) { this.flushGlowPass(gc); gc = 0; }
        }

        // Ascending distant sky lantern soft warm halos
        for (let i = 0; i < sceneryData.skyLanterns.length; i++) {
          const sl = sceneryData.skyLanterns[i];
          const cycleY = ((sl.baseY + timeSec * sl.speedY + 4) % 34) - 4;
          const driftX = sl.x + Math.sin(timeSec * 0.4 + sl.swayPhase) * 1.4;
          const driftZ = sl.z + Math.cos(timeSec * 0.35 + sl.swayPhase) * 1.4;
          gc = this.pushGlow(gc, driftX, cycleY, driftZ, 2.8 * sl.scale, PALETTE.lanternLit, 0.55);
          if (gc >= this.MAX_GLOWS - 8) { this.flushGlowPass(gc); gc = 0; }
        }

        // Static environmental glows (clovers, glowing flowers, crystals, lotuses, waterfalls, pagodas)
        const sGlows = sceneryData.staticGlows;
        for (let i = 0; i < sGlows.length; i++) {
          const sg = sGlows[i];
          const tw = 0.72 + 0.28 * Math.sin(timeSec * 2.2 + i * 1.3);
          gc = this.pushGlow(gc, sg.x, sg.y, sg.z, sg.size * (0.92 + 0.08 * tw), sg.color, sg.alpha * tw);
          if (gc >= this.MAX_GLOWS - 8) { this.flushGlowPass(gc); gc = 0; }
        }

        // Spirit Crane aura trails
        const cranes = sceneryData.spiritCranes;
        for (let i = 0; i < cranes.length; i++) {
          const cr = cranes[i];
          const ang = cr.phase + timeSec * cr.speed;
          const cx = cr.centerOffsetX + Math.cos(ang) * cr.orbitR;
          const cz = Math.sin(ang) * cr.orbitR;
          const cy = cr.baseY + Math.sin(timeSec * 1.6 + cr.phase) * 1.1;
          gc = this.pushGlow(gc, cx, cy, cz, 2.8 * cr.scale, PALETTE.lanternCore, 0.45);
          if (gc >= this.MAX_GLOWS - 8) { this.flushGlowPass(gc); gc = 0; }
        }

        // Celestial Aurora / Milky Way Star-River ribbons
        const aurora = sceneryData.auroraNodes;
        for (let i = 0; i < aurora.length; i++) {
          const an = aurora[i];
          const pulse = 0.8 + 0.2 * Math.sin(timeSec * 0.7 + an.phase);
          const drift = reducedMotion ? 0 : Math.sin(timeSec * 0.25 + an.phase) * 1.8;
          gc = this.pushGlow(gc, an.x + drift, an.y, an.z, an.size * (0.95 + 0.1 * pulse), an.color, an.alpha * pulse);
          if (gc >= this.MAX_GLOWS - 8) { this.flushGlowPass(gc); gc = 0; }
        }

        // Volumetric soft-blur mist banks & bokeh depth veils
        const mistBanks = sceneryData.mistBanks;
        for (let i = 0; i < mistBanks.length; i++) {
          const mb = mistBanks[i];
          const t = reducedMotion ? mb.phase : timeSec * mb.speed + mb.phase;
          const mx = mb.x + Math.sin(t) * mb.ampX;
          const my = mb.y + Math.sin(t * 0.7 + 1.1) * mb.ampY;
          const mz = mb.z + Math.cos(t * 0.85) * mb.ampX;
          const pulse = 0.92 + 0.08 * Math.sin(t * 1.3);
          gc = this.pushGlow(gc, mx, my, mz, mb.size * pulse, mb.color, mb.alpha);
          if (gc >= this.MAX_GLOWS - 8) { this.flushGlowPass(gc); gc = 0; }
        }

        // Periodic Shooting Stars (Sao băng) arcing high across the sky
        if (!reducedMotion) {
          for (let s = 0; s < 3; s++) {
            const cycle = (timeSec * 0.22 + s * 0.37) % 1.0;
            if (cycle < 0.26) {
              const prog = cycle / 0.26;
              const startX = centerOffset - 45 + s * 32;
              const startY = 38 + (s % 2) * 5;
              const startZ = 62 + s * 8;
              const hx = startX + prog * 36;
              const hy = startY - prog * 14;
              const fade = Math.sin(prog * Math.PI);
              for (let k = 0; k < 5; k++) {
                const kt = k * 0.045;
                const kx = hx - kt * 34;
                const ky = hy + kt * 13;
                const bAlpha = fade * (1.0 - k * 0.18) * 0.85;
                gc = this.pushGlow(gc, kx, ky, startZ, (1.9 - k * 0.28), k === 0 ? HUMAN_PALETTE.moonDisc : PALETTE.lanternCore, bAlpha);
              }
              if (gc >= this.MAX_GLOWS - 12) { this.flushGlowPass(gc); gc = 0; }
            }
          }
        }
      }
    }

    this.flushGlowPass(gc);
  }
}

function movingSpeedWave(speed) {
  return speed > 0.2 ? 9.5 : 3.2;
}
