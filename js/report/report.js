// 計算結果 → A4帳票（L型擁壁の設計計算書）
import { fmt3, fmt2, fmt1, table, kvTable, bullets, formula, legend, frac, judge, para, subTitle, esc } from './blocks.js';
import { sectionFig, overallFig, wedgeMethodFig, caseEpFig, omegaPaGraph, reactionFig, rebarSecFig, upliftFig } from './figures.js';

class Builder {
  constructor() { this.blocks = []; this.c = [0, 0, 0, 0]; }
  add(html, opts = {}) { this.blocks.push({ html, ...opts }); }
  chapter(title) {
    this.c[0]++; this.c[1] = this.c[2] = this.c[3] = 0;
    const label = `第${this.c[0]}章 ${title}`;
    this.add(`<h1 class="rpt-h1">${label}</h1>`, { breakBefore: true, keepNext: true, toc: { level: 0, label } });
  }
  sec(title, extra = {}) {
    this.c[1]++; this.c[2] = this.c[3] = 0;
    const label = `${this.c[0]}.${this.c[1]} ${title}`;
    this.add(`<h2 class="rpt-h2">${label}</h2>`, { keepNext: true, toc: { level: 1, label }, ...extra });
  }
  sub(title, extra = {}) {
    this.c[2]++; this.c[3] = 0;
    const label = `${this.c[0]}.${this.c[1]}.${this.c[2]} ${title}`;
    this.add(`<h3 class="rpt-h3">${label}</h3>`, { keepNext: true, toc: { level: 2, label }, ...extra });
  }
}

const arm = (num, den) => (Math.abs(den) < 1e-9 ? 0 : num / den);

