// 全荷重ケースの一括計算（L型擁壁）
import { dims } from './geometry.js';
import { trialWedge } from './earthPressure.js';
import { selfWeight, soilParts, surchargePart, aggregate, groundReaction, reactionAt, uplift, waterPressure, upliftAt } from './forces.js';
import { checkOverturn, checkSliding, checkBearing } from './stability.js';
import { memberCheck, rebarAs } from './member.js';
import { generateCases } from '../model.js';

const RAD = Math.PI / 180;

export function compute(input) {
  const geom = input.geometry;
  const { h, xb, B } = dims(geom);
  const gammaC = input.concrete.gammaC;
  const gamma = input.soil.gamma;
  const L = input.lengths.base;

  // 嵩上げ盛土（たて壁天端から勾配1:nで嵩上げ高さraiseまで、以降レベル）
  const raise = input.backfill?.raise || 0;
  const slopeN = input.backfill?.slopeN || 0;
  const raised = raise > 1e-9 && slopeN > 0;
  const beta = raised ? Math.atan(1 / slopeN) / RAD : 0;    // 法面傾斜角（度）
  // 仮想背面高さ H' と、仮想背面天端より上の残り嵩上げ高さ
  const riseAtVbf = raised ? Math.min(geom.B3 / slopeN, raise) : 0;
  const Hp0 = geom.H + riseAtVbf;
  const riseRem = raised ? raise - riseAtVbf : 0;
  // 仮想背面の壁面摩擦角 δ＝仮想背面位置の地表面勾配（レベル到達済みなら0、上限φ）
  const deltaVbf = riseRem > 1e-9 ? Math.min(beta, input.soil.phi) : 0;

  const self = selfWeight(geom, gammaC, input.lengths.body);
  const soil = soilParts(geom, input.backfill, gamma, L);
  const soilV = soil.reduce((s, p) => s + p.V, 0);
  const soilVy = soil.reduce((s, p) => s + p.V * p.y, 0);

  // 水位・揚圧力・静水圧（浮力考慮ケースで作用）
  const waterOn = !!input.water?.enabled;
  const gammaW = input.soil.gammaW;
  const hwF = waterOn ? Math.max(input.water.front, 0) : 0;   // 前面水位
  const hwB = waterOn ? Math.max(input.water.back, 0) : 0;    // 背面水位
  const upliftOn = waterOn && input.water.considerUplift !== false;
  const up = upliftOn ? uplift(gammaW, hwF, hwB, B, L) : null;
  const wpBack = waterOn && hwB > 0 ? waterPressure(gammaW, hwB, L, +1) : null;
  const wpFront = waterOn && hwF > 0 ? waterPressure(gammaW, hwF, L, -1) : null;

  // 衝突荷重（土圧と同方向の水平集中荷重 H = P・L）
  const col = input.collision?.enabled
    ? {
        name: input.collision.name || '衝突荷重',
        P: input.collision.P, h: input.collision.h, L: input.lengths.body,
        H: input.collision.P * input.lengths.body,
        Hy: input.collision.P * input.lengths.body * input.collision.h,
      }
    : null;

  const caseDefs = generateCases(input);
  const cases = caseDefs.map((cd) => {
    const kh = cd.seismic ? input.seismic.kh : 0;
    const q = cd.surcharge ? input.surcharge.q : 0;
    const cCoh = cd.seismic ? input.soil.cE : input.soil.c;
    const useWater = !!cd.water;

    // --- 主働土圧（仮想背面, δ=地表面勾配。水位以下は水中単位体積重量） ---
    const ep = trialWedge({
      Hp: Hp0, gamma, gammaSub: input.soil.gammaSub,
      waterLevel: useWater ? hwB : 0,
      phi: input.soil.phi, delta: deltaVbf,
      c: cCoh, kh, q, precision: input.epCondition.precision,
      rise: riseRem, slopeN,
    }, B);

    // --- 作用力行 ---
    const rows = [];
    const pushV = (name, V, x) => rows.push({ name, V, Vx: V * x, H: 0, Hy: 0 });
    pushV('躯体自重', self.V, self.XG);
    for (const p of soil) pushV(p.name, p.V, p.x);
    const sur = cd.surcharge ? surchargePart(geom, input.surcharge.q, L) : null;
    if (sur) pushV(sur.name, sur.V, sur.x);
    if (kh > 0) {
      rows.push({ name: '躯体慣性力', V: 0, Vx: 0, H: kh * self.V, Hy: kh * self.V * self.YG });
      if (soilV > 0) rows.push({ name: '背面土砂慣性力', V: 0, Vx: 0, H: kh * soilV, Hy: kh * soilVy });
    }
    if (cd.collision && col) {
      rows.push({ name: col.name, V: 0, Vx: 0, H: col.H, Hy: col.Hy });
    }
    if (useWater && up) {
      rows.push({ name: '揚圧力', V: up.UP, Vx: up.UP * up.XG, H: 0, Hy: 0 });
    }
    rows.push({
      name: '土圧',
      V: input.epCondition.considerPv ? ep.PAV : 0,
      Vx: input.epCondition.considerPv ? ep.MV : 0,
      H: ep.PAH, Hy: ep.MH,
    });
    if (useWater && (wpBack || wpFront)) {
      let PW = 0, PWY = 0;
      if (wpBack) { PW += wpBack.PW; PWY += wpBack.PWYG; }
      if (wpFront) { PW += wpFront.PW; PWY += wpFront.PWYG; }
      rows.push({ name: '水圧', V: 0, Vx: 0, H: PW, Hy: PWY });
    }

    const sum = aggregate(rows, B);
    const reaction = groundReaction(B, L, sum.e, sum.V, sum.M);
    const overturn = checkOverturn(sum.e, B, cd.cond.n);
    const sliding = checkSliding(sum.V, sum.H, sum.e, B, L, input.stability.mu, input.stability.cB, cd.cond.Fs);
    const bearing = checkBearing(reaction.q1, reaction.q2, cd.cond.qa);

    // --- 部材計算 ---
    let member = null;
    if (input.member.calc) {
      // 衝突時は地震時と同じ割増係数を用いる
      const f = cd.seismic || cd.collision ? input.material.kSeismic : input.material.kNormal;
      const mat = input.material;

      // たて壁: 付け根断面。壁背面土圧(高さh, δ=2/3φ)＋たて壁慣性力＋背面水圧
      const deltaStem = input.soil.deltaStem * input.soil.phi;
      const hwStem = useWater ? Math.min(Math.max(hwB - geom.t3, 0), h) : 0; // たて壁付け根からの背面水位
      const eps = trialWedge({
        Hp: h, gamma, gammaSub: input.soil.gammaSub, waterLevel: hwStem,
        phi: input.soil.phi, delta: deltaStem,
        c: cCoh, kh, q, precision: input.epCondition.precision,
        rise: raised ? raise : 0, slopeN,
      }, xb);
      let Ms = eps.PAH * h / 3, Ss = eps.PAH;
      if (hwStem > 0) {
        const PWs = 0.5 * gammaW * hwStem * hwStem;   // たて壁背面の静水圧
        Ms += PWs * hwStem / 3;
        Ss += PWs;
      }
      // たて壁自重を分解して慣性力モーメントを算定（付け根 y=t3 まわり）
      const stem = stemParts(geom, gammaC, L);
      if (kh > 0) {
        for (const p of stem) { Ms += kh * p.V * (p.y - geom.t3); Ss += kh * p.V; }
      }
      // 衝突荷重（たて壁に作用。付け根より上に作用する場合のみ断面力に算入）
      if (cd.collision && col && col.h > geom.t3) {
        Ms += col.H * (col.h - geom.t3);
        Ss += col.H;
      }
      const stemAs = rebarAs(input.member.stem.bar, input.member.stem.pitch);
      const mStem = memberCheck({ M: Ms, S: Ss, t: geom.t2, cover: input.member.stem.cover, As: stemAs, mat, f });

      // つま先版: 地盤反力＋揚圧力(上向き) − 底版自重(下向き)。付け根(x=B1)まわり
      const upCase = useWater ? up : null;
      let Mt = 0, St = 0;
      if (geom.B1 > 1e-9) {
        const n = 400;
        for (let i = 0; i < n; i++) {
          const x = (i + 0.5) * geom.B1 / n, dx = geom.B1 / n;
          const w = reactionAt(reaction, x) + upliftAt(upCase, x) - gammaC * geom.t3;
          Mt += w * (geom.B1 - x) * dx; St += w * dx;
        }
      }
      const toeAs = rebarAs(input.member.toe.bar, input.member.toe.pitch);
      const mToe = memberCheck({ M: Mt, S: St, t: geom.t3, cover: input.member.toe.cover, As: toeAs, mat, f });

      // かかと版: 背面土＋活荷重＋底版自重(下向き) − 地盤反力(上向き)。付け根(x=xb)まわり
      let Mh = 0, Sh = 0;
      if (geom.B3 > 1e-9) {
        const n = 400;
        for (let i = 0; i < n; i++) {
          const x = xb + (i + 0.5) * geom.B3 / n, dx = geom.B3 / n;
          const over = raised ? Math.min((x - xb) / slopeN, raise) : 0; // 嵩上げ盛土の上載高
          const soilCol = gamma * (h + over);
          const w = soilCol + q + gammaC * geom.t3 - reactionAt(reaction, x) - upliftAt(upCase, x);
          Mh += w * (x - xb) * dx; Sh += w * dx;
        }
      }
      const heelAs = rebarAs(input.member.heel.bar, input.member.heel.pitch);
      const mHeel = memberCheck({ M: Mh, S: Sh, t: geom.t3, cover: input.member.heel.cover, As: heelAs, mat, f });

      member = {
        f,
        stem: { ...mStem, ep: eps, deltaStem, bar: input.member.stem.bar, pitch: input.member.stem.pitch, t: geom.t2 },
        toe: { ...mToe, bar: input.member.toe.bar, pitch: input.member.toe.pitch, t: geom.t3, len: geom.B1 },
        heel: { ...mHeel, bar: input.member.heel.bar, pitch: input.member.heel.pitch, t: geom.t3, len: geom.B3 },
        ok: mStem.ok && (geom.B1 <= 1e-9 || mToe.ok) && (geom.B3 <= 1e-9 || mHeel.ok),
      };
    }

    return { ...cd, kh, q, ep, rows, sum, reaction, overturn, sliding, bearing, member };
  });

  return {
    input, dims: { h, xb, B }, Hp: Hp0, gammaC,
    self, soil, soilV, soilVy, collision: col,
    water: { on: waterOn, upliftOn, front: hwF, back: hwB, up, wpBack, wpFront },
    backfill: { raise, slopeN, raised, beta, riseRem, deltaVbf },
    cases,
  };
}

// たて壁の自重分解（矩形部＋テーパー部）
function stemParts(geom, gammaC, L) {
  const h = geom.H - geom.t3;
  const xb = geom.B1 + geom.t2;
  const parts = [];
  // 矩形部（背面側 t1×h）
  parts.push({ name: 'たて壁(矩形部)', V: gammaC * geom.t1 * h * L, x: xb - geom.t1 / 2, y: geom.t3 + h / 2 });
  // テーパー部（前面側）
  if (geom.t2 > geom.t1 + 1e-9) {
    parts.push({ name: 'たて壁(テーパー部)', V: gammaC * 0.5 * (geom.t2 - geom.t1) * h * L, x: geom.B1 + 2 * (geom.t2 - geom.t1) / 3, y: geom.t3 + h / 3 });
  }
  return parts;
}
