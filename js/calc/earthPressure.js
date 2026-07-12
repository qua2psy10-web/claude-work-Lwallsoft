// 試行くさび法による主働土圧（L型擁壁・仮想背面）
// 仮想背面はかかと版末端を通る鉛直面（高さ H' = H + B3・tanβ）。壁面摩擦角 δ=β。
//   常時   : PA  = {W・sin(ω-φ) - c・l・cosφ} / cos(ω-φ-δ)
//   地震時 : PEA = {W・(sin(ω-φ)+kh・cos(ω-φ)) - c・l・cosφ} / cos(ω-φ-δ)
//     （W・(sin(ω-φ)+kh・cos(ω-φ)) = W・sin(ω-φ+θ)/cosθ, θ=tan⁻¹kh。物部・岡部と等価）
// すべり面は仮想背面下端（かかと版末端）を通る平面、地表面は勾配βで上昇。

const RAD = Math.PI / 180;

// 1つのすべり角ωに対する土圧合力（p: 計算パラメータ, heelX: 仮想背面のx座標）
function wedgeAt(omegaDeg, p, heelX) {
  const om = omegaDeg * RAD;
  const phi = p.phi * RAD;
  const beta = p.beta * RAD;
  const delta = p.delta * RAD;
  const tw = Math.tan(om), tb = Math.tan(beta);
  if (tw <= tb + 1e-9) return null;
  const T = p.Hp / (tw - tb);                 // くさびの水平幅
  const A = 0.5 * p.Hp * T;                    // くさび土砂面積
  const sgA = p.gamma * A;
  const sqB = (p.q || 0) * T;                  // 上載荷重
  const W = sgA + sqB;
  const l = T / Math.cos(om);                  // すべり面長さ
  const cl = (p.c || 0) * l;
  const den = Math.cos(om - phi - delta);
  if (den < 0.02) return null;
  const num = W * (Math.sin(om - phi) + (p.kh || 0) * Math.cos(om - phi)) - cl * Math.cos(phi);
  const PA = num / den;
  const end = [heelX + T, T * tw];
  return { omega: omegaDeg, T, A, sgA, sqB, W, l, cl, PA, end };
}

// パラメータ p: Hp(仮想背面高さ), gamma, phi(度), beta(度), delta(度), c, kh, q, precision(度)
// heelX: 仮想背面のx座標（=底版幅B）
export function trialWedge(p, heelX) {
  const precision = p.precision || 0.005;
  const lo = Math.max(p.phi, p.beta, 1) + 0.05;
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
  const X = heelX;              // 鉛直成分は仮想背面(x=heelX)上に作用
  const poly = [[heelX, 0], [heelX, p.Hp], r.end];
  return {
    omega, curve, end: r.end, poly,
    sgA: r.sgA, sqB: r.sqB, W: r.W, l: r.l, cl: r.cl, T: r.T,
    PA, PAV, PAH, X, Y, MV: PAV * X, MH: PAH * Y, Hp: p.Hp,
  };
}
