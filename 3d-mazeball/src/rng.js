/** Deterministic hashing + RNG. Everything the world generator does is a pure
 *  function of (seed, cell coordinates), so the same seed always rebuilds the
 *  same world no matter what route the player takes through it. */

export function hash32 (...nums) {
  let h = 0x811c9dc5;
  for (let n of nums) {
    n = n | 0;
    for (let i = 0; i < 4; i++) {
      h ^= (n >>> (i * 8)) & 0xff;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
  }
  h ^= h >>> 15; h = Math.imul(h, 0x2545f491) >>> 0; h ^= h >>> 13;
  return h >>> 0;
}

export function mulberry32 (a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** An independent random stream for one lattice cell. */
export function cellRng (seed, cx, cz, salt = 0) {
  return mulberry32(hash32(seed, cx, cz, salt));
}

/** Value noise in [0,1), smoothed over a `scale`-cell grid. */
export function valueNoise (seed, x, z, scale) {
  const fx = x / scale, fz = z / scale;
  const x0 = Math.floor(fx), z0 = Math.floor(fz);
  const tx = fx - x0, tz = fz - z0;
  const sx = tx * tx * (3 - 2 * tx), sz = tz * tz * (3 - 2 * tz);
  const g = (a, b) => hash32(seed, a, b) / 4294967296;
  const a = g(x0, z0), b = g(x0 + 1, z0), c = g(x0, z0 + 1), d = g(x0 + 1, z0 + 1);
  return (a + (b - a) * sx) * (1 - sz) + (c + (d - c) * sx) * sz;
}

/**
 * Fisher-Yates over a copy. Never shuffle with `sort(() => rand() - 0.5)`:
 * an inconsistent comparator makes both the permutation *and* the number of
 * comparator calls implementation-defined, so the stream desynchronises and the
 * same seed builds a different world on a different JS engine.
 */
export function shuffle (rand, items) {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

export function weightedPick (rand, items, weightOf) {
  let total = 0;
  for (const it of items) total += Math.max(0, weightOf(it));
  if (total <= 0) return items.length ? items[Math.floor(rand() * items.length)] : null;
  let r = rand() * total;
  for (const it of items) {
    r -= Math.max(0, weightOf(it));
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}
