// SVG図の生成（L型擁壁の断面図・全体図・くさび説明図・ケース土圧図・ω-Paグラフ・地盤反力図・配筋図）
import { fmt3 } from './blocks.js';

const RAD = Math.PI / 180;

function svg(w, h, inner, cls = '') {
  return `<svg class="rpt-fig ${cls}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><defs><marker id="ah" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#000"/></marker></defs>${inner}</svg>`;
}
const L = (x1, y1, x2, y2, cls = 'ln') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${cls}"/>`;
const T = (x, y, text, cls = 'tx', anchor = 'middle') => `<text x="${x}" y="${y}" class="${cls}" text-anchor="${anchor}">${text}</text>`;
const P = (pts, cls = 'poly') => `<polygon points="${pts.map((p) => p.join(',')).join(' ')}" class="${cls}"/>`;
const PL = (pts, cls = 'pline') => `<polyline points="${pts.map((p) => p.join(',')).join(' ')}" class="${cls}"/>`;

function dim(x1, y1, x2, y2, label, offTx = -3) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  let tx = mx, ty = my, anchor = 'middle';
  if (Math.abs(ny) >= Math.abs(nx)) {
    ty = my + ny * offTx + (ny * offTx > 0 ? 8 : -2);
  } else {
    const side = Math.sign(nx * offTx) || -1;
    anchor = side < 0 ? 'end' : 'start';
    tx = mx + side * 5;
    ty = my + 3;
  }
  return (
    L(x1, y1, x2, y2, 'dim') +
    L(x1 - nx * 3, y1 - ny * 3, x1 + nx * 3, y1 + ny * 3, 'dim') +
    L(x2 - nx * 3, y2 - ny * 3, x2 + nx * 3, y2 + ny * 3, 'dim') +
    T(tx, ty, label, 'dtx', anchor)
  );
}

const mmv = (v) => String(Math.round(v * 1000));

// L型躯体の頂点（つま先版前面下端が原点）
function body(geom) {
  const h = geom.H - geom.t3;
  const xb = geom.B1 + geom.t2;
  const B = geom.B1 + geom.t2 + geom.B3;
  const xtf = geom.B1 + (geom.t2 - geom.t1);
  return { pts: [[0, 0], [B, 0], [B, geom.t3], [xb, geom.t3], [xb, geom.H], [xtf, geom.H], [geom.B1, geom.t3], [0, geom.t3]], h, xb, B, xtf };
}

// 1.1.1 断面形状図
export function sectionFig(geom) {
  const W = 300, H = 250;
  const bd = body(geom);
  const s = Math.min(150 / geom.H, 180 / bd.B);
  const ox = 60, oy = 205;
  const X = (x) => ox + x * s, Y = (y) => oy - y * s;
  let g = P(bd.pts.map(([x, y]) => [X(x), Y(y)]), 'wall');
  // 寸法（底版下: B1, t2, B3）
  const dl = oy + 16;
  if (geom.B1 > 0) g += dim(X(0), dl, X(geom.B1), dl, mmv(geom.B1));
  g += dim(X(geom.B1), dl, X(bd.xb), dl, mmv(geom.t2));
  g += dim(X(bd.xb), dl, X(bd.B), dl, mmv(geom.B3));
  g += dim(X(0), dl + 16, X(bd.B), dl + 16, mmv(bd.B), 5);
  // 高さ
  g += dim(X(0) - 16, Y(0), X(0) - 16, Y(geom.H), mmv(geom.H));
  g += dim(X(bd.B) + 16, Y(0), X(bd.B) + 16, Y(geom.t3), mmv(geom.t3));
  // 天端厚 t1
  g += dim(X(bd.xtf), Y(geom.H) - 12, X(bd.xb), Y(geom.H) - 12, mmv(geom.t1));
  return svg(W, H, g);
}

// 1.1.2 全体形状図（背面土砂・盛土勾配・仮想背面）
export function overallFig(geom, { beta = 0, Df = 0 }) {
  const W = 340, H = 250;
  const b = beta * RAD;
  const bd = body(geom);
  const slopeH = geom.B3 * Math.tan(b);
  const topY = geom.H + slopeH;
  const s = Math.min(150 / topY, 150 / (bd.B + 1));
  const ox = 55, oy = 205;
  const X = (x) => ox + x * s, Y = (y) => oy - y * s;
  // 背面土砂（かかと版上＋勾配部）
  const surfEndX = bd.B + 1.2;
  const surfEndY = geom.H + (surfEndX - bd.xb) * Math.tan(b);
  let g = P([[bd.xb, geom.t3], [bd.xb, geom.H], [X(surfEndX) > 0 ? surfEndX : surfEndX, surfEndY], [surfEndX, geom.t3]]
    .map(([x, y]) => [X(x), Y(y)]), 'soil');
  // 躯体
  g += P(bd.pts.map(([x, y]) => [X(x), Y(y)]), 'wall');
  // 前面地盤線（根入れ Df）
  g += L(X(-0.9), Y(Df), X(0), Y(Df), 'ground');
  // 背面地表線（勾配）
  g += PL([[X(bd.xb), Y(geom.H)], [X(surfEndX), Y(surfEndY)]], 'ground');
  // ハッチング（地表面）
  for (let i = 0; i < 6; i++) {
    const hx = X(bd.xb) + 12 + i * 16;
    if (hx < X(surfEndX)) { const hy = Y(geom.H + (hx - X(bd.xb)) / s * Math.tan(b)); g += L(hx, hy, hx - 6, hy + 6, 'hatch'); }
  }
  // 仮想背面（破線）
  g += L(X(bd.B), Y(0), X(bd.B), Y(topY), 'vbf');
  g += T(X(bd.B) + 3, Y(topY * 0.55), '仮想背面', 'dtx', 'start');
  // 盛土勾配ラベル
  if (beta > 0.1) g += T(X(bd.xb + geom.B3 / 2), Y(geom.H + slopeH / 2) - 6, `β=${fmt3(beta)}°`, 'dtx', 'start');
  // 根入れ
  g += dim(X(-0.45), Y(0), X(-0.45), Y(Df), mmv(Df));
  g += dim(X(0), oy + 16, X(bd.B), oy + 16, mmv(bd.B), 5);
  return svg(W, H, g);
}

