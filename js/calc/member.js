// 部材計算: RC単鉄筋長方形断面の応力度照査（許容応力度法）
//   b = 1000mm, ヤング係数比 n = 15
//   p = As/(b・d),  k = √(2np+(np)²)−np,  j = 1−k/3
//   σc = 2M/(k・j・b・d²),  σs = M/(As・j・d),  τ = S/(b・j・d)
//   許容値は基準値×割増係数 f（常時1.00 / 地震時1.50）

const N = 15;      // ヤング係数比
const B = 1000;    // 単位幅 (mm)

// 最小・最大鉄筋量の照査値（断面・材料のみで決まり、割増係数 f には依存しない）
//   最小鉄筋量 As,min = pmin・b・d（既定 0.2%）
//     ただし道示に倣い、σs ≦ 3/4・σsa（＝計算上必要鉄筋量の 4/3 を満たす）ならば満足とみなす
//   最大鉄筋量 As,max = pb・b・d（釣合鉄筋比 pb）で過鉄筋（脆性破壊）を避ける
//     kb = n・σca /(n・σca + σsa),  pb = σca・kb /(2・σsa)  … f は分子分母で相殺
function rebarLimits({ As, d, sigmaS, sigmaCa, sigmaSa, pMin }) {
  const AsMin = pMin * B * d;
  const kb = N * sigmaCa / (N * sigmaCa + sigmaSa);
  const pB = sigmaCa * kb / (2 * sigmaSa);
  const AsMax = pB * B * d;
  const okMin = As >= AsMin - 1e-6 || sigmaS <= 0.75 * sigmaSa + 1e-9;
  const okMax = As <= AsMax + 1e-6;
  return { AsMin, AsMax, pB, okMin, okMax };
}

export function memberCheck({ M, S, t, cover, As, mat, f }) {
  const d = t * 1000 - cover;   // 有効高 (mm)
  const sigmaCa = mat.sigmaCa * f;
  const sigmaSa = mat.sigmaSa * f;
  const tauA = mat.tauA * f;
  const pMin = mat.pMin ?? 0.002;
  const Mabs = Math.abs(M);

  if (Mabs <= 1e-9 || As <= 0 || d <= 0) {
    const j0 = 0.875;
    const tau0 = Math.abs(S) * 1e3 / (B * j0 * d);
    const lim = rebarLimits({ As, d, sigmaS: 0, sigmaCa, sigmaSa, pMin });
    return {
      d, As, p: As / (B * d), k: 0, j: j0, sigmaC: 0, sigmaS: 0, tau: tau0,
      sigmaCa, sigmaSa, tauA, M, S, pMin, ...lim,
      okC: true, okS: true, okTau: tau0 <= tauA + 1e-9,
      get ok() { return this.okC && this.okS && this.okTau && this.okMin && this.okMax; },
    };
  }

  const p = As / (B * d);
  const k = Math.sqrt(2 * N * p + (N * p) ** 2) - N * p;
  const j = 1 - k / 3;
  const sigmaC = 2 * Mabs * 1e6 / (k * j * B * d * d);
  const sigmaS = Mabs * 1e6 / (As * j * d);
  const tau = Math.abs(S) * 1e3 / (B * j * d);
  const lim = rebarLimits({ As, d, sigmaS, sigmaCa, sigmaSa, pMin });

  return {
    d, As, p, k, j, sigmaC, sigmaS, tau, sigmaCa, sigmaSa, tauA, M, S, pMin, ...lim,
    okC: sigmaC <= sigmaCa + 1e-9,
    okS: sigmaS <= sigmaSa + 1e-9,
    okTau: tau <= tauA + 1e-9,
    get ok() { return this.okC && this.okS && this.okTau && this.okMin && this.okMax; },
  };
}

// 鉄筋種別の公称断面積 (mm²)
export const BAR_AREA = {
  D13: 126.7, D16: 198.6, D19: 286.5, D22: 387.1, D25: 506.7, D29: 642.4, D32: 794.2,
};

// As (mm²/m) = 1本断面積 × 1000/ピッチ(mm)
export function rebarAs(name, pitch) {
  return (BAR_AREA[name] || 0) * 1000 / Math.max(pitch, 1);
}
