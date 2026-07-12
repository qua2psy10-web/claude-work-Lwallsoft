// 部材計算: RC単鉄筋長方形断面の応力度照査（許容応力度法）
//   b = 1000mm, ヤング係数比 n = 15
//   p = As/(b・d),  k = √(2np+(np)²)−np,  j = 1−k/3
//   σc = 2M/(k・j・b・d²),  σs = M/(As・j・d),  τ = S/(b・j・d)
//   許容値は基準値×割増係数 f（常時1.00 / 地震時1.50）

const N = 15;      // ヤング係数比
const B = 1000;    // 単位幅 (mm)

export function memberCheck({ M, S, t, cover, As, mat, f }) {
  const d = t * 1000 - cover;   // 有効高 (mm)
  const sigmaCa = mat.sigmaCa * f;
  const sigmaSa = mat.sigmaSa * f;
  const tauA = mat.tauA * f;
  const Mabs = Math.abs(M);

  if (Mabs <= 1e-9 || As <= 0 || d <= 0) {
    const j0 = 0.875;
    const tau0 = Math.abs(S) * 1e3 / (B * j0 * d);
    return {
      d, As, p: As / (B * d), k: 0, j: j0, sigmaC: 0, sigmaS: 0, tau: tau0,
      sigmaCa, sigmaSa, tauA, M, S,
      okC: true, okS: true, okTau: tau0 <= tauA + 1e-9,
      get ok() { return this.okC && this.okS && this.okTau; },
    };
  }

  const p = As / (B * d);
  const k = Math.sqrt(2 * N * p + (N * p) ** 2) - N * p;
  const j = 1 - k / 3;
  const sigmaC = 2 * Mabs * 1e6 / (k * j * B * d * d);
  const sigmaS = Mabs * 1e6 / (As * j * d);
  const tau = Math.abs(S) * 1e3 / (B * j * d);

  return {
    d, As, p, k, j, sigmaC, sigmaS, tau, sigmaCa, sigmaSa, tauA, M, S,
    okC: sigmaC <= sigmaCa + 1e-9,
    okS: sigmaS <= sigmaSa + 1e-9,
    okTau: tau <= tauA + 1e-9,
    get ok() { return this.okC && this.okS && this.okTau; },
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
