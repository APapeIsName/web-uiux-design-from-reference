// CSS 변환 유틸 — export 어댑터들이 공유한다(전역 셀렉터를 스코프 하위로 강제 prefix 등).
// 문자열/괄호/중괄호를 추적해 content:"}" · :is(a,b) · [attr="a,b"] 같은 케이스를 깨지 않는다.

export function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

// 최상위 노드 분리: { type:'block', prelude, body } 또는 { type:'stmt', text }
export function splitTopLevel(css) {
  const nodes = [];
  let i = 0;
  let start = 0;
  let str = null; // 열린 문자열 종료문자(" 또는 ') 또는 null
  while (i < css.length) {
    const ch = css[i];
    if (str) {
      if (ch === '\\') { i += 2; continue; }
      if (ch === str) str = null;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'") { str = ch; i++; continue; }
    if (ch === '{') {
      let j = i + 1;
      let d = 1;
      let s2 = null;
      while (j < css.length && d > 0) {
        const cj = css[j];
        if (s2) {
          if (cj === '\\') { j += 2; continue; }
          if (cj === s2) s2 = null;
          j++;
          continue;
        }
        if (cj === '"' || cj === "'") { s2 = cj; j++; continue; }
        if (cj === '{') d++;
        else if (cj === '}') d--;
        j++;
      }
      nodes.push({ type: 'block', prelude: css.slice(start, i).trim(), body: css.slice(i + 1, j - 1) });
      i = j;
      start = j;
      continue;
    }
    if (ch === ';') {
      const stmt = css.slice(start, i + 1).trim();
      if (stmt) nodes.push({ type: 'stmt', text: stmt });
      i++;
      start = i;
      continue;
    }
    i++;
  }
  const tail = css.slice(start).trim();
  if (tail) nodes.push({ type: 'stmt', text: tail });
  return nodes;
}

// 최상위 콤마에서만 셀렉터 목록을 분리(괄호 깊이·따옴표 추적).
export function splitSelectorList(prelude) {
  const parts = [];
  let depth = 0;
  let quote = null;
  let start = 0;
  for (let i = 0; i < prelude.length; i++) {
    const ch = prelude[i];
    if (quote) {
      if (ch === quote && prelude[i - 1] !== '\\') quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    else if (ch === ',' && depth === 0) {
      parts.push(prelude.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(prelude.slice(start));
  return parts;
}

export function scopeSelector(sel, scope) {
  if (!sel) return sel;
  if (sel.includes(scope)) return sel; // 이미 스코프됨
  const rootRe = /^(html|body|:root)\b/i;
  if (rootRe.test(sel)) {
    const rest = sel.replace(rootRe, ''); // .trim() 금지 — 곧장 붙은 복합 판별 필요
    if (!rest.trim()) return scope;
    if (/^[.#:[]/.test(rest)) return `${scope}${rest}`; // body.dark → .clone-root.dark
    return `${scope} ${rest.trim()}`;
  }
  return `${scope} ${sel}`;
}

// 전역 셀렉터를 scope 하위로 강제 prefix(best-effort).
export function scopeCss(css, scope = '.clone-root') {
  const nodes = splitTopLevel(stripComments(css));
  return nodes
    .map((node) => {
      if (node.type === 'stmt') return node.text; // @import, @charset 등
      const p = node.prelude;
      if (p.startsWith('@')) {
        const lower = p.toLowerCase();
        if (lower.startsWith('@media') || lower.startsWith('@supports') || lower.startsWith('@container')) {
          return `${p} {\n${scopeCss(node.body, scope)}\n}`;
        }
        return `${p} {${node.body}}`;
      }
      const sel = splitSelectorList(p)
        .map((s) => scopeSelector(s.trim(), scope))
        .join(', ');
      return `${sel} {${node.body}}`;
    })
    .join('\n');
}
