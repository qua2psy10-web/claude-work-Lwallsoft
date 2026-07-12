// 計算エンジンの検証テスト（理論解・手計算との照合）
//   node tests/verify.mjs
import { compute } from '../js/calc/engine.js';
import { presets, defaultInput } from '../js/model.js';
import { trialWedge } from '../js/calc/earthPressure.js';

let pass = 0, fail = 0;
function eq(label, actual, expected, tol = 0.01) {
  const ok = Math.abs(actual - expected) <= tol;
  if (ok) pass++;
  else { fail++; console.error(`  NG ${label}: actual=${actual.toFixed(4)} expected=${expected}`); }
}
function ok(label, cond) {
  if (cond) pass++; else { fail++; console.error(`  NG ${label}`); }
}

const RAD = Math.PI / 180;

// ---------------------------------------------------------------
console.log('◆ 常時土圧：試行くさび法 vs クーロン(β=0, δ=0)');
{
  // 活荷重なしで土砂のみ：Ka = tan²(45°-φ/2) = 1/3, PA = 1/2・γ・H²・Ka
  const inp = defaultInput();
  inp.surcharge.enabled = false;
  inp.seismic.enabled = false;
  const c = compute(inp).cases[0];
  const Ka = Math.tan((45 - 30 / 2) * RAD) ** 2;
  eq('Ka=1/3', Ka, 1 / 3, 1e-9);
  eq('常時PA(土砂のみ)=クーロン', c.ep.PA, 0.5 * 19 * 9 * Ka, 0.05);
  eq('すべり角ω=45+φ/2', c.ep.omega, 60.0, 0.2);
  eq('PAV(δ=β=0)=0', c.ep.PAV, 0, 1e-6);
  eq('PAH=PA', c.ep.PAH, c.ep.PA, 1e-6);
}

// ---------------------------------------------------------------
console.log('◆ 上載荷重の寄与（Ka・q・H）');
{
  const c = compute(defaultInput()).cases[0]; // 活荷重あり
  const Ka = 1 / 3;
  // 土砂 28.5 + 活荷重 Ka・q・H = (1/3)・10・3 = 10 → 約38.5
  eq('常時PA(活荷重含む)', c.ep.PA, 0.5 * 19 * 9 * Ka + Ka * 10 * 3, 0.1);
}

// ---------------------------------------------------------------
console.log('◆ 地震時土圧：試行くさび法 vs 物部・岡部(β=0, δ=0)');
{
  const c = compute(defaultInput()).cases[1];
  const phi = 30 * RAD, th = Math.atan(0.15);
  const Kea = Math.cos(phi - th) ** 2 / (Math.cos(th) ** 2 * (1 + Math.sqrt(Math.sin(phi) * Math.sin(phi - th) / Math.cos(th))) ** 2);
  eq('地震時PA=物部・岡部', c.ep.PA, 0.5 * 19 * 9 * Kea, 0.15);
}

// ---------------------------------------------------------------
console.log('◆ 安定計算（標準ケース・手計算照合）');
{
  const r = compute(defaultInput());
  const c0 = r.cases[0], c1 = r.cases[1];
  eq('躯体自重V', r.self.V, 61.25, 0.01);   // (0.5*3.0 + 台形たて壁2.5*0.4 + ...)*24.5
  eq('底版幅B', r.dims.B, 3.0, 1e-9);
  eq('常時ΣV', c0.sum.V, 176.25, 0.05);
  eq('常時ΣH', c0.sum.H, 38.50, 0.05);
  eq('常時偏心量e', c0.sum.e, -0.0099, 0.002);
  ok('常時 転倒OK', c0.overturn.ok);
  eq('常時 滑動Fs', c0.sliding.ratio, 2.747, 0.01);
  ok('常時 滑動OK', c0.sliding.ok);
  ok('常時 支持OK', c0.bearing.ok);
  ok('常時 台形分布', c0.reaction.type === '台形');

  eq('地震時ΣV', c1.sum.V, 156.25, 0.05);
  eq('地震時ΣH', c1.sum.H, 60.45, 0.1);
  ok('地震時 転倒OK', c1.overturn.ok);
  eq('地震時 滑動Fs', c1.sliding.ratio, 1.551, 0.02);
  ok('地震時 支持OK', c1.bearing.ok);
}

