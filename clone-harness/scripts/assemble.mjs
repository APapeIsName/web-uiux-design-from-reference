// assemble — 사소함(정보 안 바꾸고 합치기만). 빌드 아님, concat.
// src/components/*.html 을 components.json '배열 순서대로' concat → src/index.html.
// design-system.json → tokens.css emit. .clone-root 래퍼를 개발 단계부터 씌운다(DESIGN 8).
import fs from 'node:fs';
import path from 'node:path';
import { runPaths, isMain } from '../lib/paths.mjs';
import { emitTokensCss } from '../lib/tokens.mjs';
import { validateFile } from '../lib/validate.mjs';

export function assemble(runName) {
  const p = runPaths(runName);

  const ds = validateFile('designSystem', p.designSystem);
  const { components } = validateFile('components', p.componentsJson);

  // 1) tokens.css emit (.clone-root 스코프)
  const tokensCss = emitTokensCss(ds, { selector: '.clone-root' });
  fs.writeFileSync(p.tokensCss, tokensCss, 'utf8');

  // 2) 컴포넌트 조각을 배열 순서대로 concat
  const missing = [];
  const parts = [];
  for (const c of components) {
    const file = path.join(p.components, `${c.id}.html`);
    if (!fs.existsSync(file)) {
      missing.push(c.id);
      continue;
    }
    const html = fs.readFileSync(file, 'utf8').trim();
    parts.push(`<!-- component: ${c.id} -->\n${html}`);
  }
  if (missing.length) {
    throw new Error(
      `assemble: 다음 컴포넌트의 src/components/<id>.html 이 없습니다: ${missing.join(', ')}\n` +
        `(3단계 구현에서 만들어야 합니다. id = 파일명 = data-component 의 3중 계약)`
    );
  }

  const hasStyles = fs.existsSync(p.stylesCss);
  const hasInteractions = fs.existsSync(p.interactions);

  const doc = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>clone-harness · ${runName}</title>
<link rel="stylesheet" href="tokens.css">
${hasStyles ? '<link rel="stylesheet" href="styles.css">' : '<!-- styles.css 없음 -->'}
</head>
<body>
<div class="clone-root">
${parts.join('\n\n')}
</div>
${hasInteractions ? '<script src="interactions.js"></script>' : '<!-- interactions.js 없음 -->'}
</body>
</html>
`;

  fs.writeFileSync(p.index, doc, 'utf8');
  return { index: p.index, tokensCss: p.tokensCss, components: components.map((c) => c.id) };
}

if (isMain(import.meta.url)) {
  const runName = process.argv[2];
  if (!runName) {
    console.error('사용법: node clone-harness/scripts/assemble.mjs <run-name>');
    process.exit(2);
  }
  const r = assemble(runName);
  console.log(`✓ assemble: ${r.components.length}개 컴포넌트 → ${path.relative(process.cwd(), r.index)}`);
  console.log(`✓ tokens.css emit → ${path.relative(process.cwd(), r.tokensCss)}`);
}