export function buildBlocks(r) {
  const b = new Builder();
  const inp = r.input;
  const geom = inp.geometry;
  const seismic = inp.seismic.enabled && inp.seismic.kh > 0;
  const collisionOn = !!inp.collision?.enabled;
  const waterOn = r.water.on;
  const upliftOn = r.water.upliftOn;
  const mem = inp.member.calc;
  const B = r.dims.B;
  const bf = r.backfill;
  const xmin = inp.soil.phi;

  // ================= 第1章 設計条件 =================
  b.chapter('設計条件');
  b.add(para(`　標題　　 : ${esc(inp.title)}`));

  b.sec('形状寸法');
  b.sub('断面形状');
  b.add(bullets([['構造形式', inp.structure], ['基礎形式', inp.foundation], ['擁壁の種類', inp.wallKind]]));
  b.add(`<div class="rpt-figwrap">${sectionFig(geom)}</div>`);
  {
    const grows = [
      ['擁壁全高', 'H', fmt3(geom.H)],
      ['たて壁 天端厚', 't1', fmt3(geom.t1)],
      ['たて壁 付け根厚', 't2', fmt3(geom.t2)],
      ['つま先版長', 'B1', fmt3(geom.B1)],
      ['かかと版長', 'B3', fmt3(geom.B3)],
      ['底版厚', 't3', fmt3(geom.t3)],
      ['底版幅', 'B', fmt3(B)],
    ];
    const hc = geom.haunch;
    if (hc && hc.width > 1e-9 && hc.height > 1e-9) {
      grows.push(['隅角部ハンチ 高さ', 'Hv', fmt3(hc.height)]);
      grows.push(['隅角部ハンチ 幅', 'Wh', fmt3(hc.width)]);
    }
    b.add(table([['項目名', '記号', '寸法(m)']], grows));
  }
  b.add(bullets([
    ['鉄筋コンクリートの単位体積重量', `${fmt3(inp.concrete.gammaC)} (kN/m3)`],
    ['躯体延長', `${fmt3(inp.lengths.body)} (m)`],
    ['底版延長', `${fmt3(inp.lengths.base)} (m)`],
  ]));

  b.sub('全体形状');
  {
    const items = [['背面土砂形状', bf.raised ? '盛土（嵩上げ）' : bf.drop > 0 ? 'レベル（天端から落差）' : 'レベル']];
    if (bf.raised) {
      items.push(['嵩上げ高さ', `${fmt3(bf.raise)} (m)`]);
      items.push(['法面勾配', `1:${fmt2(bf.slopeN)}　（法面傾斜角 β = ${fmt3(bf.beta)} 度）`]);
    }
    if (bf.drop > 0) items.push(['擁壁天端からの落差高さ', `${fmt3(bf.drop)} (m)`]);
    items.push(['根入れ深さ Df', `${fmt3(geom.Df)} (m)`]);
    items.push(['仮想背面高さ H′', `${fmt3(r.Hp)} (m)`]);
    items.push(['水位の有無', waterOn ? '有り' : '無し']);
    if (waterOn) {
      items.push(['前面水位（底版下面から）', `${fmt3(r.water.front)} (m)`]);
      items.push(['背面水位（底版下面から）', `${fmt3(r.water.back)} (m)`]);
      items.push(['揚圧力', upliftOn ? '考慮する' : '考慮しない']);
    }
    b.add(bullets(items));
  }
  b.add(`<div class="rpt-figwrap">${overallFig(geom, { raise: bf.raise, slopeN: bf.slopeN, Df: geom.Df, Hp: r.Hp, wFront: waterOn ? r.water.front : 0, wBack: waterOn ? r.water.back : 0 })}</div>`);

  b.sec('準拠指針');
  b.add(para(`　　${esc(inp.guideline)}`));

  b.sec('土砂条件');
  {
    const rows = [
      ['裏込め土 湿潤単位体積重量', 'γ', fmt3(inp.soil.gamma), 'kN/m3'],
    ];
    if (waterOn) {
      rows.push(['裏込め土 水中単位体積重量', "γ'", fmt3(inp.soil.gammaSub), 'kN/m3']);
      rows.push(['水の単位体積重量', 'γw', fmt3(inp.soil.gammaW), 'kN/m3']);
    }
    rows.push(
      ['せん断抵抗角', 'φ', fmt3(inp.soil.phi), '度'],
      ['粘着力 (常　時)', 'c', fmt3(inp.soil.c), 'kN/m2'],
    );
    if (seismic) rows.push(['粘着力 (地震時)', 'cE', fmt3(inp.soil.cE), 'kN/m2']);
    rows.push(['壁面摩擦角（仮想背面）', 'δ', 'β（地表面勾配）', '度']);
    if (mem) rows.push(['壁面摩擦角（たて壁計算用）', 'δm', `${fmt3(inp.soil.deltaStem)}×φ`, '度']);
    b.add(table([['項目名', '記号', '設定値', '単位']], rows));
  }

  b.sec('計算条件');
  b.sub('検討条件');
  b.add(table([['検討項目', '設定']], [
    ['活荷重', inp.surcharge.enabled ? '考慮する' : '考慮しない'],
    ['地震時照査', seismic ? '行う' : '行わない'],
    ['衝突荷重', collisionOn ? '考慮する' : '考慮しない'],
    ['水位', waterOn ? '考慮する' : '考慮しない'],
    ['揚圧力', !waterOn ? '-（水位無し）' : upliftOn ? '考慮する' : '考慮しない'],
  ]));
  if (seismic) { b.sub('設計水平震度'); b.add(table([['', 'kh']], [[inp.seismic.levelName, fmt2(inp.seismic.kh)]])); }
  b.sub('主働土圧条件');
  b.add(bullets([
    ['主働土圧計算方法', inp.epCondition.method],
    ['試行くさびの収束精度', `${inp.epCondition.precision}度`],
    ['安定モーメントの土圧鉛直成分(Pv)', inp.epCondition.considerPv ? '考慮する' : '考慮しない'],
  ]));

  if (inp.surcharge.enabled || collisionOn) {
    b.sec('荷重条件');
    if (inp.surcharge.enabled) {
      b.sub('上載荷重（活荷重）');
      b.add(table([['荷重名称', '荷重強度 q<br>(kN/m2)', '載荷範囲']], [[esc(inp.surcharge.name), fmt3(inp.surcharge.q), 'かかと版上（全面）']]));
    }
    if (collisionOn) {
      b.sub('衝突荷重');
      b.add(para('　　衝突荷重は擁壁に水平（土圧と同方向）に作用する荷重として、「衝突時」ケースで考慮します。'));
      b.add(table(
        [['荷重名称', '荷重強度 P<br>(kN/m)', '作用高さ h<br>(m)', '作用方向']],
        [[esc(inp.collision.name), fmt3(inp.collision.P), fmt3(inp.collision.h), '前面側（土圧と同方向）']],
      ));
    }
  }

  b.sec('安定計算条件');
  b.add(bullets([
    ['転倒の照査方法', `${inp.stability.overturnMethod}（許容偏心量 B/n）`],
    ['滑動抵抗', 'Hu = ΣV・μ + cB・Be'],
  ]));
  {
    const sC = inp.stability.collision || inp.stability.seismic;
    const head = ['項目名', '記号', '常時', '地震時'];
    if (collisionOn) head.push('衝突時');
    head.push('単位');
    const rows = [
      ['摩擦係数', 'μ', fmt3(inp.stability.mu), fmt3(inp.stability.mu), ...(collisionOn ? [fmt3(inp.stability.mu)] : []), '-'],
      ['付着力', 'cB', fmt3(inp.stability.cB), fmt3(inp.stability.cB), ...(collisionOn ? [fmt3(inp.stability.cB)] : []), 'kN/m2'],
      ['許容偏心量 B/n の n', 'n', fmt2(inp.stability.normal.n), fmt2(inp.stability.seismic.n), ...(collisionOn ? [fmt2(sC.n)] : []), '-'],
      ['滑動安全率', 'Fs', fmt2(inp.stability.normal.Fs), fmt2(inp.stability.seismic.Fs), ...(collisionOn ? [fmt2(sC.Fs)] : []), '-'],
      ['許容支持力度', 'qa', fmt2(inp.stability.normal.qa), fmt2(inp.stability.seismic.qa), ...(collisionOn ? [fmt2(sC.qa)] : []), 'kN/m2'],
    ];
    b.add(table([head], rows));
  }

  if (mem) {
    b.sec('部材計算条件');
    b.sub('材料特性値');
    b.add(table([['項目', '記号', '基準値', '単位']], [
      ['設計基準強度', 'σck', String(inp.material.sigmaCk), 'N/mm2'],
      ['許容曲げ圧縮応力度', 'σca', fmt3(inp.material.sigmaCa), 'N/mm2'],
      ['許容せん断応力度', 'τa1', fmt3(inp.material.tauA), 'N/mm2'],
      [`鉄筋許容引張応力度 (${inp.material.rebarKind})`, 'σsa', fmt2(inp.material.sigmaSa), 'N/mm2'],
    ]));
    b.add(bullets([['許容応力度の割増係数', `常時 ${fmt2(inp.material.kNormal)}／地震時 ${fmt2(inp.material.kSeismic)}`], ['ヤング係数比', 'n = 15']]));
    b.sub('配筋（引張側 主鉄筋）');
    b.add(table([['部材', '鉄筋径', 'ピッチ(mm)', 'かぶり(mm)']], [
      ['たて壁', inp.member.stem.bar, String(inp.member.stem.pitch), String(inp.member.stem.cover)],
      ['つま先版', inp.member.toe.bar, String(inp.member.toe.pitch), String(inp.member.toe.cover)],
      ['かかと版', inp.member.heel.bar, String(inp.member.heel.pitch), String(inp.member.heel.cover)],
    ]));
  }

  b.sec('荷重の組み合わせ');
  b.add(table(
    [['No', ...r.cases.map((c) => String(c.no))]],
    [
      ['ケース名', ...r.cases.map((c) => esc(c.name))],
      ['作用土圧', ...r.cases.map((c) => (c.seismic ? '地震時土圧' : '常時土圧'))],
      ['慣性力', ...r.cases.map((c) => (c.seismic ? '○' : '-'))],
      ['活荷重', ...r.cases.map((c) => (c.surcharge ? '○' : '-'))],
      ...(collisionOn ? [['衝突荷重', ...r.cases.map((c) => (c.collision ? '○' : '-'))]] : []),
      ...(waterOn ? [
        ['水位（浮力）', ...r.cases.map((c) => (c.water ? '考慮' : '無視'))],
        ['揚圧力', ...r.cases.map((c) => (c.water && upliftOn ? '○' : '-'))],
      ] : []),
      ['許容偏心量 B/n の n', ...r.cases.map((c) => fmt2(c.cond.n))],
      ['滑動安全率 Fs', ...r.cases.map((c) => fmt2(c.cond.Fs))],
      ['許容支持力度 qa', ...r.cases.map((c) => fmt2(c.cond.qa))],
    ],
    'combo',
  ));

  // ================= 第2章 計算結果一覧 =================
  b.chapter('計算結果一覧');
  b.sec('作用力計算結果');
  b.add(table(
    [['No', '荷重ケース名', '鉛直力 ΣV<br>(kN)', '水平力 ΣH<br>(kN)', 'モーメント M<br>(kN・m)']],
    r.cases.map((c) => [String(c.no), { t: esc(c.name), cls: 'lt' }, fmt3(c.sum.V), fmt3(c.sum.H), fmt3(c.sum.M)]),
    'result',
  ));
  b.sec('安定計算結果');
  b.sub('転倒照査');
  b.add(table(
    [['No', '荷重ケース名', '偏心距離 |e|']],
    r.cases.map((c) => [String(c.no), { t: esc(c.name), cls: 'lt' },
      `|e|=${fmt3(c.overturn.absE)} ${c.overturn.ok ? '≦' : '＞'} B/n=${fmt3(c.overturn.allow)}　<span class="${c.overturn.ok ? 'ok' : 'ng'}">${c.overturn.ok ? 'OK' : 'NG'}</span>`]),
    'result',
  ));
  b.sub('滑動照査');
  b.add(table(
    [['No', '荷重ケース名', '安全率']],
    r.cases.map((c) => {
      const s = c.sliding;
      const t = s.indeterminate ? '算定不能(水平力0以下)'
        : `Hu/H=${fmt3(s.ratio)} ${s.ok ? '≧' : '＜'} Fs=${fmt3(s.Fs)}　<span class="${s.ok ? 'ok' : 'ng'}">${s.ok ? 'OK' : 'NG'}</span>`;
      return [String(c.no), { t: esc(c.name), cls: 'lt' }, t];
    }),
    'result',
  ));
  b.sub('支持照査');
  b.add(table(
    [['No', '荷重ケース名', '地盤反力度<br>(kN/m2)']],
    r.cases.map((c) => [String(c.no), { t: esc(c.name), cls: 'lt' },
      `qmax=${fmt3(c.bearing.qmax)} ${c.bearing.ok ? '≦' : '＞'} qa=${fmt3(c.bearing.qa)}　<span class="${c.bearing.ok ? 'ok' : 'ng'}">${c.bearing.ok ? 'OK' : 'NG'}</span>`]),
    'result',
  ));
  if (mem) {
    b.sec('部材計算結果');
    for (const [key, label] of [['stem', 'たて壁'], ['toe', 'つま先版'], ['heel', 'かかと版']]) {
      const exists = r.cases.some((c) => c.member && (key === 'stem' || c.member[key].len > 1e-9));
      if (!exists) continue;
      b.sub(`${label}付け根の応力度照査`);
      b.add(table(
        [['No', '荷重ケース名', '曲げ圧縮<br>σc (N/mm2)', '鉄筋引張<br>σs (N/mm2)', 'せん断<br>τ (N/mm2)', '判定']],
        r.cases.map((c) => {
          const m = c.member[key];
          return [String(c.no), { t: esc(c.name), cls: 'lt' },
            `${m.sigmaC.toFixed(3)} ≦ ${fmt3(m.sigmaCa)}`,
            `${m.sigmaS.toFixed(1)} ≦ ${fmt2(m.sigmaSa)}`,
            `${m.tau.toFixed(3)} ≦ ${fmt3(m.tauA)}`,
            `<span class="${m.ok ? 'ok' : 'ng'}">${m.ok ? 'OK' : 'NG'}</span>`];
        }),
        'result',
      ));
    }
  }

  // ================= 第3章 作用力の算定 =================
  b.chapter('作用力の算定');
  b.sec('自重及び慣性力');
  b.add(para('　　断面積及び重心位置は、次の座標法の計算式を用います。'));
  b.add(formula(
    `<div>A　= ${frac('1', '2')}Σ(x<sub>i+1</sub>・y<sub>i</sub>−x<sub>i</sub>・y<sub>i+1</sub>)</div>` +
    `<div>XG = Gy/A,　YG = Gx/A</div>`,
  ));
  b.sub('躯体自重');
  {
    const sec = r.self.sec;
    const rows = sec.rows.map((row, i) => [String(i + 1), fmt3(row.x), fmt3(row.y), fmt3(row.dA)]);
    rows.push(['合計', '-', '-', fmt3(sec.A)]);
    b.add(table([['No', 'x<br>(m)', 'y<br>(m)', 'ΔA<br>(m2)']], rows));
    b.add(para(`　　断面積 A = ${fmt3(sec.A)} (m2)　　重心位置 XG = ${fmt3(sec.XG)} (m)　YG = ${fmt3(sec.YG)} (m)`));
    b.add(table(
      [['種類', 'A<br>(m2)', 'γc<br>(kN/m3)', 'L<br>(m)', 'V<br>(kN)', 'XG<br>(m)', 'V・XG<br>(kN・m)']],
      [['躯体', fmt3(r.self.A), fmt3(r.self.gamma), fmt3(r.self.L), fmt3(r.self.V), fmt3(r.self.XG), fmt3(r.self.VXG)]],
    ));
  }
  b.sub('背面土砂（かかと版上）');
  if (r.soil.length) {
    b.add(table(
      [['種類', 'V<br>(kN)', 'x<br>(m)', 'V・x<br>(kN・m)']],
      r.soil.map((p) => [p.name, fmt3(p.V), fmt3(p.x), fmt3(p.V * p.x)]).concat([['合計', fmt3(r.soilV), '-', fmt3(r.soil.reduce((s, p) => s + p.V * p.x, 0))]]),
    ));
  } else {
    b.add(para('　　かかと版がないため背面土砂の鉛直荷重はありません。'));
  }

  if (collisionOn && r.collision) {
    const cl = r.collision;
    b.sec('衝突荷重');
    b.add(para('　　衝突荷重は、擁壁に水平（土圧と同方向）に作用する荷重として次式より算出します。'));
    b.add(formula('<div>H ＝ P・L</div>'));
    b.add(legend([
      ['H', '衝突荷重による水平力 (kN)'], ['P', '衝突荷重の荷重強度 (kN/m)'],
      ['L', '躯体延長 (m)'], ['h', '作用高さ（底版下面から） (m)'],
    ]));
    b.add(table(
      [['荷重名称', 'P<br>(kN/m)', 'L<br>(m)', 'H<br>(kN)', 'h<br>(m)', 'H・h<br>(kN・m)']],
      [[esc(cl.name), fmt3(cl.P), fmt3(cl.L), fmt3(cl.H), fmt3(cl.h), fmt3(cl.Hy)]],
    ));
  }

  if (waterOn && upliftOn && r.water.up) {
    const up = r.water.up;
    b.sec('揚圧力');
    b.add(para('　揚圧力は底版下面に台形分布で作用するものとし、次の計算式を用います。'));
    b.add(formula(
      '<div>uP1＝ − γw・HW1　　　　uP2＝ − γw・HW2</div>' +
      `<div>UP ＝ ${frac('uP1 + uP2', '2')}・B・L</div>` +
      `<div>XG ＝ ${frac('B(uP1 + 2uP2)', '3(uP1 + uP2)')}</div>`,
    ));
    b.add(legend([
      ['UP', '揚圧力 (kN)'], ['XG', '揚圧力の重心位置（つま先端から） (m)'],
      ['uP1', '底版前面端の揚圧力強度 (kN/m2)'], ['uP2', '底版背面端の揚圧力強度 (kN/m2)'],
      ['HW1', '底版下面から前面水位までの高さ (m)'], ['HW2', '底版下面から背面水位までの高さ (m)'],
      ['B', '底版幅 (m)'], ['L', '底版延長 (m)'], ['γw', '水の単位体積重量 (kN/m3)'],
    ]));
    b.add(`<div class="rpt-figwrap">${upliftFig(up)}</div>`);
    b.add(table(
      [['項目', 'uP1<br>(kN/m2)', 'uP2<br>(kN/m2)', 'B<br>(m)', 'L<br>(m)', 'UP<br>(kN)', 'XG<br>(m)', 'UP・XG<br>(kN・m)']],
      [['揚圧力', fmt3(up.uP1), fmt3(up.uP2), fmt3(up.B), fmt3(up.L), fmt3(up.UP), fmt3(up.XG), fmt3(up.UPXG)]],
    ));
  }

  if (waterOn && (r.water.wpBack || r.water.wpFront)) {
    b.sec('水圧');
    b.add(para('　静水圧 PW = 1/2・γw・Hw²・L を作用高さ Hw/3 に作用させます（背面: 土圧と同方向、前面: 抵抗側）。'));
    const rows = [];
    if (r.water.wpBack) rows.push(['背面水圧', fmt3(r.water.wpBack.Hw), fmt3(r.water.wpBack.pw), fmt3(r.water.wpBack.PW), fmt3(r.water.wpBack.YG), fmt3(r.water.wpBack.PWYG)]);
    if (r.water.wpFront) rows.push(['前面水圧', fmt3(r.water.wpFront.Hw), fmt3(r.water.wpFront.pw), fmt3(r.water.wpFront.PW), fmt3(r.water.wpFront.YG), fmt3(r.water.wpFront.PWYG)]);
    b.add(table([['種類', 'Hw<br>(m)', 'pw<br>(kN/m2)', 'PW<br>(kN)', 'YG<br>(m)', 'PW・YG<br>(kN・m)']], rows));
    b.add(para('　　注）背面水位以下の土圧算定には水中単位体積重量 γ′ を用います。', 'note'));
  }

  b.sec('土圧');
  b.sub('計算方法');
  b.add(para('　　仮想背面（かかと版末端を通る鉛直面）に作用する主働土圧を試行くさび法で求めます。地表面は嵩上げ盛土（勾配1:n→レベル）の折れ線に対応し、壁面摩擦角 δ は仮想背面位置の地表面勾配とします。'));
  b.add(`<div class="rpt-figwrap">${wedgeMethodFig(false)}</div>`);
  b.add(formula(
    '<div>W　＝ γ・A + q・T</div>' +
    `<div>PA　＝ ${frac('W・sin(ω−φ) − c・l・cosφ', 'cos(ω−φ−δ)')}</div>` +
    '<div class="fnote">土圧の鉛直・水平成分　PAV ＝ PA・sinδ　　PAH ＝ PA・cosδ</div>',
  ));
  b.add(legend([
    ['PA', '主働土圧合力 (kN/m)'], ['ω', 'すべり面と水平面のなす角 (度)'],
    ['W', 'すべり面より上の土砂重量＋上載荷重 (kN/m)'], ['A', 'くさび土砂面積 (m2)'],
    ['T', 'くさびの水平幅 (m)'], ['q', '上載荷重 (kN/m2)'], ['l', 'すべり面長さ (m)'],
    ['φ', 'せん断抵抗角 (度)'], ['δ', '壁面摩擦角（仮想背面位置の地表面勾配） (度)'], ['β', '法面傾斜角 β=tan⁻¹(1/n) (度)'], ['c', '粘着力 (kN/m2)'],
  ]));
  if (seismic) {
    b.add(para('　　・地震時（慣性力を考慮）'));
    b.add(formula(`<div>PEA ＝ ${frac('W・{sin(ω−φ)+kh・cos(ω−φ)} − cE・l・cosφ', 'cos(ω−φ−δ)')}　　（θ=tan⁻¹kh の物部・岡部式と等価）</div>`));
  }
  b.sub('土圧の計算');
  r.cases.forEach((c, i) => {
    b.add(para(`(${i + 1}) ${esc(c.name)}`, 'case-head'), { keepNext: true });
    b.add(`<div class="rpt-figwrap">${caseEpFig(geom, c.ep, { surcharge: c.surcharge, raise: bf.raise, slopeN: bf.slopeN, waterBack: c.water ? r.water.back : 0 })}</div>`);
    b.add(table(
      [['H′<br>(m)', 'ω<br>(度)', 'W<br>(kN/m)', 'PA<br>(kN/m)', 'PAV<br>(kN/m)', 'PAH<br>(kN/m)', '作用高 Y<br>(m)']],
      [[fmt3(c.ep.Hp), fmt3(c.ep.omega), fmt3(c.ep.W), fmt3(c.ep.PA), fmt3(c.ep.PAV), fmt3(c.ep.PAH), fmt3(c.ep.Y)]],
    ));
    b.add(`<div class="rpt-figwrap">${omegaPaGraph(c.ep.curve, xmin)}</div>`);
  });

  b.sec('作用力の集計');
  b.add(para('　　偏心量　e = B/2 −(ΣV・x − ΣH・y)/ΣV,　　M = ΣV・e（つま先版前面まわり）'));
  r.cases.forEach((c) => {
    b.add(para(`(${c.no}) ${esc(c.name)}`, 'case-head'), { keepNext: true });
    const rows = c.rows.map((row) => [row.name, fmt3(row.V), row.V ? fmt3(arm(row.Vx, row.V)) : '-', fmt3(row.Vx), fmt3(row.H), row.H ? fmt3(arm(row.Hy, row.H)) : '-', fmt3(row.Hy)]);
    rows.push([{ t: '合計', cls: 'lt' }, fmt3(c.sum.V), '-', fmt3(c.sum.Vx), fmt3(c.sum.H), '-', fmt3(c.sum.Hy)]);
    b.add(table([['作用力', 'V<br>(kN)', 'x<br>(m)', 'V・x<br>(kN・m)', 'H<br>(kN)', 'y<br>(m)', 'H・y<br>(kN・m)']], rows));
    b.add(para(`　　e = ${fmt3(c.sum.e)} (m)　　M = ${fmt3(c.sum.M)} (kN・m)`));
  });

  b.sec('地盤反力度');
  b.add(para('　　台形分布：q1,q2 = ΣV/(B・L) ± 6M/(B²・L)　／　三角形分布：q = 2ΣV/(B′・L), B′=3(B/2−|e|)'));
  r.cases.forEach((c) => {
    b.add(para(`(${c.no}) ${esc(c.name)}　（${c.reaction.type}分布）`, 'case-head'), { keepNext: true });
    b.add(`<div class="rpt-figwrap">${reactionFig(c.reaction, c.sum)}</div>`);
    b.add(table(
      [['分布形', 'q1 つま先側<br>(kN/m2)', 'q2 かかと側<br>(kN/m2)', 'qmax<br>(kN/m2)']],
      [[c.reaction.type, fmt3(c.reaction.q1), fmt3(c.reaction.q2), fmt3(c.bearing.qmax)]],
    ));
  });

  // ================= 第4章 安定計算 =================
  b.chapter('安定計算');
  r.cases.forEach((c) => {
    b.sec(`ケースNo.${c.no}　${esc(c.name)}`, { breakBefore: true });
    // 転倒
    b.add(para('(1) 転倒に対する照査'), { keepNext: true });
    b.add(para(`　　偏心量 |e| = ${fmt3(c.overturn.absE)} (m)　　許容偏心量 B/n = ${fmt3(B)}/${fmt2(c.cond.n)} = ${fmt3(c.overturn.allow)} (m)`));
    b.add(judge(`　　|e| = ${fmt3(c.overturn.absE)} ${c.overturn.ok ? '≦' : '＞'} B/n = ${fmt3(c.overturn.allow)}`, c.overturn.ok));
    // 滑動
    b.add(para('(2) 滑動に対する照査'), { keepNext: true });
    const s = c.sliding;
    b.add(para(`　　滑動抵抗力 Hu = ΣV・μ + cB・Be = ${fmt3(s.V)}×${fmt3(s.mu)} + ${fmt3(s.cB)}×${fmt3(s.Be)} = ${fmt3(s.Hu)} (kN)`));
    if (s.indeterminate) b.add(judge('　　水平力 ΣH ≦ 0 のため滑動照査は算定不能（安全側）', true));
    else {
      b.add(para(`　　安全率 Fs = Hu/ΣH = ${fmt3(s.Hu)}/${fmt3(s.H)} = ${fmt3(s.ratio)}`));
      b.add(judge(`　　Fs = ${fmt3(s.ratio)} ${s.ok ? '≧' : '＜'} 必要Fs = ${fmt3(s.Fs)}`, s.ok));
    }
    // 支持
    b.add(para('(3) 支持に対する照査'), { keepNext: true });
    b.add(para(`　　最大地盤反力度 qmax = ${fmt3(c.bearing.qmax)} (kN/m2)　　許容支持力度 qa = ${fmt3(c.bearing.qa)} (kN/m2)`));
    b.add(judge(`　　qmax = ${fmt3(c.bearing.qmax)} ${c.bearing.ok ? '≦' : '＞'} qa = ${fmt3(c.bearing.qa)}`, c.bearing.ok));
  });

  // ================= 第5章 部材計算 =================
  if (mem) {
    b.chapter('部材計算');
    b.sec('照査方法');
    b.add(para('　　単鉄筋長方形断面（b=1000mm、ヤング係数比 n=15）として許容応力度法で照査します。'));
    b.add(formula(
      `<div>p = As/(b・d),　k = √(2np+(np)²)−np,　j = 1−k/3</div>` +
      `<div>σc = ${frac('2M', 'k・j・b・d²')},　σs = ${frac('M', 'As・j・d')},　τ = ${frac('S', 'b・j・d')}</div>`,
    ));
    b.add(legend([
      ['M', '曲げモーメント (kN・m/m)'], ['S', 'せん断力 (kN/m)'], ['d', '有効高 (mm)'],
      ['As', '引張鉄筋量 (mm2/m)'], ['σc', 'コンクリート圧縮応力度'], ['σs', '鉄筋引張応力度'], ['τ', '平均せん断応力度'],
    ]));
    if (geom.haunch && geom.haunch.width > 1e-9 && geom.haunch.height > 1e-9) {
      b.add(para(`　　注）隅角部ハンチ（${fmt3(geom.haunch.height)}×${fmt3(geom.haunch.width)} m）は自重（安定計算）に算入していますが、部材照査の断面は安全側にハンチを無視した公称断面（たて壁 t2、底版 t3）としています。`, 'note'));
    }
    b.sec('たて壁設計用土圧');
    b.add(para(`　　たて壁の断面力算定用の主働土圧は、たて壁背面（付け根から高さ Hm）に作用する土圧として、壁面摩擦角 δm = ${fmt3(inp.soil.deltaStem)}×φ = ${fmt3(inp.soil.deltaStem * inp.soil.phi)} 度 の試行くさび法により各ケースで別途算定します（安定計算用の仮想背面土圧とは区別します）。算定結果は各ケースの照査に示します。`));
    const memList = [['stem', 'たて壁'], ['toe', 'つま先版'], ['heel', 'かかと版']];
    r.cases.forEach((c) => {
      b.sec(`ケースNo.${c.no}　${esc(c.name)}`, { breakBefore: true });
      for (const [key, label] of memList) {
        const m = c.member[key];
        if (key !== 'stem' && m.len <= 1e-9) { b.add(para(`(${label}) 部材なし（長さ0）のため省略`)); continue; }
        b.add(para(`(${label})　${m.bar}@${m.pitch}`, 'case-head'), { keepNext: true });
        if (key === 'stem') {
          // 設計用土圧の算定（図・表・ω-PA曲線）
          b.add(para('　　・設計用土圧（試行くさび法、たて壁背面）'), { keepNext: true });
          b.add(`<div class="rpt-figwrap">${caseEpFig(geom, m.ep, {
            surcharge: c.surcharge, raise: bf.raise, slopeN: bf.slopeN,
            waterBack: c.water ? r.water.back : 0,
            planeX: r.dims.xb, planeY0: geom.t3,
          })}</div>`);
          b.add(table(
            [['Hm<br>(m)', 'δm<br>(度)', 'ω<br>(度)', 'W<br>(kN/m)', 'PA<br>(kN/m)', 'PAV<br>(kN/m)', 'PAH<br>(kN/m)', '作用高 Y<br>(m)']],
            [[fmt3(m.hStem), fmt3(m.deltaStem), fmt3(m.ep.omega), fmt3(m.ep.W), fmt3(m.ep.PA), fmt3(m.ep.PAV), fmt3(m.ep.PAH), fmt3(m.ep.Y)]],
          ));
          b.add(`<div class="rpt-figwrap">${omegaPaGraph(m.ep.curve, xmin)}</div>`);
          // 断面力の内訳（付け根まわり）
          b.add(para('　　・断面力（付け根まわり）'), { keepNext: true });
          const compRows = m.comps.map((cp) => [cp.name, fmt3(cp.S), fmt3(cp.y), fmt3(cp.S * cp.y)]);
          compRows.push([{ t: '合計', cls: 'lt' }, fmt3(m.S), '-', fmt3(m.M)]);
          b.add(table([['作用力', 'S<br>(kN/m)', 'アーム y<br>(m)', 'M = S・y<br>(kN・m/m)']], compRows));
        } else {
          b.add(para(`　　・断面力は${key === 'toe' ? '地盤反力＋揚圧力（上向き）と底版自重（下向き）' : '背面土砂・上載荷重・底版自重（下向き）と地盤反力＋揚圧力（上向き）'}の差引き分布荷重を付け根まわりに積分して算定します。`, 'note'));
        }
        b.add(`<div class="rpt-figwrap">${rebarSecFig(m, label)}</div>`);
        b.add(table(
          [['M<br>(kN・m/m)', 'S<br>(kN/m)', 'd<br>(mm)', 'As<br>(mm2/m)', 'k', 'j']],
          [[fmt3(m.M), fmt3(m.S), fmt1(m.d), fmt1(m.As), m.k.toFixed(4), m.j.toFixed(4)]],
        ));
        b.add(table(
          [['項目', '応力度', '許容値', '判定']],
          [
            ['曲げ圧縮 σc', `${m.sigmaC.toFixed(3)}`, `${fmt3(m.sigmaCa)}`, `<span class="${m.okC ? 'ok' : 'ng'}">${m.okC ? 'OK' : 'NG'}</span>`],
            ['鉄筋引張 σs', `${m.sigmaS.toFixed(2)}`, `${fmt2(m.sigmaSa)}`, `<span class="${m.okS ? 'ok' : 'ng'}">${m.okS ? 'OK' : 'NG'}</span>`],
            ['せん断 τ', `${m.tau.toFixed(3)}`, `${fmt3(m.tauA)}`, `<span class="${m.okTau ? 'ok' : 'ng'}">${m.okTau ? 'OK' : 'NG'}</span>`],
          ],
        ));
      }
    });
  }

  return b.blocks;
}