// ---------------------------------------------------------------
console.log('◆ 部材照査（標準ケース）');
{
  const c0 = compute(defaultInput()).cases[0];
  const c1 = compute(defaultInput()).cases[1];
  ok('たて壁 常時OK', c0.member.stem.ok);
  ok('つま先版 常時OK', c0.member.toe.ok);
  ok('かかと版 常時OK', c0.member.heel.ok);
  ok('全部材 地震時OK', c1.member.ok);
  // 地震時は許容応力度1.5倍
  eq('地震時割増σsa', c1.member.stem.sigmaSa, 180 * 1.5, 1e-6);
  eq('常時割増σsa', c0.member.stem.sigmaSa, 180, 1e-6);
  // せん断のみ照査でもd,jが有効
  ok('かかと版M>0', c0.member.heel.M > 0);
  ok('つま先版M>0', c0.member.toe.M > 0);
}

// ---------------------------------------------------------------
console.log('◆ 逆L型（つま先版なし B1=0）');
{
  const r = compute(presets.pureL());
  const c0 = r.cases[0];
  ok('B1=0 でも計算成立', isFinite(c0.sum.V) && isFinite(c0.sum.e));
  ok('つま先版 M=0（部材なし）', c0.member.toe.M === 0);
  ok('底版幅=t2+B3', Math.abs(r.dims.B - (0.5 + 2.3)) < 1e-9);
}

// ---------------------------------------------------------------
console.log('◆ 嵩上げ盛土（勾配1:n・嵩上げ高さ）');
{
  // (1) 無限長斜面の極限は Rankine の理論解と一致（β=10°, δ=β, 鉛直作用面）
  //     Ka = cosβ・(cosβ−√(cos²β−cos²φ))/(cosβ+√(cos²β−cos²φ)),  PA = 1/2・γ・H²・Ka
  const beta = 10, phi = 30, gamma = 19, Hw = 1.0;
  const cb = Math.cos(beta * RAD);
  const rt = Math.sqrt(cb * cb - Math.cos(phi * RAD) ** 2);
  const Ka = cb * (cb - rt) / (cb + rt);
  const PAexp = 0.5 * gamma * Hw * Hw * Ka;
  const rw = trialWedge({
    Hp: Hw, gamma, phi, delta: beta, c: 0, kh: 0, q: 0,
    precision: 0.001, rise: 100, slopeN: 1 / Math.tan(beta * RAD),
  }, 0.5);
  eq('無限斜面 PA = Rankine', rw.PA, PAexp, PAexp * 0.005);

  // (2) 嵩上げ高さに対する単調性: レベル < 嵩上げ0.5m < 嵩上げ大
  const mk = (raise) => {
    const d = defaultInput();
    d.surcharge.enabled = false;
    d.seismic.enabled = false;
    d.backfill.raise = raise;
    d.backfill.slopeN = 3.0; // β≈18.4° < φ
    return compute(d).cases[0].ep.PA;
  };
  const pa0 = mk(0), pa05 = mk(0.5), paBig = mk(50);
  ok('嵩上げでPA増加(0<0.5<大)', pa05 > pa0 && paBig > pa05);
  eq('raise=0はレベルと一致(Ka=1/3)', pa0, 0.5 * 19 * 9 / 3, 0.05);

  // (3) 仮想背面高さ H′ = H + min(B3/n, raise)
  const d1 = defaultInput();
  d1.backfill.raise = 0.4;      // B3/n = 2.0/1.5 = 1.333 > 0.4 → H′ = H + 0.4
  d1.backfill.slopeN = 1.5;
  eq('H′ = H + raise(折れ点がかかと内)', compute(d1).Hp, 3.4, 1e-9);
  const d2 = defaultInput();
  d2.backfill.raise = 2.0;      // B3/n = 1.333 < 2.0 → H′ = H + B3/n
  d2.backfill.slopeN = 1.5;
  eq('H′ = H + B3/n(折れ点がかかと外)', compute(d2).Hp, 3.0 + 2.0 / 1.5, 1e-9);

  // (4) 背面土砂の嵩上げ部重量（raise=0.4, n=1.5: 三角形0.5·0.6·0.4 + 矩形1.4·0.4）
  const r1 = compute(d1);
  const extra = r1.soil.filter((p) => p.name.includes('嵩上げ')).reduce((s, p) => s + p.V, 0);
  eq('嵩上げ部土砂重量', extra, 19 * (0.5 * 0.6 * 0.4 + 1.4 * 0.4), 0.01);

  // (5) 標準の嵩上げプリセット(1:1.5, raise=1.0)が正常に計算できる
  const rs = compute(presets.slope());
  ok('嵩上げプリセット NaNなし', rs.cases.every((c) => isFinite(c.sum.V) && isFinite(c.bearing.qmax) && c.ep.PA > 0));
  ok('嵩上げプリセット H′>H', rs.Hp > 3.0);
}

