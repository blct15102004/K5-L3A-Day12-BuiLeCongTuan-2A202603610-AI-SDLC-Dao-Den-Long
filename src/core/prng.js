/**
 * Mulberry32 deterministic pseudo-random number generator
 * Produces 32-bit floats between 0 and 1.
 */
export class PRNG {
  constructor(seed = 123456789) {
    this.seed = (seed >>> 0) || 1;
  }

  next() {
    let t = (this.seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Returns float in [min, max)
  range(min, max) {
    return min + (max - min) * this.next();
  }

  // Returns integer in [min, max]
  rangeInt(min, max) {
    return Math.floor(this.range(min, max + 1));
  }
}
