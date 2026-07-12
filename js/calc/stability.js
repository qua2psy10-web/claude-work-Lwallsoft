// 安定計算（転倒・滑動・支持）

// 転倒照査: |e| ≦ B/n
export function checkOverturn(e, B, n) {
  const allow = B / n;
  return { e, absE: Math.abs(e), B, n, allow, ok: Math.abs(e) <= allow + 1e-9 };
}

// 滑動照査: Hu = V・μ + cB・Be・L,  Hu/H ≧ Fs（H≦0は算定不能）
export function checkSliding(V, H, e, B, L, mu, cB, Fs) {
  const Be = B - 2 * Math.abs(e);
  const Hu = V * mu + cB * Be * L;
  if (H <= 1e-9) {
    return { V, H, e, B, Be, L, mu, cB, Fs, Hu, indeterminate: true, ok: true };
  }
  const ratio = Hu / H;
  return { V, H, e, B, Be, L, mu, cB, Fs, Hu, ratio, indeterminate: false, ok: ratio >= Fs - 1e-9 };
}

// 支持照査: qmax ≦ qa
export function checkBearing(q1, q2, qa) {
  const qmax = Math.max(q1, q2);
  return { q1, q2, qmax, qa, ok: qmax <= qa + 1e-9 };
}
