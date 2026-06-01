// capture — 신호의 입력을 생산한다. shot(PNG, 보는 용)과 computed(JSON, 재는 용)(DESIGN 6).
// computed 는 "요소 하나"가 아니라 "작은 트리"(루트 + 직계 자식), 신호가 쓰는 필드만 화이트리스트.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { runPaths, isMain } from '../lib/paths.mjs';
import { startServer } from './serve.mjs';
import { validateFile } from '../lib/validate.mjs';

// 신호가 보는 computed style 필드만. 신호 추가 시 같이 늘어남.
const STYLE_FIELDS = [
  'backgroundColor', 'color', 'borderColor',
  'fontFamily', 'fontSize', 'fontWeight', 'lineHeight',
  'display', 'flexDirection', 'justifyContent', 'alignItems',
  'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight',
  'borderRadius',
];

// 캡처 전 안정화 — 회차 간 jitter 제거(폰트/애니메이션/네트워크). 유령 점수 변동 방지.
async function stabilize(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({
    content: `*,*::before,*::after{ animation:none!important; transition:none!important; caret-color:transparent!important; }`,
  });
  // sticky/fixed → static: 격리(요소) 스크린샷이 스크롤 시 다른 컴포넌트 샷 위에 겹쳐 찍히는 것 방지(DESIGN 6 함정).
  // sticky 는 흐름 공간을 차지하므로 box/레이아웃 불변. fixed 는 흐름에 들어가며 비로소 box 가 생긴다(0-box 함정도 해소).
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('*')) {
      const pos = getComputedStyle(el).position;
      if (pos === 'sticky' || pos === 'fixed') el.style.setProperty('position', 'static', 'important');
    }
  });
  await page.waitForLoadState('networkidle').catch(() => {});
}

async function captureComponent(page, spec, outDir) {
  const sel = spec.selector || `[data-component="${spec.id}"]`;
  const root = page.locator(sel).first();

  const count = await root.count();
  if (count === 0) {
    return { id: spec.id, shot: null, computed: null, error: `셀렉터 못 찾음: ${sel}` };
  }

  // 화면 밖 요소(푸터 등) 빈 샷 방지
  await root.scrollIntoViewIfNeeded().catch(() => {});

  const shotPath = path.join(outDir, `${spec.id}.png`);
  await root.screenshot({ path: shotPath });

  // 루트 + 직계 자식 + 손자(2-depth)까지. 색·타이포는 깊은 노드에 있고(검색 버튼/카드 가격 등),
  // 레이아웃 기하는 직계 자식만 본다. 전체 DOM 은 폭발하므로 2-depth + 화이트리스트로 제한(DESIGN 6).
  const computed = await root.evaluate((el, fields) => {
    const pickFlat = (node) => {
      const cs = getComputedStyle(node);
      const r = node.getBoundingClientRect();
      const style = {};
      for (const f of fields) style[f] = cs[f];
      return {
        tag: node.tagName.toLowerCase(),
        role: node.getAttribute('data-role') || null,
        box: { x: r.x, y: r.y, w: r.width, h: r.height },
        style,
      };
    };
    const pickDeep = (node, depth) => {
      const o = pickFlat(node);
      if (depth > 0) o.children = [...node.children].map((c) => pickDeep(c, depth - 1));
      return o;
    };
    return { self: pickFlat(el), children: [...el.children].map((c) => pickDeep(c, 1)) };
  }, STYLE_FIELDS);

  fs.writeFileSync(path.join(outDir, `${spec.id}.computed.json`), JSON.stringify(computed, null, 2), 'utf8');
  return { id: spec.id, shot: shotPath, computed };
}

/**
 * 한 run 의 모든 컴포넌트를 캡처. 자체적으로 정적 서버를 띄웠다 닫는다.
 * which: 'src'(개발 index.html) | 'dist'(fragment.audit.html 재채점) — DESIGN 1-5.
 */
export async function captureAll(runName, { which = 'src' } = {}) {
  const p = runPaths(runName);
  const config = validateFile('config', p.config);
  const { components } = validateFile('components', p.componentsJson);

  fs.mkdirSync(p.shots, { recursive: true });

  const serveDir = which === 'dist' ? p.dist : p.src;
  const entry = which === 'dist' ? 'fragment.audit.html' : 'index.html';
  const { url, close } = await startServer(serveDir);

  const browser = await chromium.launch();
  const manifest = [];
  try {
    const page = await browser.newPage({ viewport: config.viewport });
    await page.goto(`${url}/${entry}`, { waitUntil: 'load' });
    await stabilize(page);
    for (const c of components) {
      manifest.push(await captureComponent(page, c, p.shots));
    }
  } finally {
    await browser.close();
    await close();
  }

  fs.writeFileSync(path.join(p.shots, 'manifest.json'), JSON.stringify({ which, manifest }, null, 2), 'utf8');
  return manifest;
}

if (isMain(import.meta.url)) {
  const runName = process.argv[2];
  const which = process.argv[3] || 'src';
  if (!runName) {
    console.error('사용법: node clone-harness/scripts/capture.mjs <run-name> [src|dist]');
    process.exit(2);
  }
  const manifest = await captureAll(runName, { which });
  for (const m of manifest) {
    console.log(m.error ? `✗ ${m.id}: ${m.error}` : `✓ ${m.id}: ${path.relative(process.cwd(), m.shot)}`);
  }
  // 셀렉터 못 찾음(data-component 계약 위반)을 비정상 종료로 보고 — 형제 CLI 의 exit 가드와 일관(검증 m10).
  if (manifest.some((m) => m.error)) process.exitCode = 1;
}
