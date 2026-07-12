// 試行くさび法による主働土圧（L型擁壁・仮想背面）
// 土圧作用面は鉛直面（仮想背面またはたて壁背面）。地表面は作用面天端から
// 勾配 1:n で嵩上げ高さ rise まで立ち上がり、その先レベルの折れ線地形。
//   常時   : PA  = {W・sin(ω-φ) - c・l・cosφ} / cos(ω-φ-δ)
//   地震時 : PEA = {W・(sin(ω-φ)+kh・cos(ω-φ)) - c・l・cosφ} / cos(ω-φ-δ)
//     （W・(sin(ω-φ)+kh・cos(ω-φ)) = W・sin(ω-φ+θ)/cosθ, θ=tan⁻¹kh。物部・岡部と等価）
// すべり面は作用面下端を通る平面。

const RAD = Math.PI / 180;

function shoelace(poly) {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}

// 多角形の y ≦ yc の部分を切り出す（Sutherland-Hodgman）
function clipBelow(poly, yc) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const ain = a[1] <= yc + 1e-12;
    const bin = b[1] <= yc + 1e-12;
    if (ain) out.push(a);
    if (ain !== bin) {
      const t = (yc - a[1]) / (b[1] - a[1]);
      out.push([a[0] + t * (b[0] - a[0]), yc]);
    }
  }
  return out;
}

// 1つのすべり角ωに対する土圧合力
// p: 計算パラメータ, heelX: 作用面のx座標（全体座標系での出力用）
function wedgeAt(omegaDeg, p, heelX) {
  const om = omegaDeg * RAD;
  const phi = p.phi * RAD;
  const delta = p.delta * RAD;
  const tw = Math.tan(om);
  if (tw <= 1e-9) return null;
  const rise = p.rise || 0;
  const n = p.slopeN || 0;

  // すべり線 y = x・tanω と地表面の交点（作用面天端を局所原点上のx=0とする）
  let xi, yi, brk = null;
  if (rise > 0 && n > 0) {
    const xBreak = n * rise;               // 勾配→レベルの折れ点
    let onSlope = false;
    const denom = tw - 1 / n;
    if (denom > 1e-9) {
      const x1 = p.Hp / denom;             // 勾配区間 y = Hp + x/n との交点
      if (x1 <= xBreak + 1e-12) { xi = x1; yi = xi * tw; onSlope = true; }
    }
    if (!onSlope) {
      xi = (p.Hp + rise) / tw;             // レベル区間 y = Hp + rise との交点
      if (xi < xBreak - 1e-9) return null; // すべり線が地表面と交差しない
      yi = p.Hp + rise;
      brk = [xBreak, p.Hp + rise];
    }
  } else {
    xi = p.Hp / tw;
    yi = p.Hp;
  }
  if (!(xi > 1e-9)) return null;

  // くさび多角形（局所座標: 作用面下端が原点）
  const poly = [[0, 0], [0, p.Hp]];
  if (brk) poly.push(brk);
  poly.push([xi, yi]);

  const A = shoelace(poly);
  if (!(A > 0)) return null;
  // 背面水位以下は水中単位体積重量
  const hw = Math.min(Math.max(p.waterLevel || 0, 0), p.Hp);
  const Abelow = hw > 0 ? shoelace(clipBelow(poly, hw)) : 0;
  const sgA = p.gamma * (A - Abelow) + (p.gammaSub || 0) * Abelow;
  const sqB = (p.q || 0) * xi;             // 上載荷重（水平投影幅）
  const W = sgA + sqB;
  const l = Math.hypot(xi, yi);            // すべり面長さ
  const cl = (p.c || 0) * l;
  const den = Math.cos(om - phi - delta);
  if (den < 0.02) return null;
  const num = W * (Math.sin(om - phi) + (p.kh || 0) * Math.cos(om - phi)) - cl * Math.cos(phi);
  const PA = num / den;
  return {
    omega: omegaDeg, T: xi, A, sgA, sqB, W, l, cl, PA,
    end: [heelX + xi, yi],
    poly: poly.map(([x, y]) => [heelX + x, y]),
  };
}

// パラメータ p: Hp(作用面高さ), gamma, gammaSub, waterLevel(作用面下端からの背面水位),
//   phi(度), delta(度), c, kh, q, precision(度),
//   rise(作用面天端より上の残り嵩上げ高さ m), slopeN(法面勾配1:nのn)
// heelX: 作用面のx座標（=仮想背面なら底版幅B）
export function trialWedge(p, heelX) {
  const precision = p.precision || 0.005;
  const lo = Math.max(p.phi, 1) + 0.05;
  const hi = 89.9;

  const curve = [];
  let best = null;
  const step = 0.1;
  for (let w = lo; w <= hi + 1e-9; w += step) {
    const r = wedgeAt(w, p, heelX);
    if (!r) continue;
    curve.push([w, Math.max(r.PA, 0)]);
    if (!best || r.PA > best.PA) best = r;
  }
  if (!best) {
    return { omega: 0, curve, PA: 0, PAV: 0, PAH: 0, W: 0, sgA: 0, sqB: 0, T: 0, l: 0, cl: 0,
      end: [heelX, 0], poly: [], X: heelX, Y: 0, MV: 0, MH: 0, Hp: p.Hp };
  }

  // 黄金分割法で precision まで詳細化
  let a = Math.max(lo, best.omega - step);
  let b = Math.min(hi, best.omega + step);
  const gr = (Math.sqrt(5) - 1) / 2;
  let c1 = b - gr * (b - a), c2 = a + gr * (b - a);
  let f1 = wedgeAt(c1, p, heelX)?.PA ?? -Infinity;
  let f2 = wedgeAt(c2, p, heelX)?.PA ?? -Infinity;
  while (b - a > precision / 2) {
    if (f1 < f2) { a = c1; c1 = c2; f1 = f2; c2 = a + gr * (b - a); f2 = wedgeAt(c2, p, heelX)?.PA ?? -Infinity; }
    else { b = c2; c2 = c1; f2 = f1; c1 = b - gr * (b - a); f1 = wedgeAt(c1, p, heelX)?.PA ?? -Infinity; }
  }
  const omega = (a + b) / 2;
  const r = wedgeAt(omega, p, heelX);

  const PA = Math.max(r.PA, 0);
  const d = p.delta * RAD;
  const PAV = PA * Math.sin(d);
  const PAH = PA * Math.cos(d);
  const Y = p.Hp / 3;            // 水平成分の作用高さ
  const X = heelX;              // 鉛直成分は作用面(x=heelX)上に作用
  return {
    omega, curve, end: r.end, poly: r.poly,
    sgA: r.sgA, sqB: r.sqB, W: r.W, l: r.l, cl: r.cl, T: r.T,
    PA, PAV, PAH, X, Y, MV: PAV * X, MH: PAH * Y, Hp: p.Hp,
  };
}
