// 入力データモデル・デフォルト値・荷重ケース生成（L型擁壁）

export function defaultInput() {
  return {
    title: 'L型擁壁 H=3.0m 標準設計',
    structure: 'L型擁壁（片持ばり式）',
    foundation: '直接基礎',
    wallKind: '盛土部擁壁',
    guideline: '道路土工 擁壁工指針  平成24年 7月  公益社団法人 日本道路協会',
    geometry: {
      H: 3.00,    // 全高 (m)
      t1: 0.30,   // たて壁 天端厚 (m)
      t2: 0.50,   // たて壁 付け根厚 (m)
      B1: 0.50,   // つま先版長 (m)
      B3: 2.00,   // かかと版長 (m)
      t3: 0.50,   // 底版厚 (m)
      Df: 0.50,   // 根入れ深さ (m)
      haunch: { height: 0.0, width: 0.0 }, // 隅角部ハンチ（たて壁背面と底版天端の入隅）高さ・幅 (m)
    },
    backfill: {
      raise: 0.0,   // 嵩上げ高さ (m)。0でレベル、>0でたて壁天端から勾配1:nで立ち上がる
      slopeN: 1.50, // 法面勾配 1:n の n（raise>0 のとき有効）
    },
    concrete: {
      gammaC: 24.5, // 鉄筋コンクリート単位体積重量 (kN/m3)
    },
    lengths: { body: 1.0, base: 1.0 }, // 躯体延長・底版延長 (m)
    soil: {
      gamma: 19.0,    // 裏込め土 湿潤単位体積重量 (kN/m3)
      gammaSub: 9.2,  // 裏込め土 水中単位体積重量 (kN/m3)
      gammaW: 9.8,    // 水の単位体積重量 (kN/m3)
      phi: 30.0,      // せん断抵抗角 (度)
      c: 0.0,         // 粘着力 常時 (kN/m2)
      cE: 0.0,        // 粘着力 地震時 (kN/m2)
      deltaStem: 0.6667, // たて壁計算用 壁面摩擦角 δ = 係数×φ
    },
    water: {
      enabled: false,       // 水位を考慮する
      considerUplift: true, // 浮力考慮ケースで揚圧力を作用させる
      front: 0.5,           // 前面水位 (m) 底版下面から
      back: 1.5,            // 背面水位 (m) 底版下面から
    },
    surcharge: {
      enabled: true,
      name: '活荷重',
      q: 10.0,      // 荷重強度 (kN/m2)
    },
    seismic: {
      enabled: true,
      kh: 0.15,     // 設計水平震度
      levelName: 'レベル1地震時',
    },
    collision: {
      enabled: false,  // 衝突荷重を考慮した「衝突時」ケースを追加する
      name: '衝突荷重',
      P: 10.0,         // 衝突荷重 (kN/m) 壁延長1mあたり
      h: 3.0,          // 作用高さ (m) 底版下面から
    },
    epCondition: {
      method: '試行くさび法（仮想背面）',
      precision: 0.005,   // 収束精度 (度)
      considerPv: true,   // 安定モーメントの土圧鉛直成分(Pv)を考慮
    },
    stability: {
      mu: 0.60,     // 底面と地盤の摩擦係数
      cB: 0.0,      // 底面と地盤の付着力 (kN/m2)
      overturnMethod: '偏心距離で照査',
      allowEccMethod: 'B/n',
      normal: { n: 6.0, Fs: 1.5, qa: 200.0 },
      seismic: { n: 3.0, Fs: 1.2, qa: 300.0 },
      collision: { n: 3.0, Fs: 1.2, qa: 300.0 },
    },
    material: {
      sigmaCk: 24,     // 設計基準強度 (N/mm2)
      sigmaCa: 8.0,    // 許容曲げ圧縮応力度 (N/mm2)
      tauA: 0.23,      // 許容せん断応力度 τa1 (N/mm2)
      sigmaSa: 180,    // 鉄筋許容引張応力度 (N/mm2) SD345
      rebarKind: 'SD345',
      pMin: 0.002,     // 最小鉄筋比（引張鉄筋量 As ≧ pMin・b・d）
      kNormal: 1.00,   // 許容応力度の割増係数（常時）
      kSeismic: 1.50,  // 許容応力度の割増係数（地震時）
    },
    member: {
      calc: true,      // 部材照査（第5章）を出力
      stem: { bar: 'D16', pitch: 250, cover: 70 },
      toe:  { bar: 'D16', pitch: 250, cover: 70 },
      heel: { bar: 'D16', pitch: 250, cover: 70 },
    },
  };
}

// サンプルプリセット
export const presets = {
  standard: () => defaultInput(),
  slope: () => {
    const d = defaultInput();
    d.title = 'L型擁壁 H=3.0m 嵩上げ盛土（1:1.5・嵩上げ1.0m）';
    d.backfill.raise = 1.0;
    d.backfill.slopeN = 1.5;
    return d;
  },
  tall: () => {
    const d = defaultInput();
    d.title = 'L型擁壁 H=5.0m 標準設計';
    d.geometry.H = 5.00;
    d.geometry.t1 = 0.35;
    d.geometry.t2 = 0.70;
    d.geometry.B1 = 0.80;
    d.geometry.B3 = 3.00;
    d.geometry.t3 = 0.60;
    d.member.stem = { bar: 'D22', pitch: 200, cover: 80 };
    d.member.heel = { bar: 'D19', pitch: 200, cover: 80 };
    return d;
  },
  pureL: () => {
    const d = defaultInput();
    d.title = 'L型擁壁 H=3.0m つま先版なし（逆L型）';
    d.geometry.B1 = 0.0;
    d.geometry.B3 = 2.30;
    return d;
  },
  collision: () => {
    const d = defaultInput();
    d.title = 'L型擁壁 H=3.0m 衝突荷重考慮';
    d.collision.enabled = true;
    return d;
  },
  water: () => {
    const d = defaultInput();
    d.title = 'L型擁壁 H=3.0m 水位・揚圧力考慮';
    d.water.enabled = true;
    d.water.front = 0.5;
    d.water.back = 1.5;
    return d;
  },
  haunch: () => {
    const d = defaultInput();
    d.title = 'L型擁壁 H=3.0m 隅角部ハンチ付き';
    d.geometry.haunch = { height: 0.30, width: 0.30 };
    return d;
  },
};

// 荷重ケース生成: 常時（活荷重考慮時は活荷重載荷、水位考慮時は浮力考慮）、
// 地震時（地震チェック時。浮力無視の慣行に従う）、
// 衝突時（衝突荷重チェック時。常時土圧＋衝突荷重、活荷重なし・浮力無視の慣行に従う）
export function generateCases(input) {
  const cases = [];
  const lc = input.surcharge.enabled;
  const wt = !!input.water?.enabled;
  let no = 1;
  cases.push({
    no: no++,
    name: (lc ? '常時＋活荷重（全面載荷）' : '常時') + (wt ? ' 浮力考慮' : ''),
    seismic: false, surcharge: lc, water: wt, cond: input.stability.normal,
  });
  if (input.seismic.enabled && input.seismic.kh > 0) {
    cases.push({
      no: no++, name: wt ? '地震時 浮力無視' : '地震時',
      seismic: true, surcharge: false, water: false, cond: input.stability.seismic,
    });
  }
  if (input.collision?.enabled) {
    cases.push({
      no: no++, name: wt ? '衝突時 浮力無視' : '衝突時',
      seismic: false, surcharge: false, collision: true, water: false,
      cond: input.stability.collision || input.stability.seismic,
    });
  }
  return cases;
}
