// export — 함정(정보를 변형하고 그 변형이 채점 대상을 바꿈)(DESIGN 8).
// 카페24 에디터에 붙이는 형태로: 외부 CSS 인라인(순서=cascade), .clone-root 스코프 강제, 인라인 JS.
// 출력 둘: fragment.html(납품, 기본은 data 속성 보존·--strip 옵트인) / fragment.audit.html(재채점, data-component 보존).
import fs from 'node:fs';
import path from 'node:path';
import { runPaths, isMain } from '../lib/paths.mjs';

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

// 최상위 노드 분리: { type:'block', prelude, body } 또는 { type:'stmt', text }
// 문자열 리터럴(", ', 이스케이프)을 추적해 content:"}" / url("x{.png") 안의 중괄호를
// 룰 경계로 오인하지 않는다(검증 M6). 주석은 stripComments 가 먼저 제거하므로 미추적.
function splitTopLevel(css) {
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

// 최상위 콤마에서만 셀렉터 목록을 분리. 괄호 ()[] 깊이와 따옴표를 추적해
// :is()/:where()/:not()/:has() 및 [attr="a,b"] 안의 콤마를 구분자로 오인하지 않는다(검증 M5).
function splitSelectorList(prelude) {
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

function scopeSelector(sel, scope) {
  if (!sel) return sel;
  if (sel.includes(scope)) return sel; // 이미 스코프됨 (tokens.css 등)
  const rootRe = /^(html|body|:root)\b/i;
  if (rootRe.test(sel)) {
    const rest = sel.replace(rootRe, ''); // .trim() 금지 — 곧장 붙은 복합 판별 필요
    if (!rest.trim()) return scope; // 단독 body/html/:root → .clone-root
    // 결합자 없이 곧장 붙은 복합(.dark, [lang], #id, :hover)은 공백 없이 scope 에 붙인다(검증 m13).
    if (/^[.#:[]/.test(rest)) return `${scope}${rest}`; // body.dark → .clone-root.dark
    return `${scope} ${rest.trim()}`; // 자손(body .x, body > .x)만 공백 결합
  }
  return `${scope} ${sel}`;
}

// 전역 셀렉터를 .clone-root 하위로 강제 prefix 하는 가드(best-effort).
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
        // @keyframes / @font-face / @page — 내부가 셀렉터가 아니므로 그대로
        return `${p} {${node.body}}`;
      }
      const sel = splitSelectorList(p)
        .map((s) => scopeSelector(s.trim(), scope))
        .join(', ');
      return `${sel} {${node.body}}`;
    })
    .join('\n');
}

function read(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

/**
 * @param {object} opts
 * @param {boolean} [opts.strip=false] 납품본에서 data-component/data-role 제거.
 *   기본 false — assemble 이 emit 한 CSS 가 [data-component="…"] 셀렉터에 의존하므로,
 *   strip 하면 스타일이 깨진다. CSS 를 클래스 기반으로 옮긴 경우에만 켤 것(DESIGN 8: "제거 가능").
 */
export function exportFragment(runName, { strip = false } = {}) {
  const p = runPaths(runName);
  if (!fs.existsSync(p.index)) {
    throw new Error(`export: ${p.index} 가 없음. 먼저 assemble 을 돌리세요.`);
  }
  fs.mkdirSync(p.dist, { recursive: true });

  const html = read(p.index);
  const tokensCss = read(p.tokensCss);
  const stylesCss = read(p.stylesCss);
  const js = read(p.interactions);

  // 1) CSS 인라인 — tokens → styles 순서 고정(cascade). 둘 다 스코프 가드 통과.
  const inlinedCss = `${scopeCss(tokensCss)}\n${scopeCss(stylesCss)}`.trim();

  // 2) body 안쪽(=clone-root 래퍼)만 추출, 외부 <script src> 제거
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let cloneRoot = (bodyMatch ? bodyMatch[1] : html)
    .replace(/<script[^>]*src=[^>]*>\s*<\/script>/gi, '')
    .trim();

  const styleTag = inlinedCss ? `<style>\n${inlinedCss}\n</style>` : '';
  const scriptTag = js.trim() ? `<script>\n${js.trim()}\n</script>` : '';

  // 3a) 납품본 — 기본은 data 속성 보존(CSS 가 [data-component] 셀렉터에 의존). strip 은 옵트인.
  //     에디터가 data 속성을 떨군다면 재채점은 strip 전 audit 본으로 닫는다(DESIGN 8).
  //     strip 인데 CSS 가 여전히 [data-*] 셀렉터에 의존하면 납품본 스타일이 통째로 깨지므로 fail-loud(검증 m12).
  if (strip && /\[data-(component|role)\b/.test(inlinedCss)) {
    throw new Error(
      'export --strip: 인라인 CSS 가 아직 [data-component]/[data-role] 셀렉터에 의존합니다. ' +
        'strip 하면 납품본 스타일이 깨집니다. 먼저 styles.css 의 해당 셀렉터를 클래스 기반으로 옮기세요(DESIGN 8). ' +
        'strip 을 끄면(기본값) data 속성을 보존해 안전합니다.'
    );
  }
  const delivered = strip ? cloneRoot.replace(/\s+data-(component|role)="[^"]*"/g, '') : cloneRoot;
  const fragment = [styleTag, delivered, scriptTag].filter(Boolean).join('\n');
  fs.writeFileSync(p.fragment, fragment + '\n', 'utf8');

  // 3b) 재채점 전용 — 같은 변환을 거치되 data-component 보존 + 풀 문서로 감싸 단독 렌더 가능
  const auditDoc = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>audit · ${runName}</title>
${styleTag}
</head>
<body>
${cloneRoot}
${scriptTag}
</body>
</html>
`;
  fs.writeFileSync(p.audit, auditDoc, 'utf8');

  return { fragment: p.fragment, audit: p.audit };
}

if (isMain(import.meta.url)) {
  const runName = process.argv[2];
  if (!runName) {
    console.error('사용법: node clone-harness/scripts/export.mjs <run-name> [--strip]');
    process.exit(2);
  }
  const r = exportFragment(runName, { strip: process.argv.includes('--strip') });
  console.log(`✓ 납품본 → ${path.relative(process.cwd(), r.fragment)}`);
  console.log(`✓ 재채점본 → ${path.relative(process.cwd(), r.audit)} (data-component 보존)`);
}
