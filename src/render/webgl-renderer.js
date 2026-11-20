import { Mat4 } from './matrix4.js';

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

  uniform vec3 uLanternLights[5];
  uniform float uLanternLit[5];
  uniform vec3 uPlayerPos;

  void main() {
    vec3 normal = normalize(vNormal);
    
    // Ambient night moonlight
    vec3 ambient = vec3(0.08, 0.10, 0.16) * vColor;

    // Directional soft moon light
    vec3 moonDir = normalize(vec3(0.3, 0.8, 0.4));
    float diff = max(dot(normal, moonDir), 0.0);
    vec3 diffuse = diff * vec3(0.15, 0.18, 0.25) * vColor;

    // Player little lantern light (warm yellow-orange)
    float pDist = length(uPlayerPos + vec3(0.0, 1.0, 0.0) - vFragPos);
    float pAtten = 1.0 / (1.0 + 0.3 * pDist + 0.1 * pDist * pDist);
    vec3 pLight = vec3(1.0, 0.75, 0.3) * pAtten * 1.5;

    // 5 Big Lantern lights
    vec3 lanternTotal = vec3(0.0);
    for (int i = 0; i < 5; i++) {
      float isLit = uLanternLit[i];
      float lDist = length(uLanternLights[i] + vec3(0.0, 2.0, 0.0) - vFragPos);
      float intensity = mix(0.4, 3.5, isLit);
      float atten = intensity / (1.0 + 0.1 * lDist + 0.04 * lDist * lDist);
      vec3 lColor = mix(vec3(0.8, 0.4, 0.1), vec3(1.0, 0.8, 0.3), isLit);
      lanternTotal += lColor * atten;
    }

    // Distance fog (sương đen đêm)
    float distToCam = length(vFragPos);
    float fogFactor = clamp((distToCam - 20.0) / 45.0, 0.0, 0.85);
    vec3 fogColor = vec3(0.03, 0.04, 0.08);

    vec3 finalColor = ambient + diffuse + (pLight + lanternTotal) * vColor;
    gl_FragColor = vec4(mix(finalColor, fogColor, fogFactor), 1.0);
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
    if (!this.gl) {
      alert('WebGL not supported!');
      return;
    }

    this.initProgram();
    this.initMeshes();

    this.gl.enable(this.gl.DEPTH_TEST);
    this.gl.clearColor(0.02, 0.03, 0.06, 1.0);
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
      playerPos: gl.getUniformLocation(this.program, 'uPlayerPos')
    };
  }

  initMeshes() {
    this.meshes = {
      cube: this.createCube(),
      cylinder: this.createCylinder(24),
      cone: this.createCone(24),
      sphere: this.createSphere(12, 12)
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
      // Front
      -0.5,-0.5, 0.5,  0.5,-0.5, 0.5,  0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
      // Back
      -0.5,-0.5,-0.5, -0.5, 0.5,-0.5,  0.5, 0.5,-0.5,  0.5,-0.5,-0.5,
      // Top
      -0.5, 0.5,-0.5, -0.5, 0.5, 0.5,  0.5, 0.5, 0.5,  0.5, 0.5,-0.5,
      // Bottom
      -0.5,-0.5,-0.5,  0.5,-0.5,-0.5,  0.5,-0.5, 0.5, -0.5,-0.5, 0.5,
      // Right
       0.5,-0.5,-0.5,  0.5, 0.5,-0.5,  0.5, 0.5, 0.5,  0.5,-0.5, 0.5,
      // Left
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
      0,1,2, 0,2,3,    4,5,6, 4,6,7,
      8,9,10, 8,10,11, 12,13,14, 12,14,15,
      16,17,18, 16,18,19, 20,21,22, 20,22,23
    ];
    return this.createBufferMesh(p, n, c, idx);
  }

  createCylinder(segs = 24) {
    const pos = [];
    const norm = [];
    const col = [];
    const idx = [];

    // Center tops
    pos.push(0, 0.5, 0); norm.push(0, 1, 0); col.push(1, 1, 1);
    pos.push(0, -0.5, 0); norm.push(0, -1, 0); col.push(1, 1, 1);

    for (let i = 0; i <= segs; i++) {
      const a = (i * Math.PI * 2) / segs;
      const x = Math.cos(a);
      const z = Math.sin(a);
      pos.push(x, 0.5, z); norm.push(x, 0, z); col.push(1, 1, 1);
      pos.push(x, -0.5, z); norm.push(x, 0, z); col.push(1, 1, 1);
    }

    for (let i = 0; i < segs; i++) {
      const t1 = 2 + i * 2;
      const b1 = 3 + i * 2;
      const t2 = 2 + (i + 1) * 2;
      const b2 = 3 + (i + 1) * 2;
      idx.push(t1, b1, t2, b1, b2, t2); // Side
      idx.push(0, t1, t2); // Top cap
      idx.push(1, b2, b1); // Bottom cap
    }

    return this.createBufferMesh(pos, norm, col, idx);
  }

  createCone(segs = 24) {
    const pos = [0, 0.5, 0];
    const norm = [0, 1, 0];
    const col = [1, 1, 1];
    const idx = [];

    for (let i = 0; i <= segs; i++) {
      const a = (i * Math.PI * 2) / segs;
      const x = Math.cos(a);
      const z = Math.sin(a);
      pos.push(x, -0.5, z);
      norm.push(x * 0.7, 0.5, z * 0.7);
      col.push(1, 1, 1);
    }

    for (let i = 0; i < segs; i++) {
      idx.push(0, 1 + i, 1 + i + 1);
    }
    return this.createBufferMesh(pos, norm, col, idx);
  }

  createSphere(latBands = 12, lonBands = 12) {
    const pos = [];
    const norm = [];
    const col = [];
    const idx = [];

    for (let lat = 0; lat <= latBands; lat++) {
      const theta = (lat * Math.PI) / latBands;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);

      for (let lon = 0; lon <= lonBands; lon++) {
        const phi = (lon * 2 * Math.PI) / lonBands;
        const x = Math.cos(phi) * sinTheta;
        const y = cosTheta;
        const z = Math.sin(phi) * sinTheta;

        pos.push(x * 0.5, y * 0.5, z * 0.5);
        norm.push(x, y, z);
        col.push(1, 1, 1);
      }
    }

    for (let lat = 0; lat < latBands; lat++) {
      for (let lon = 0; lon < lonBands; lon++) {
        const first = lat * (lonBands + 1) + lon;
        const second = first + lonBands + 1;
        idx.push(first, second, first + 1);
        idx.push(second, second + 1, first + 1);
      }
    }

    return this.createBufferMesh(pos, norm, col, idx);
  }

  drawMesh(mesh, modelMatrix, color) {
    const gl = this.gl;
    gl.uniformMatrix4fv(this.uniforms.model, false, modelMatrix.m);
    gl.uniform3fv(this.uniforms.colorOverride, color);
    gl.uniform1f(this.uniforms.useOverride, 1.0);

    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.posBuffer);
    gl.vertexAttribPointer(this.attribs.position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(this.attribs.position);

    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normBuffer);
    gl.vertexAttribPointer(this.attribs.normal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(this.attribs.normal);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.idxBuffer);
    gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0);
  }

  render(engine, camera) {
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(this.program);

    // View & Projection Matrices
    const aspect = this.canvas.width / this.canvas.height;
    const proj = Mat4.perspective((60 * Math.PI) / 180, aspect, 0.1, 150.0);
    const view = Mat4.lookAt(camera.eye, camera.target, [0, 1, 0]);

    gl.uniformMatrix4fv(this.uniforms.projection, false, proj.m);
    gl.uniformMatrix4fv(this.uniforms.view, false, view.m);

    // Uniform lights
    const lPosArray = [];
    const lLitArray = [];
    for (let i = 0; i < 5; i++) {
      const l = engine.lanterns[i] || { pos: [0, 0, 0], lit: false };
      lPosArray.push(l.pos[0], l.pos[1], l.pos[2]);
      lLitArray.push(l.lit ? 1.0 : 0.0);
    }
    gl.uniform3fv(this.uniforms.lanternLights, new Float32Array(lPosArray));
    gl.uniform1fv(this.uniforms.lanternLit, new Float32Array(lLitArray));
    gl.uniform3fv(this.uniforms.playerPos, new Float32Array(engine.player.pos));

    // 1. Render Island Disc (Top green, sides stone)
    const islandMat = new Mat4().translate(0, -1.0, 0).scale(40, 2.0, 40);
    this.drawMesh(this.meshes.cylinder, islandMat, [0.12, 0.22, 0.15]); // Island grass top

    // 2. Render Lanterns
    for (const lantern of engine.lanterns) {
      const lx = lantern.pos[0];
      const lz = lantern.pos[2];

      // Base stone pedestal
      const baseMat = new Mat4().translate(lx, 0.5, lz).scale(1.2, 1.0, 1.2);
      this.drawMesh(this.meshes.cube, baseMat, [0.25, 0.25, 0.28]);

      // Pillar
      const pillarMat = new Mat4().translate(lx, 1.6, lz).scale(0.5, 1.2, 0.5);
      this.drawMesh(this.meshes.cylinder, pillarMat, [0.35, 0.25, 0.18]);

      // Glowing core
      const coreMat = new Mat4().translate(lx, 2.5, lz).scale(0.8, 0.8, 0.8);
      const coreColor = lantern.lit ? [1.0, 0.85, 0.3] : [0.6, 0.35, 0.15];
      this.drawMesh(this.meshes.cube, coreMat, coreColor);

      // Curved Vietnamese roof
      const roofMat = new Mat4().translate(lx, 3.2, lz).scale(1.8, 0.6, 1.8);
      this.drawMesh(this.meshes.cone, roofMat, [0.45, 0.18, 0.12]);
    }

    // 3. Render Motes (Đom đóm vàng)
    const timeSec = engine.tickCount / 60.0;
    for (const mote of engine.motes) {
      const bob = Math.sin(timeSec * 3.0 + mote.pos[0]) * 0.2 + 0.4;
      const moteMat = new Mat4()
        .translate(mote.pos[0], mote.pos[1] + bob, mote.pos[2])
        .scale(0.35, 0.35, 0.35);
      this.drawMesh(this.meshes.sphere, moteMat, [1.0, 0.95, 0.4]);
    }

    // 4. Render Shades (Bóng Mực tím đen)
    for (const shade of engine.shades) {
      const sx = shade.pos[0];
      const sz = shade.pos[2];
      const isStunned = shade.state === 'stunned';

      const shadeScale = isStunned ? [1.4, 0.5, 1.4] : [1.1, 1.3, 1.1];
      const shadeMat = new Mat4()
        .translate(sx, 0.8, sz)
        .scale(shadeScale[0], shadeScale[1], shadeScale[2]);
      this.drawMesh(this.meshes.sphere, shadeMat, [0.10, 0.04, 0.18]); // Inky purple

      // Eyes
      const eyeMat = new Mat4()
        .translate(sx, 1.0, sz + 0.4)
        .scale(0.2, 0.1, 0.1);
      this.drawMesh(this.meshes.cube, eyeMat, isStunned ? [0.4, 0.4, 0.8] : [0.9, 0.2, 0.3]);
    }

    // 5. Render Mây (Player Character)
    const px = engine.player.pos[0];
    const pz = engine.player.pos[2];

    // Body (Blue/Cyan robe)
    const bodyMat = new Mat4().translate(px, 0.8, pz).scale(0.6, 1.1, 0.6);
    this.drawMesh(this.meshes.cylinder, bodyMat, [0.20, 0.45, 0.55]);

    // Head
    const headMat = new Mat4().translate(px, 1.5, pz).scale(0.5, 0.5, 0.5);
    this.drawMesh(this.meshes.sphere, headMat, [0.92, 0.78, 0.68]);

    // Conical Hat (Nón lá)
    const hatMat = new Mat4().translate(px, 1.85, pz).scale(1.2, 0.5, 1.2);
    this.drawMesh(this.meshes.cone, hatMat, [0.85, 0.75, 0.50]); // Bamboo straw color

    // Small hanging lantern on nón lá brim
    const miniLanternMat = new Mat4()
      .translate(px + 0.45, 1.4, pz + 0.3)
      .scale(0.25, 0.3, 0.25);
    this.drawMesh(this.meshes.cube, miniLanternMat, [1.0, 0.7, 0.2]);
  }
}