// 試行くさび法の説明図（常時/地震時）
export function wedgeMethodFig(seismic) {
  const W = 340, H = 235;
  const heelB = [175, 205], vbfTop = [175, 55];
  const stemFront = [110, 205], stemTop = [110, 90];
  const slipEnd = [305, 55];
  let g = P([stemFront, [110, 205], heelB, vbfTop, stemTop], 'wall');
  // 仮想背面（鉛直破線）
  g += L(heelB[0], heelB[1], vbfTop[0], vbfTop[1], 'vbf');
  // 地表面・すべり面
  g += L(vbfTop[0], vbfTop[1], 330, 55, 'ground');
  g += L(heelB[0], heelB[1], slipEnd[0], slipEnd[1], 'slip');
  // くさび
  g += P([heelB, vbfTop, slipEnd], 'soil');
  // 上載荷重
  for (let x = 195; x <= 295; x += 16) g += L(x, 40, x, 52, 'arrow');
  g += L(190, 40, 300, 40, 'ln');
  g += T(245, 34, seismic ? 'qE' : 'q', 'sym');
  // W
  const cx = 225, cy = 115;
  g += L(cx, cy, cx, cy + 28, 'arrow') + T(cx + 8, cy + 18, seismic ? 'WE' : 'W', 'sym');
  if (seismic) g += L(cx, cy, cx - 26, cy, 'arrow') + T(cx - 28, cy - 4, 'kh・W', 'sym', 'end');
  // PA
  g += L(190, 130, 168, 118, 'arrow') + T(196, 132, seismic ? 'PEA' : 'PA', 'sym', 'start');
  // 角度
  g += T(198, 196, 'ω' + (seismic ? 'E' : ''), 'sym');
  g += T(318, 48, 'β', 'sym');
  g += T(160, 130, 'δ', 'sym');
  return svg(W, H, g);
}

// ケース毎の土圧計算図
export function caseEpFig(geom, ep, { surcharge = false, beta = 0 }) {
  const W = 320, H = 210;
  const b = beta * RAD;
  const bd = body(geom);
  const endX = ep.end ? ep.end[0] : bd.B + ep.Hp / Math.tan(ep.omega * RAD);
  const topY = Math.max(ep.Hp, ep.end ? ep.end[1] : ep.Hp);
  const s = Math.min(140 / topY, 250 / (endX + 0.5));
  const ox = 55, oy = 178;
  const X = (x) => ox + x * s, Y = (y) => oy - y * s;
  // くさび土砂
  let g = P((ep.poly && ep.poly.length ? ep.poly : [[bd.B, 0], [bd.B, ep.Hp], [endX, ep.Hp]]).map(([x, y]) => [X(x), Y(y)]), 'soil');
  // 躯体
  g += P(bd.pts.map(([x, y]) => [X(x), Y(y)]), 'wall');
  // 仮想背面
  g += L(X(bd.B), Y(0), X(bd.B), Y(ep.Hp), 'vbf');
  // 地表面（勾配）
  g += L(X(bd.xb), Y(geom.H), X(endX + 0.3), Y(geom.H + (endX + 0.3 - bd.xb) * Math.tan(b)), 'ground');
  // すべり線
  g += L(X(bd.B), Y(0), X(ep.end[0]), Y(ep.end[1]), 'slip');
  g += T(Math.min(X(ep.end[0]) + 4, W - 30), Y(ep.end[1]) + 14, `ω=${ep.omega.toFixed(1)}°`, 'dtx', 'start');
  // 活荷重
  if (surcharge) {
    for (let x = X(bd.xb) + 6; x <= X(endX); x += 15) g += L(x, Y(ep.Hp) - 14, x, Y(ep.Hp) - 3, 'arrow');
    g += T(X((bd.xb + endX) / 2), Y(ep.Hp) - 19, '活荷重', 'sym');
  }
  // 土圧合力
  g += L(X(bd.B) + 2, Y(ep.Hp / 3), X(bd.B) - 34, Y(ep.Hp / 3), 'arrow');
  g += T(X(bd.B) - 36, Y(ep.Hp / 3) - 3, ep.PA ? `PA=${fmt3(ep.PA)}` : 'PA', 'dtx', 'end');
  g += dim(X(0) - 14, Y(0), X(0) - 14, Y(ep.Hp), mmv(ep.Hp));
  return svg(W, H, g);
}

