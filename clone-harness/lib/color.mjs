// 색 거리(deltaE) — 색·픽셀 신호가 "이 색이 토큰 색과 얼마나 가까운가"를 숫자로 잴 때 쓴다.
// CIE76(Lab 유클리드)을 쓴다: 버그 표면이 작고 결정론적. 필요하면 CIEDE2000 으로 교체 가능.

/** "#RGB" | "#RRGGBB" | "rgb(...)" | "rgba(...)" → { r,g,b,a } (0-255, a 0-1). 못 읽으면 null. */
export function parseColor(input) {
  if (input == null) return null;
  const s = String(input).trim().toLowerCase();
  if (s === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };

  if (s.startsWith('#')) {
    let hex = s.slice(1);
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
    if (hex.length !== 6) return null;
    const n = Number.parseInt(hex, 16);
    if (Number.isNaN(n)) return null;
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }

  const m = s.match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const parts = m[1].split(/[,\s/]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const [r, g, b] = parts.map((p) => Number.parseFloat(p));
    const a = parts.length >= 4 ? Number.parseFloat(parts[3]) : 1;
    if ([r, g, b].some(Number.isNaN)) return null;
    return { r, g, b, a: Number.isNaN(a) ? 1 : a };
  }
  return null;
}

function srgbToLinear(c) {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** sRGB → CIE Lab (D65). */
export function rgbToLab({ r, g, b }) {
  const R = srgbToLinear(r);
  const G = srgbToLinear(g);
  const B = srgbToLinear(b);
  // linear sRGB → XYZ (D65)
  let x = R * 0.4124 + G * 0.3576 + B * 0.1805;
  let y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  let z = R * 0.0193 + G * 0.1192 + B * 0.9505;
  // 정규화 (D65 백색점)
  x /= 0.95047;
  y /= 1.0;
  z /= 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

/** CIE76 색 거리. 두 입력은 색 문자열 또는 {r,g,b}. 못 읽으면 null. */
export function deltaE(c1, c2) {
  const p1 = typeof c1 === 'string' ? parseColor(c1) : c1;
  const p2 = typeof c2 === 'string' ? parseColor(c2) : c2;
  if (!p1 || !p2) return null;
  const l1 = rgbToLab(p1);
  const l2 = rgbToLab(p2);
  return Math.hypot(l1.L - l2.L, l1.a - l2.a, l1.b - l2.b);
}

/** deltaE → 0~1 점수. dist 0 → 1, dist>=maxDeltaE → 0. */
export function deltaEScore(dist, maxDeltaE = 50) {
  if (dist == null) return null;
  return Math.max(0, Math.min(1, 1 - dist / maxDeltaE));
}
