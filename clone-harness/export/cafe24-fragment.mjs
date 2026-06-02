// export 어댑터: cafe24-fragment
// 카페24 에디터에 "통째로 붙여넣는" 단일 HTML 조각. 외부 CSS 인라인(tokens→styles 순서),
// .clone-root 스코프 강제, 인라인 JS. 정적 마크업(우리가 만든 카드 그대로).
//
// 어댑터 공통 인터페이스:
//   export const id
//   export async function run({ runName, paths, config, opts }) -> { outputs:[{path,label}], auditEntry }
//     - dist/ 에 산출물을 쓰고,
//     - auditEntry: loop --audit 이 dist/ 에서 렌더해 재채점할 파일명(data-component 보존본)
import fs from 'node:fs';
import { scopeCss } from '../lib/css.mjs';

export const id = 'cafe24-fragment';

function read(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

export async function run({ runName, paths, opts = {} }) {
  const strip = !!opts.strip;
  if (!fs.existsSync(paths.index)) {
    throw new Error(`export(cafe24-fragment): ${paths.index} 가 없음. 먼저 assemble 을 돌리세요.`);
  }
  fs.mkdirSync(paths.dist, { recursive: true });

  const html = read(paths.index);
  const tokensCss = read(paths.tokensCss);
  const stylesCss = read(paths.stylesCss);
  const js = read(paths.interactions);

  // 1) CSS 인라인 — tokens → styles 순서 고정(cascade). 둘 다 스코프 가드 통과.
  const inlinedCss = `${scopeCss(tokensCss)}\n${scopeCss(stylesCss)}`.trim();

  // 2) body 안쪽(=clone-root 래퍼)만 추출, 외부 <script src> 제거
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const cloneRoot = (bodyMatch ? bodyMatch[1] : html)
    .replace(/<script[^>]*src=[^>]*>\s*<\/script>/gi, '')
    .trim();

  const styleTag = inlinedCss ? `<style>\n${inlinedCss}\n</style>` : '';
  const scriptTag = js.trim() ? `<script>\n${js.trim()}\n</script>` : '';

  // 3a) 납품본 — 기본 data 속성 보존. strip 인데 CSS 가 [data-*] 의존이면 fail-loud(검증 m12).
  if (strip && /\[data-(component|role)\b/.test(inlinedCss)) {
    throw new Error(
      'export --strip: 인라인 CSS 가 아직 [data-component]/[data-role] 셀렉터에 의존합니다. ' +
        'strip 하면 납품본 스타일이 깨집니다. styles.css 를 클래스 기반으로 옮긴 뒤 켜세요.'
    );
  }
  const delivered = strip ? cloneRoot.replace(/\s+data-(component|role)="[^"]*"/g, '') : cloneRoot;
  const fragment = [styleTag, delivered, scriptTag].filter(Boolean).join('\n');
  fs.writeFileSync(paths.fragment, fragment + '\n', 'utf8');

  // 3b) 재채점 전용 — 같은 변환 + data-component 보존 + 풀 문서로 감싸 단독 렌더 가능
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
  fs.writeFileSync(paths.audit, auditDoc, 'utf8');

  return {
    outputs: [
      { path: paths.fragment, label: '납품본(조각)' },
      { path: paths.audit, label: '재채점본(data-component 보존)' },
    ],
    auditEntry: 'fragment.audit.html',
  };
}