// ============================================================
// ページ組み: ブロックを A4 ページへ流し込み → 目次生成
const PAGE_W_MM = 210, PAGE_H_MM = 297;
const MARGIN_X_MM = 17, MARGIN_TOP_MM = 14, MARGIN_BOTTOM_MM = 16, HEADER_MM = 8;
const CONTENT_W_MM = PAGE_W_MM - 2 * MARGIN_X_MM;
const CONTENT_H_MM = PAGE_H_MM - MARGIN_TOP_MM - MARGIN_BOTTOM_MM - HEADER_MM;

export function renderReport(result, mount) {
  const blocks = buildBlocks(result);

  const meas = document.createElement('div');
  meas.className = 'rpt-measure';
  meas.style.cssText = `position:absolute;visibility:hidden;left:-9999px;top:0;width:${CONTENT_W_MM}mm;`;
  document.body.appendChild(meas);
  const els = blocks.map((blk) => {
    const el = document.createElement('div');
    el.className = 'rpt-block';
    el.innerHTML = blk.html;
    meas.appendChild(el);
    return el;
  });
  const pxPerMm = meas.getBoundingClientRect().width / CONTENT_W_MM;
  const maxH = CONTENT_H_MM * pxPerMm;
  const heights = els.map((el) => el.getBoundingClientRect().height);
  document.body.removeChild(meas);

  const groups = [];
  for (let i = 0; i < blocks.length;) {
    const g = { idx: [i], breakBefore: !!blocks[i].breakBefore };
    while (blocks[g.idx[g.idx.length - 1]].keepNext && g.idx[g.idx.length - 1] + 1 < blocks.length) {
      g.idx.push(g.idx[g.idx.length - 1] + 1);
    }
    i = g.idx[g.idx.length - 1] + 1;
    groups.push(g);
  }

  const pages = [];
  let cur = null, curH = 0;
  const newPage = () => { cur = { items: [] }; curH = 0; pages.push(cur); };
  newPage();
  for (const g of groups) {
    const gH = g.idx.reduce((s, i2) => s + heights[i2], 0);
    if ((g.breakBefore && cur.items.length > 0) || (curH + gH > maxH && cur.items.length > 0)) newPage();
    for (const i2 of g.idx) {
      if (curH + heights[i2] > maxH && cur.items.length > 0) newPage();
      cur.items.push(i2);
      curH += heights[i2];
    }
  }

  const tocEntries = [];
  pages.forEach((pg, p) => {
    for (const i2 of pg.items) if (blocks[i2].toc) tocEntries.push({ ...blocks[i2].toc, page: p + 1 });
  });

  const tocLines = tocEntries.map((t) =>
    `<div class="toc-line lv${t.level}"><span class="toc-t">${t.label}</span><span class="toc-dots">${'・'.repeat(80)}</span><span class="toc-p">${t.page}</span></div>`);
  const TOC_PER_PAGE = 44;
  const tocPages = [];
  for (let i = 0; i < tocLines.length; i += TOC_PER_PAGE) {
    tocPages.push((i === 0 ? '<div class="toc-title">目　次</div>' : '') + tocLines.slice(i, i + TOC_PER_PAGE).join(''));
  }

  mount.innerHTML = '';
  const mkPage = (bodyHtml, pageNo) => {
    const pg = document.createElement('div');
    pg.className = 'rpt-page';
    pg.innerHTML = `<div class="rpt-pgbody">${bodyHtml}</div><div class="rpt-pgfoot">${pageNo == null ? '' : pageNo}</div>`;
    return pg;
  };
  tocPages.forEach((html) => mount.appendChild(mkPage(html, null)));
  pages.forEach((pg, p) => {
    const html = pg.items.map((i2) => `<div class="rpt-block">${blocks[i2].html}</div>`).join('');
    mount.appendChild(mkPage(html, p + 1));
  });
  return { pageCount: pages.length + tocPages.length };
}
