// 座標法による断面計算（道路土工擁壁工指針の計算式）とL型擁壁の形状定義
//   A  = 1/2 Σ(x[i+1]・y[i] - x[i]・y[i+1])
//   Gy = -1/2 Σ(y[i+1]-y[i])・{x[i]^2 + 1/3(x[i+1]-x[i])(x[i+1]+2x[i])}
//   Gx =  1/2 Σ(x[i+1]-x[i])・{y[i]^2 + 1/3(y[i+1]-y[i])(y[i+1]+2y[i])}
// 頂点はつま先版前面下端を原点に (x: 背面方向, y: 上方向)。

export function sectionProperties(vertices, x0 = 0, y0 = 0) {
  const n = vertices.length;
  const rows = [];
  let A = 0, Gy = 0, Gx = 0;
  for (let i = 0; i < n; i++) {
    const [xi, yi] = vertices[i];
    const [xj, yj] = vertices[(i + 1) % n];
    const dA = 0.5 * (xj * yi - xi * yj);
    const dGy = -0.5 * (yj - yi) * (xi * xi + (1 / 3) * (xj - xi) * (xj + 2 * xi));
    const dGx = 0.5 * (xj - xi) * (yi * yi + (1 / 3) * (yj - yi) * (yj + 2 * yi));
    A += dA; Gy += dGy; Gx += dGx;
    rows.push({ x: xi, y: yi, dA, dGy, dGx });
  }
  const XG = Gy / A - x0;
  const YG = Gx / A - y0;
  return { vertices, rows, A: Math.abs(A), Gy: Math.abs(A) === A ? Gy : -Gy, Gx: Math.abs(A) === A ? Gx : -Gx, XG, YG };
}

// L型擁壁の主要寸法（派生量）
//   H:全高, t1:たて壁天端厚, t2:たて壁付け根厚, B1:つま先版長, B3:かかと版長,
//   t3:底版厚, beta:盛土勾配(度)
export function dims(geom) {
  const h = geom.H - geom.t3;            // たて壁高
  const xb = geom.B1 + geom.t2;          // たて壁背面のx座標
  const B = geom.B1 + geom.t2 + geom.B3; // 底版幅
  const xtf = geom.B1 + (geom.t2 - geom.t1); // たて壁天端前面のx座標
  return { h, xb, B, xtf };
}

// L型擁壁躯体の断面頂点（つま先版前面下端が原点、反時計回り）
// 隅角部ハンチ（たて壁背面 x=xb と底版天端 y=t3 の入隅を埋める三角形）
export function haunchTri(geom) {
  const { xb } = dims(geom);
  const w = geom.haunch?.width || 0;
  const hh = geom.haunch?.height || 0;
  if (w <= 1e-9 || hh <= 1e-9) return null;
  const t3 = geom.t3;
  return {
    w, hh, area: 0.5 * w * hh,
    cx: xb + w / 3, cy: t3 + hh / 3,
    pts: [[xb, t3], [xb + w, t3], [xb, t3 + hh]],
  };
}

export function bodyVertices(geom) {
  const { h, xb, B, xtf } = dims(geom);
  const { B1, t3, H } = geom;
  const ht = haunchTri(geom);
  // 入隅(xb,t3)をハンチの斜辺 (xb+w,t3)→(xb,t3+hh) に置き換える
  const corner = ht ? [[xb + ht.w, t3], [xb, t3 + ht.hh]] : [[xb, t3]];
  return [
    [0, 0], [B, 0], [B, t3], ...corner,
    [xb, H], [xtf, H], [B1, t3], [0, t3],
  ];
}