// ---------------------------------------------------------------
console.log('◆ 衝突荷重（衝突時ケース）');
{
  const base = compute(defaultInput());
  const inp = defaultInput();
  inp.collision.enabled = true;
  inp.collision.P = 10;
  inp.collision.h = 3.0;
  const r = compute(inp);
  ok('ケース数+1', r.cases.length === base.cases.length + 1);
  const cc = r.cases[r.cases.length - 1];
  ok('衝突ケース名', cc.name === '衝突時');
  // 衝突時は活荷重なし → 常時(活荷重なし)と比較
  const inpN = defaultInput();
  inpN.surcharge.enabled = false;
  const cN = compute(inpN).cases[0];
  eq('衝突時 ΣH = 常時(活荷重なし)H + P・L', cc.sum.H, cN.sum.H + 10 * 1.0, 0.01);
  eq('衝突時 ΣH・y増分 = P・L・h', cc.sum.Hy - cN.sum.Hy, 10 * 1.0 * 3.0, 0.01);
  eq('衝突時 ΣV = 常時(活荷重なし)V', cc.sum.V, cN.sum.V, 0.01);
  eq('衝突時 Fs条件', cc.cond.Fs, 1.2, 1e-9);
  // 部材: 割増係数1.5、たて壁に衝突荷重が加算される
  eq('衝突時 σsa割増1.5', cc.member.stem.sigmaSa, 180 * 1.5, 1e-6);
  eq('たて壁S増分 = P', cc.member.stem.S - cN.member.stem.S, 10, 0.01);
  eq('たて壁M増分 = P・(h−t3)', cc.member.stem.M - cN.member.stem.M, 10 * (3.0 - 0.5), 0.01);
  // 既存ケースへの影響なし
  eq('既存ケースV不変', r.cases[0].sum.V, base.cases[0].sum.V, 1e-9);
  eq('既存ケースH不変', r.cases[0].sum.H, base.cases[0].sum.H, 1e-9);
  // 作用高さが底版内(h<t3)ならたて壁断面力に算入しない
  const inp2 = defaultInput();
  inp2.collision.enabled = true;
  inp2.collision.h = 0.3;
  const cc2 = compute(inp2).cases[compute(inp2).cases.length - 1];
  eq('h<t3ならたて壁S不変', cc2.member.stem.S, cN.member.stem.S, 0.01);
}

// ---------------------------------------------------------------
console.log('◆ 全プリセットで例外・NaNが発生しないこと');
{
  for (const [name, fn] of Object.entries(presets)) {
    try {
      const r = compute(fn());
      const bad = r.cases.some((c) => !isFinite(c.sum.V) || !isFinite(c.sum.e) || !isFinite(c.bearing.qmax));
      ok(`プリセット ${name} 正常`, !bad);
    } catch (e) { fail++; console.error(`  NG プリセット ${name} 例外: ${e.message}`); }
  }
}

// ---------------------------------------------------------------
console.log(`\n結果: ${pass} 件一致 / ${fail} 件不一致`);
process.exit(fail === 0 ? 0 : 1);
