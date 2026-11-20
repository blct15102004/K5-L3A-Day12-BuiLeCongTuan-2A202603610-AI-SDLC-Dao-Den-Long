// Minimal 4x4 Matrix math for WebGL 3D rendering
export class Mat4 {
  constructor() {
    this.m = new Float32Array(16);
    this.identity();
  }

  identity() {
    this.m.fill(0);
    this.m[0] = 1; this.m[5] = 1; this.m[10] = 1; this.m[15] = 1;
    return this;
  }

  static perspective(fovyRad, aspect, near, far) {
    const out = new Mat4();
    const f = 1.0 / Math.tan(fovyRad / 2);
    const nf = 1 / (near - far);
    out.m[0] = f / aspect;
    out.m[5] = f;
    out.m[10] = (far + near) * nf;
    out.m[11] = -1;
    out.m[14] = (2 * far * near) * nf;
    out.m[15] = 0;
    return out;
  }

  static lookAt(eye, center, up) {
    const out = new Mat4();
    let z0 = eye[0] - center[0];
    let z1 = eye[1] - center[1];
    let z2 = eye[2] - center[2];
    let len = 1 / Math.hypot(z0, z1, z2);
    z0 *= len; z1 *= len; z2 *= len;

    let x0 = up[1] * z2 - up[2] * z1;
    let x1 = up[2] * z0 - up[0] * z2;
    let x2 = up[0] * z1 - up[1] * z0;
    len = Math.hypot(x0, x1, x2);
    if (!len) {
      x0 = 0; x1 = 0; x2 = 0;
    } else {
      len = 1 / len;
      x0 *= len; x1 *= len; x2 *= len;
    }

    let y0 = z1 * x2 - z2 * x1;
    let y1 = z2 * x0 - z0 * x2;
    let y2 = z0 * x1 - z1 * x0;

    out.m[0] = x0; out.m[1] = y0; out.m[2] = z0; out.m[3] = 0;
    out.m[4] = x1; out.m[5] = y1; out.m[6] = z1; out.m[7] = 0;
    out.m[8] = x2; out.m[9] = y2; out.m[10] = z2; out.m[11] = 0;
    out.m[12] = -(x0 * eye[0] + x1 * eye[1] + x2 * eye[2]);
    out.m[13] = -(y0 * eye[0] + y1 * eye[1] + y2 * eye[2]);
    out.m[14] = -(z0 * eye[0] + z1 * eye[1] + z2 * eye[2]);
    out.m[15] = 1;
    return out;
  }

  multiply(b) {
    const a = this.m;
    const bm = b.m;
    const out = new Float32Array(16);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        out[i * 4 + j] =
          a[i * 4 + 0] * bm[0 * 4 + j] +
          a[i * 4 + 1] * bm[1 * 4 + j] +
          a[i * 4 + 2] * bm[2 * 4 + j] +
          a[i * 4 + 3] * bm[3 * 4 + j];
      }
    }
    this.m = out;
    return this;
  }

  translate(x, y, z) {
    const t = new Mat4();
    t.m[12] = x; t.m[13] = y; t.m[14] = z;
    return this.multiply(t);
  }

  rotateY(rad) {
    const r = new Mat4();
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    r.m[0] = c; r.m[2] = -s;
    r.m[8] = s; r.m[10] = c;
    return this.multiply(r);
  }

  scale(sx, sy, sz) {
    const s = new Mat4();
    s.m[0] = sx; s.m[5] = sy; s.m[10] = sz;
    return this.multiply(s);
  }

  clone() {
    const c = new Mat4();
    c.m.set(this.m);
    return c;
  }
}
