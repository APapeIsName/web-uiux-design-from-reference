// new-run — 새 실행 인스턴스 스캐폴드. 엔진 기본 config 를 복사하고 디렉터리 골격 + 최소 유효 스텁 생성.
// 인스턴스는 일회성(원칙 1-4). 2단계에서 design/ 을, 3단계에서 src/ 를 채운다.
import fs from 'node:fs';
import path from 'node:path';
import { runPaths, ENGINE_ROOT, isMain } from '../lib/paths.mjs';

const STUB_DESIGN_SYSTEM = {
  color: {
    bg: { page: '#FFFFFF', surface: '#0E0E10' },
    text: { primary: '#111111', muted: '#6B7280' },
    brand: { primary: '#2F6BFF', accent: '#FF5C39' },
  },
  type: {
    family: { heading: "'Pretendard', sans-serif", body: "'Pretendard', sans-serif" },
    size: { h1: '48px', h2: '32px', body: '16px', caption: '13px' },
    weight: { regular: 400, bold: 700 },
    leading: { tight: 1.1, normal: 1.5 },
  },
  space: { xs: '4px', sm: '8px', md: '16px', lg: '32px', xl: '64px' },
  radius: { sm: '4px', md: '12px', pill: '999px' },
};

const STUB_COMPONENTS = {
  components: [
    {
      id: 'hero',
      intent: '첫 화면. 큰 제목 + 보조 카피 + CTA 버튼. 제목이 1차 초점.',
      expects: { layout: '세로 중앙 정렬, 좌측 텍스트 블록' },
      tokens: ['color.bg.page', 'color.text.primary', 'color.brand.primary', 'type.family.heading', 'type.size.h1'],
    },
  ],
};

const STUB_HERO_HTML = `<section data-component="hero">
  <h1 data-role="title">여기에 큰 제목</h1>
  <p>보조 카피 한 줄.</p>
  <a href="#" data-role="cta">시작하기</a>
</section>
`;

const STUB_STYLES = `/* .clone-root 스코프 안에서만 작성. var(--color-*) 로 토큰 참조. */
[data-component="hero"] {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: var(--space-md);
  min-height: 480px;
  padding: var(--space-xl);
  background: var(--color-bg-page);
}
[data-component="hero"] h1 {
  font-family: var(--type-family-heading);
  font-size: var(--type-size-h1);
  font-weight: var(--type-weight-bold);
  color: var(--color-text-primary);
  margin: 0;
}
[data-component="hero"] [data-role="cta"] {
  align-self: flex-start;
  padding: var(--space-sm) var(--space-lg);
  border-radius: var(--radius-pill);
  background: var(--color-brand-primary);
  color: #fff;
  text-decoration: none;
}
`;

function writeIfAbsent(file, content) {
  if (fs.existsSync(file)) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
  return true;
}

export function newRun(runName) {
  const p = runPaths(runName);
  for (const dir of [p.reference, p.design, p.components, p.work, p.shots, p.dist]) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const defaultConfig = fs.readFileSync(path.join(ENGINE_ROOT, 'config.default.json'), 'utf8');
  const created = [];
  if (writeIfAbsent(p.config, defaultConfig)) created.push('config.json');
  if (writeIfAbsent(p.designSystem, JSON.stringify(STUB_DESIGN_SYSTEM, null, 2) + '\n')) created.push('design/design-system.json');
  if (writeIfAbsent(p.componentsJson, JSON.stringify(STUB_COMPONENTS, null, 2) + '\n')) created.push('design/components.json');
  if (writeIfAbsent(path.join(p.components, 'hero.html'), STUB_HERO_HTML)) created.push('src/components/hero.html');
  if (writeIfAbsent(p.stylesCss, STUB_STYLES)) created.push('src/styles.css');

  return { root: p.root, created };
}

if (isMain(import.meta.url)) {
  const runName = process.argv[2];
  if (!runName) {
    console.error('사용법: node clone-harness/scripts/new-run.mjs <run-name>');
    process.exit(2);
  }
  const r = newRun(runName);
  console.log(`✓ 새 run: ${path.relative(process.cwd(), r.root)}`);
  console.log(r.created.length ? `  생성: ${r.created.join(', ')}` : '  (이미 존재 — 건드리지 않음)');
  console.log('  다음: design/ 을 2단계로 채우고, src/ 를 3단계로 구현한 뒤 `npm run loop -- ' + runName + '`');
}
