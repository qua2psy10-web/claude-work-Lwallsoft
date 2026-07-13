// 作用力の算定: 躯体自重・背面土砂・慣性力・作用力集計・地盤反力度
import { sectionProperties, bodyVertices, dims, haunchTri } from './geometry.js';

// 躯体自重（座標法）。XGはつま先版前面(x=0)からの距離、YGは底版下面(y=0)からの高さ。
export function selfWeight(geom, gammaConcrete, bodyLength) {
  const sec = sectionProperties(bodyVertices(geom));
  const V = sec.A * gammaConcrete * bodyLength;
  return { sec, A: sec.A, gamma: gammaConcrete, L: bodyLength, V, XG: sec.XG, YG: sec.YG, VXG: V * sec.XG };
}

// かかと版上の背面土砂（矩形部＋嵩上げ盛土部）
// 嵩上げ盛土: たて壁天端(x=xb)から勾配1:nで嵩上げ高さraiseまで立ち上がり、その先レベル
// raise < 0 は落差（土砂面標高 = H + raise のレベル地形）
export function soilParts(geom, backfill, gamma, L) {
  const { h, xb, B } = dims(geom);
  const { B3, t3, H } = geom;
  const raise = backfill?.raise || 0;
  const n = backfill?.slopeN || 0;
  const parts = [];
  if (B3 <= 1e-9) return parts;
  // 矩形部（t3〜土砂面, 幅B3。落差時は高さを控除）
  const hRect = Math.max(h + Math.min(raise, 0), 0);
  if (hRect > 1e-9) {
    parts.push({ name: '背面土砂(矩形部)', V: gamma * B3 * hRect * L, x: xb + B3 / 2, y: t3 + hRect / 2, mass: true });
  }
  if (raise < 0) return parts;
  // 嵩上げ盛土部（かかと版上のy>Hの土砂）
  if (raise > 1e-9 && n > 0) {
    const xBreak = n * raise; // xbからの折れ点距離
    if (xBreak >= B3) {
      // かかと版上はすべて勾配区間: 三角形（かかと末端で高さ B3/n）
      const hs = B3 / n;
      parts.push({ name: '背面土砂(嵩上げ勾配部)', V: gamma * 0.5 * B3 * hs * L, x: xb + 2 * B3 / 3, y: H + hs / 3, mass: true });
    } else {
      // 勾配区間の三角形 ＋ レベル区間の矩形
      parts.push({ name: '背面土砂(嵩上げ勾配部)', V: gamma * 0.5 * xBreak * raise * L, x: xb + 2 * xBreak / 3, y: H + raise / 3, mass: true });
      parts.push({ name: '背面土砂(嵩上げ水平部)', V: gamma * (B3 - xBreak) * raise * L, x: xb + xBreak + (B3 - xBreak) / 2, y: H + raise / 2, mass: true });
    }
  }
  // 隅角部ハンチが背面土砂を排除する分を控除
  const ht = haunchTri(geom);
  if (ht && hRect > 1e-9) {
    parts.push({ name: '背面土砂(ハンチ控除)', V: -gamma * ht.area * L, x: ht.cx, y: ht.cy, mass: true });
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

// 揚圧力（台形分布）
//  uP1 = -γw・HW1(つま先側), uP2 = -γw・HW2(かかと側)
//  UP  = (uP1+uP2)/2・B・L,  XG = B(uP1+2uP2)/{3(uP1+uP2)}（つま先端から）
export function uplift(gammaW, HW1, HW2, B, L) {
  const uP1 = -gammaW * HW1;
  const uP2 = -gammaW * HW2;
  const UP = (uP1 + uP2) / 2 * B * L;
  const XG = (uP1 + uP2) === 0 ? B / 2 : B * (uP1 + 2 * uP2) / (3 * (uP1 + uP2));
  return { gammaW, HW1, HW2, B, L, uP1, uP2, UP, XG, UPXG: UP * XG };
}

// 静水圧 PW = 1/2・γw・Hw²・L（dir: +1=背面(前方へ押す), -1=前面(抵抗)）
export function waterPressure(gammaW, Hw, L, dir) {
  const pw = dir * gammaW * Hw;
  const PW = 0.5 * pw * Hw * L;
  const YG = Hw / 3;
  return { gammaW, Hw, L, pw, PW, YG, PWYG: PW * YG };
}

// 揚圧力強度分布 u(x) [x: つま先端から。台形補間]
export function upliftAt(up, x) {
  if (!up) return 0;
  return up.gammaW * (up.HW1 + (up.HW2 - up.HW1) * x / up.B);
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
