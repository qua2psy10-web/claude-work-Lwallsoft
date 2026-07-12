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
      beta: 0.0,  // 盛土勾配 (度)
    },
    concrete: {
      gammaC: 24.5, // 鉄筋コンクリート単位体積重量 (kN/m3)
    },
    lengths: { body: 1.0, base: 1.0 }, // 躯体延長・底版延長 (m)
    soil: {
      gamma: 19.0,  // 裏込め土 単位体積重量 (kN/m3)
      phi: 30.0,    // せん断抵抗角 (度)
      c: 0.0,       // 粘着力 常時 (kN/m2)
      cE: 0.0,      // 粘着力 地震時 (kN/m2)
      deltaStem: 0.6667, // たて壁計算用 壁面摩擦角 δ = 係数×φ
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
    },
    material: {
      sigmaCk: 24,     // 設計基準強度 (N/mm2)
      sigmaCa: 8.0,    // 許容曲げ圧縮応力度 (N/mm2)
      tauA: 0.23,      // 許容せん断応力度 τa1 (N/mm2)
      sigmaSa: 180,    // 鉄筋許容引張応力度 (N/mm2) SD345
      rebarKind: 'SD345',
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
    d.title = 'L型擁壁 H=3.0m 盛土勾配1:3（β≈18°）';
    d.geometry.beta = 18.43; // 1:3 ≒ 18.43度（φ未満）
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
};

// 荷重ケース生成: 常時（活荷重考慮時は活荷重載荷）、地震時（地震チェック時）
export function generateCases(input) {
  const cases = [];
  const lc = input.surcharge.enabled;
  let no = 1;
  cases.push({
    no: no++,
    name: lc ? '常時＋活荷重（全面載荷）' : '常時',
    seismic: false, surcharge: lc, cond: input.stability.normal,
  });
  if (input.seismic.enabled && input.seismic.kh > 0) {
    cases.push({
      no: no++, name: '地震時',
      seismic: true, surcharge: false, cond: input.stability.seismic,
    });
  }
  return cases;
}
