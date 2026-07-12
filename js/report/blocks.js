// 帳票部品（表・見出し・公式・判定行）

export const fmt3 = (v) => (Object.is(v, -0) ? 0 : v).toFixed(3);
export const fmt2 = (v) => v.toFixed(2);
export const fmt1 = (v) => v.toFixed(1);
export const mm = (v) => ` ${Math.round(v * 1000)}`;

export function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// 表: header = [[{t,cs,rs}...]...] / rows = [[cell...]...]
export function table(header, rows, cls = '') {
  const cell = (c, tag) => {
    if (c == null) return `<${tag}></${tag}>`;
    if (typeof c === 'object') {
      const cs = c.cs ? ` colspan="${c.cs}"` : '';
      const rs = c.rs ? ` rowspan="${c.rs}"` : '';
      const cl = c.cls ? ` class="${c.cls}"` : '';
      return `<${tag}${cs}${rs}${cl}>${c.t}</${tag}>`;
    }
    return `<${tag}>${c}</${tag}>`;
  };
  const thead = header.map((r) => `<tr>${r.map((c) => cell(c, 'th')).join('')}</tr>`).join('');
  const tbody = rows.map((r) => `<tr>${r.map((c) => cell(c, 'td')).join('')}</tr>`).join('');
  return `<table class="rpt-table ${cls}"><thead>${thead}</thead><tbody>${tbody}</tbody></table>`;
}

// 項目名/記号/設定値/単位 形式の設定値表
export function kvTable(rows, header = ['項目', '記号', '単位', '値', '備考']) {
  return table([header], rows, 'kv');
}

// 箇条書き（・項目 値 形式）
export function bullets(items) {
  return `<div class="rpt-bullets">${items
    .map(([k, v]) => `<div class="rpt-bullet"><span class="bk">・${k}</span><span class="bv">${v ?? ''}</span></div>`)
    .join('')}</div>`;
}

// 公式ブロック
export function formula(html) {
  return `<div class="rpt-formula">${html}</div>`;
}

// 記号説明（ここに、...）
export function legend(items) {
  return `<div class="rpt-legend"><div class="lg-head">ここに、</div>${items
    .map(([sym, desc]) => `<div class="lg-row"><span class="lg-sym">${sym}</span><span class="lg-sep">：</span><span class="lg-desc">${desc}</span></div>`)
    .join('')}</div>`;
}

// 分数
export function frac(num, den) {
  return `<span class="frac"><span class="fn">${num}</span><span class="fd">${den}</span></span>`;
}

// 判定行
export function judge(text, ok) {
  return `<div class="rpt-judge">${text}　判定：<span class="${ok ? 'ok' : 'ng'}">${ok ? 'OK' : 'NG'}</span></div>`;
}

export function para(text, cls = '') {
  return `<div class="rpt-para ${cls}">${text}</div>`;
}

export function subTitle(text) {
  return `<div class="rpt-subtitle">　　・${text}</div>`;
}
