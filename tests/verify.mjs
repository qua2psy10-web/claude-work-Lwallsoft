// 計算エンジンの検証テスト（理論解・手計算との照合）
//   node tests/verify.mjs
import { compute } from '../js/calc/engine.js';
import { presets, defaultInput } from '../js/model.js';

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
console.log('◆ 盛土勾配（β>0 で土圧増加）');
{
  const level = compute(defaultInput()).cases[0].ep.PA;
  const slope = compute(presets.slope()).cases[0].ep.PA;
  ok('盛土勾配で土圧増加', slope > level);
  const r = compute(presets.slope());
  ok('仮想背面高さ H′ > H', r.Hp > r.input.geometry.H);
  ok('NaNなし', r.cases.every((c) => isFinite(c.sum.V) && isFinite(c.bearing.qmax)));
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
