// 作用力の算定: 躯体自重・背面土砂・慣性力・作用力集計・地盤反力度
import { sectionProperties, bodyVertices, dims } from './geometry.js';

const RAD = Math.PI / 180;

// 躯体自重（座標法）。XGはつま先版前面(x=0)からの距離、YGは底版下面(y=0)からの高さ。
export function selfWeight(geom, gammaConcrete, bodyLength) {
  const sec = sectionProperties(bodyVertices(geom));
  const V = sec.A * gammaConcrete * bodyLength;
  return { sec, A: sec.A, gamma: gammaConcrete, L: bodyLength, V, XG: sec.XG, YG: sec.YG, VXG: V * sec.XG };
}

// かかと版上の背面土砂（矩形部＋盛土勾配部）
export function soilParts(geom, gamma, L) {
  const { h, xb, B } = dims(geom);
  const { B3, t3, H, beta } = geom;
  const parts = [];
  if (B3 <= 1e-9) return parts;
  // 矩形部（t3〜H, 幅B3）
  const Vr = gamma * B3 * h * L;
  parts.push({ name: '背面土砂(矩形部)', V: Vr, x: xb + B3 / 2, y: t3 + h / 2, mass: true });
  // 盛土勾配部（三角形）
  if (beta > 1e-9) {
    const hs = B3 * Math.tan(beta * RAD);
    const Vt = gamma * 0.5 * B3 * hs * L;
    parts.push({ name: '背面土砂(勾配部)', V: Vt, x: xb + 2 * B3 / 3, y: H + hs / 3, mass: true });
  }
  return parts;
}

// 上載荷重（かかと版上、鉛直下向き。慣性力は考慮しない）
export function surchargePart(geom, q, L) {
  const { xb, B } = dims(geom);
  const { B3 } = geom;
  if (B3 <= 1e-9 || q <= 0) return null;
  return { name: '上載荷重', V: q * B3 * L, x: xb + B3 / 2, y: 0, mass: false };
}

// 作用力の集計と偏心量・モーメント（つま先版前面まわり）
//  e = B/2 - (ΣV・x - ΣH・y)/ΣV,  M = V・e
export function aggregate(rows, B) {
  const V = rows.reduce((s, r) => s + r.V, 0);
  const Vx = rows.reduce((s, r) => s + r.Vx, 0);
  const H = rows.reduce((s, r) => s + r.H, 0);
  const Hy = rows.reduce((s, r) => s + r.Hy, 0);
  const e = B / 2 - (Vx - Hy) / V;
  const M = V * e;
  return { rows, B, V, Vx, H, Hy, e, M };
}

// 地盤反力度（台形分布 / 三角形分布）
//  e>0: 合力が底版中心よりつま先側 → q1(つま先側)が大
export function groundReaction(B, L, e, V, M) {
  const width3 = 3 * (B / 2 - Math.abs(e));
  if (width3 > B) {
    const q1 = V / (B * L) + 6 * M / (B * B * L);
    const q2 = V / (B * L) - 6 * M / (B * B * L);
    return { type: '台形', width3, B, Bp: B, q1, q2 };
  }
  const Bp = e < 0 ? B : width3;
  const q1 = 2 * V / (Bp * L);
  if (e < 0) return { type: '三角形', width3, B, Bp, q1: 0, q2: q1 };
  return { type: '三角形', width3, B, Bp, q1, q2: 0 };
}

// 地盤反力度の分布関数 q(x) [x: つま先版前面(x=0)から]
export function reactionAt(rc, x) {
  const { B, Bp, q1, q2, type } = rc;
  if (type === '台形') return q1 + (q2 - q1) * x / B;
  if (q2 === 0) return x <= Bp ? q1 * (1 - x / Bp) : 0;         // つま先側三角形
  return x >= B - Bp ? q2 * (1 - (B - x) / Bp) : 0;             // かかと側三角形
}
