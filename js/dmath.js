// Deterministic math for the simulation. JavaScript only guarantees exact
// results for + - * / and sqrt; Math.sin, cos, exp, log, atan2, pow and hypot
// may differ in the last bit between engines (Safari uses the system math
// library, Chrome and Node their own). Orbits amplify such differences, so a
// run flown on an iPhone could replay differently on the server. These are
// ports of the fdlibm routines (FreeBSD msun), built only from basic
// arithmetic and bit inspection, so every engine gets the same answer.
(function (root) {
  'use strict';

  const buf = new DataView(new ArrayBuffer(8));
  const hi = (x) => { buf.setFloat64(0, x); return buf.getInt32(0); };
  const lo = (x) => { buf.setFloat64(0, x); return buf.getUint32(4); };
  const withHi = (x, h) => { buf.setFloat64(0, x); buf.setInt32(0, h); return buf.getFloat64(0); };
  const fromWords = (h, l) => { buf.setInt32(0, h); buf.setUint32(4, l); return buf.getFloat64(0); };

  // x · 2^k, exactly.
  function scalbn(x, k) {
    while (k > 1023) { x *= fromWords(0x7fe00000, 0); k -= 1023; }
    while (k < -1022) { x *= fromWords(0x00100000, 0); k += 1022; }
    return x * fromWords((k + 1023) << 20, 0);
  }

  // ------------------------------------------------------------ sin / cos
  const S1 = -1.66666666666666324348e-01, S2 = 8.33333333332248946124e-03, S3 = -1.98412698298579493134e-04,
    S4 = 2.75573137070700676789e-06, S5 = -2.50507602534068634195e-08, S6 = 1.58969099521155010221e-10;
  function kSin(x, y, iy) {
    const z = x * x, v = z * x, r = S2 + z * (S3 + z * (S4 + z * (S5 + z * S6)));
    if (iy === 0) return x + v * (S1 + z * r);
    return x - ((z * (0.5 * y - v * r) - y) - v * S1);
  }
  const C1 = 4.16666666666666019037e-02, C2 = -1.38888888888741095749e-03, C3 = 2.48015872894767294178e-05,
    C4 = -2.75573143513906633035e-07, C5 = 2.08757232129817482790e-09, C6 = -1.13596475577881948265e-11;
  function kCos(x, y) {
    const z = x * x, w2 = z * z;
    const r = z * (C1 + z * (C2 + z * C3)) + w2 * w2 * (C4 + z * (C5 + z * C6));
    const hz = 0.5 * z, w = 1.0 - hz;
    return w + (((1.0 - w) - hz) + (z * r - x * y));
  }

  const INVPIO2 = 6.36619772367581382433e-01, PIO2_1 = 1.57079632673412561417e+00, PIO2_1T = 6.07710050650619224932e-11,
    PIO2_2 = 6.07710050630396597660e-11, PIO2_2T = 2.02226624879595063154e-21, PIO2_3 = 2.02226624871116645580e-21,
    PIO2_3T = 8.47842766036889956997e-32;
  const red = [0, 0];
  // x = n·π/2 + (red[0] + red[1]). Good to |x| ≈ 8e5, far beyond any mission.
  function remPio2(x) {
    const j = (hi(x) & 0x7fffffff) >> 20;
    const fn = Math.round(x * INVPIO2);
    let r = x - fn * PIO2_1, w = fn * PIO2_1T;
    let y0 = r - w;
    let i = j - ((hi(y0) >> 20) & 0x7ff);
    if (i > 16) {
      let t = r; w = fn * PIO2_2; r = t - w; w = fn * PIO2_2T - ((t - r) - w); y0 = r - w;
      i = j - ((hi(y0) >> 20) & 0x7ff);
      if (i > 49) { t = r; w = fn * PIO2_3; r = t - w; w = fn * PIO2_3T - ((t - r) - w); y0 = r - w; }
    }
    red[0] = y0; red[1] = (r - y0) - w;
    return fn;
  }

  function sin(x) {
    const ix = hi(x) & 0x7fffffff;
    if (ix <= 0x3fe921fb) return ix < 0x3e400000 ? x : kSin(x, 0, 0);
    if (ix >= 0x7ff00000) return NaN;
    if (ix >= 0x413921fb) return Math.sin(x); // |x| > 1.6e6: never happens in the game
    const n = remPio2(x) & 3;
    return n === 0 ? kSin(red[0], red[1], 1) : n === 1 ? kCos(red[0], red[1]) : n === 2 ? -kSin(red[0], red[1], 1) : -kCos(red[0], red[1]);
  }
  function cos(x) {
    const ix = hi(x) & 0x7fffffff;
    if (ix <= 0x3fe921fb) return ix < 0x3e400000 ? 1 : kCos(x, 0);
    if (ix >= 0x7ff00000) return NaN;
    if (ix >= 0x413921fb) return Math.cos(x);
    const n = remPio2(x) & 3;
    return n === 0 ? kCos(red[0], red[1]) : n === 1 ? -kSin(red[0], red[1], 1) : n === 2 ? -kCos(red[0], red[1]) : kSin(red[0], red[1], 1);
  }

  // ------------------------------------------------------------ exp / log
  const LN2HI = 6.93147180369123816490e-01, LN2LO = 1.90821492927058770002e-10, INVLN2 = 1.44269504088896338700e+00,
    P1 = 1.66666666666666019037e-01, P2 = -2.77777777770155933842e-03, P3 = 6.61375632143793436117e-05,
    P4 = -1.65339022054652515390e-06, P5 = 4.13813679705723846039e-08;
  function exp(x) {
    if (x !== x) return NaN;
    if (x > 709.782712893383973096) return Infinity;
    if (x < -745.13321910194110842) return 0;
    const ax = x < 0 ? -x : x;
    let k = 0, h = 0, l = 0;
    if (ax > 0.5 * 0.6931471805599453) {
      if (ax < 1.5 * 0.6931471805599453) k = x > 0 ? 1 : -1;
      else k = Math.trunc(INVLN2 * x + (x < 0 ? -0.5 : 0.5));
      h = x - k * LN2HI; l = k * LN2LO; x = h - l;
    } else if (ax < 3.725290298461914e-09) return 1 + x;
    const t = x * x, c = x - t * (P1 + t * (P2 + t * (P3 + t * (P4 + t * P5))));
    if (k === 0) return 1 - ((x * c) / (c - 2.0) - x);
    return scalbn(1 - ((l - (x * c) / (2.0 - c)) - h), k);
  }

  const LG1 = 6.666666666666735130e-01, LG2 = 3.999999999940941908e-01, LG3 = 2.857142874366239149e-01,
    LG4 = 2.222219843214978396e-01, LG5 = 1.818357216161805012e-01, LG6 = 1.531383769920937332e-01,
    LG7 = 1.479819860511658591e-01;
  function log(x) {
    let hx = hi(x), k = 0;
    if (hx < 0x00100000) {
      if (x === 0) return -Infinity;
      if (hx < 0 || x !== x) return NaN;
      k -= 54; x *= 18014398509481984; hx = hi(x); // 2^54
    }
    if (hx >= 0x7ff00000) return x + x;
    k += (hx >> 20) - 1023;
    hx &= 0x000fffff;
    const i0 = (hx + 0x95f64) & 0x100000;
    x = withHi(x, hx | (i0 ^ 0x3ff00000));
    k += i0 >> 20;
    const f = x - 1.0, dk = k;
    if ((0x000fffff & (2 + hx)) < 3) {
      if (f === 0) return k === 0 ? 0 : dk * LN2HI + dk * LN2LO;
      const R = f * f * (0.5 - 0.33333333333333333 * f);
      return k === 0 ? f - R : dk * LN2HI - ((R - dk * LN2LO) - f);
    }
    const s = f / (2.0 + f), z = s * s, w = z * z;
    let i = hx - 0x6147a;
    const j = 0x6b851 - hx;
    const t1 = w * (LG2 + w * (LG4 + w * LG6)), t2 = z * (LG1 + w * (LG3 + w * (LG5 + w * LG7)));
    i |= j;
    const R = t2 + t1;
    if (i > 0) {
      const hfsq = 0.5 * f * f;
      return k === 0 ? f - (hfsq - s * (hfsq + R)) : dk * LN2HI - ((hfsq - (s * (hfsq + R) + dk * LN2LO)) - f);
    }
    return k === 0 ? f - s * (f - R) : dk * LN2HI - ((s * (f - R) - dk * LN2LO) - f);
  }

  // x^y for x > 0 (all the game needs).
  function pow(x, y) {
    if (y === 0) return 1;
    if (x === 1) return 1;
    if (!(x > 0)) return Math.pow(x, y);
    return exp(y * log(x));
  }

  // ------------------------------------------------------------ atan / atan2
  const ATANHI = [4.63647609000806093515e-01, 7.85398163397448278999e-01, 9.82793723247329054082e-01, 1.57079632679489655800e+00];
  const ATANLO = [2.26987774529616870924e-17, 3.06161699786838301793e-17, 1.39033110312309984516e-17, 6.12323399573676603587e-17];
  const AT = [3.33333333333329318027e-01, -1.99999999998764832476e-01, 1.42857142725034663711e-01, -1.11111104054623557880e-01,
    9.09088713343650656196e-02, -7.69187620504482999495e-02, 6.66107313738753120669e-02, -5.83357013379057348645e-02,
    4.97687799461593236017e-02, -3.65315727442169155270e-02, 1.62858201153657823623e-02];
  function atan(x) {
    const hx = hi(x), ix = hx & 0x7fffffff;
    let id;
    if (ix >= 0x44100000) {
      if (x !== x) return NaN;
      return hx > 0 ? ATANHI[3] + ATANLO[3] : -ATANHI[3] - ATANLO[3];
    }
    if (ix < 0x3fdc0000) {
      if (ix < 0x3e400000) return x;
      id = -1;
    } else {
      x = x < 0 ? -x : x;
      if (ix < 0x3ff30000) {
        if (ix < 0x3fe60000) { id = 0; x = (2.0 * x - 1.0) / (2.0 + x); } else { id = 1; x = (x - 1.0) / (x + 1.0); }
      } else if (ix < 0x40038000) { id = 2; x = (x - 1.5) / (1.0 + 1.5 * x); } else { id = 3; x = -1.0 / x; }
    }
    const z = x * x, w = z * z;
    const s1 = z * (AT[0] + w * (AT[2] + w * (AT[4] + w * (AT[6] + w * (AT[8] + w * AT[10])))));
    const s2 = w * (AT[1] + w * (AT[3] + w * (AT[5] + w * (AT[7] + w * AT[9]))));
    if (id < 0) return x - x * (s1 + s2);
    const zz = ATANHI[id] - ((x * (s1 + s2) - ATANLO[id]) - x);
    return hx < 0 ? -zz : zz;
  }

  const PI = 3.1415926535897931160e+00, PI_LO = 1.2246467991473531772e-16, PI_O_2 = 1.5707963267948965580e+00;
  function atan2(y, x) {
    if (x !== x || y !== y) return NaN;
    if (!isFinite(x) || !isFinite(y)) return Math.atan2(y, x); // never in the simulation
    if (x === 1) return atan(y);
    const hx = hi(x), hy = hi(y), ix = hx & 0x7fffffff, iy = hy & 0x7fffffff;
    let m = ((hy >> 31) & 1) | ((hx >> 30) & 2);
    if (y === 0) return m === 0 || m === 1 ? y : m === 2 ? PI : -PI;
    if (x === 0) return hy < 0 ? -PI_O_2 : PI_O_2;
    const k = (iy - ix) >> 20;
    let z;
    if (k > 60) { z = PI_O_2 + 0.5 * PI_LO; m &= 1; }
    else if (hx < 0 && k < -60) z = 0.0;
    else z = atan(Math.abs(y / x));
    switch (m) {
      case 0: return z;
      case 1: return -z;
      case 2: return PI - (z - PI_LO);
      default: return (z - PI_LO) - PI;
    }
  }

  // Exact (sqrt is correctly rounded everywhere); Math.hypot is not.
  const hypot = (x, y) => Math.sqrt(x * x + y * y);

  const DMath = { sin, cos, exp, log, pow, atan, atan2, hypot, _lo: lo };
  if (typeof module !== 'undefined' && module.exports) module.exports = DMath;
  else root.DMath = DMath;
})(typeof window !== 'undefined' ? window : globalThis);