// ω-Pa 曲線グラフ
export function omegaPaGraph(curve, xmin) {
  const W = 430, H = 190;
  const x0 = 70, x1 = 405, y0 = 150, y1 = 25;
  const maxPa = Math.max(...curve.map((p) => p[1]), 0.1);
  const steps = [1, 2, 5, 10, 20, 50, 100];
  const step = steps.find((s) => maxPa / s <= 8) || 200;
  const ymax = Math.ceil(maxPa / step) * step;
  const SX = (w) => x0 + (w - xmin) / (90 - xmin) * (x1 - x0);
  const SY = (v) => y0 - v / ymax * (y0 - y1);
  let g = L(x0, y0, x1, y0, 'axis') + L(x0, y0, x0, y1, 'axis');
  for (let w = Math.ceil(xmin / 10) * 10; w <= 90; w += 10) g += L(SX(w), y0, SX(w), y0 + 4, 'axis') + T(SX(w), y0 + 15, String(w), 'gtx');
  for (let v = 0; v <= ymax + 1e-9; v += step) {
    g += L(x0 - 4, SY(v), x0, SY(v), 'axis') + T(x0 - 8, SY(v) + 3, String(v), 'gtx', 'end');
    if (v > 0) g += L(x0, SY(v), x1, SY(v), 'grid');
  }
  g += PL(curve.filter((p) => p[0] >= xmin).map(([w, v]) => [SX(w), SY(Math.min(v, ymax))]), 'curve');
  g += T((x0 + x1) / 2, H - 4, 'すべり角 ω (度)', 'gcap');
  g += T(x0, 14, '主働土圧 PA (kN/m)', 'gcap', 'start');
  return svg(W, H, g);
}

// 地盤反力度図
export function reactionFig(rc, sum) {
  const W = 390, H = 190;
  const x0 = 80, x1 = 280, yb = 70;
  const qm = Math.max(rc.q1, rc.q2, 1e-6);
  const d1 = 55 * rc.q1 / qm, d2 = 55 * rc.q2 / qm;
  let g = L(x0 - 15, yb, x1 + 15, yb, 'ln');
  if (rc.type === '台形') {
    g += P([[x0, yb], [x1, yb], [x1, yb + d2], [x0, yb + d1]], 'press');
  } else if (rc.q2 === 0) {
    const xe = x0 + (x1 - x0) * (rc.Bp / rc.B);
    g += P([[x0, yb], [xe, yb], [x0, yb + d1]], 'press');
  } else {
    const xs = x1 - (x1 - x0) * (rc.Bp / rc.B);
    g += P([[xs, yb], [x1, yb], [x1, yb + d2]], 'press');
  }
  g += T(x0 - 5, yb + Math.max(d1, 12) + 14, `q1=${fmt3(rc.q1)}`, 'dtx', 'start');
  g += T(x1 + 6, yb + d2 + 4, `q2=${fmt3(rc.q2)}`, 'dtx', 'start');
  g += T(x0 - 5, yb - 60, 'つま先側', 'gtx', 'start');
  g += T(x1 + 5, yb - 60, 'かかと側', 'gtx', 'end');
  const xc = (x0 + x1) / 2;
  const xe = xc - (x1 - x0) * (sum.e / rc.B);
  g += L(xe, yb - 40, xe, yb - 4, 'arrowV');
  g += T(xe + 4, yb - 44, `V=${fmt3(sum.V)}`, 'dtx', 'start');
  g += dim(x0, yb + 72, x1, yb + 72, fmt3(rc.B), 5);
  return svg(W, H, g);
}

// 配筋断面図（部材ごと）
export function rebarSecFig(m, label) {
  const W = 210, H = 120;
  const x0 = 30, x1 = 180, yt = 25, yb = 95;
  let g = `<rect x="${x0}" y="${yt}" width="${x1 - x0}" height="${yb - yt}" class="wall"/>`;
  // 引張鉄筋（下側）
  const yr = yb - 8;
  for (let x = x0 + 14; x <= x1 - 10; x += 18) g += `<circle cx="${x}" cy="${yr}" r="2.5" class="rebar" fill="#b00"/>`;
  g += dim(x1 + 12, yt, x1 + 12, yb, `${(m.t * 1000).toFixed(0)}`);
  g += dim(x1 + 12, yr, x1 + 12, yb, `${(m.t * 1000 - m.d).toFixed(0)}`, 3);
  g += T((x0 + x1) / 2, yt - 8, `${label}  ${m.bar}@${m.pitch}`, 'dtx');
  g += T((x0 + x1) / 2, yb + 16, `d=${m.d.toFixed(0)}mm  As=${m.As.toFixed(0)}mm²/m`, 'gtx');
  return svg(W, H, g);
}
