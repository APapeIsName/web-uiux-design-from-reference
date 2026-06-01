// reference — 1단계 수집. 사용자가 준 레퍼런스 URL 을 캡처해 runs/<name>/reference/ 에 둔다.
// 산출물: source.png(풀페이지), source-fold.png(첫 화면), dom.html, meta.json(관찰용 원시 신호).
// 주의: 이건 2단계 디자인 도출의 '입력'일 뿐 채점 정답지가 아니다(원칙 1-2). 픽셀 1:1 복제 안 함.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { runPaths, isMain } from '../lib/paths.mjs';
import { validateFile } from '../lib/validate.mjs';

// 광고/쿠폰 팝업 닫기 — 레퍼런스 분석에 노이즈라 제거. (캡처 전용, 원본을 바꾸는 건 아님)
async function dismissPopups(page) {
  await page.keyboard.press('Escape').catch(() => {});
  const labels = ['오늘 하루', '오늘하루', '다시 보지', '그만 보기', '닫기', 'close', '✕', '×'];
  for (const t of labels) {
    const loc = page.getByText(t, { exact: false });
    const n = await loc.count().catch(() => 0);
    for (let i = 0; i < Math.min(n, 3); i++) {
      await loc.nth(i).click({ timeout: 800 }).catch(() => {});
    }
  }
  // 남은 대형 오버레이(첫 화면을 덮는 fixed/absolute, z-index 높은 것)만 숨김 — 얇은 헤더는 제외
  await page.evaluate(() => {
    const vw = innerWidth;
    const vh = innerHeight;
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      if (cs.position !== 'fixed' && cs.position !== 'absolute') continue;
      const r = el.getBoundingClientRect();
      const z = parseInt(cs.zIndex) || 0;
      const big = r.width > vw * 0.4 && r.height > vh * 0.4;
      if (big && r.top < vh * 0.5 && z >= 100) el.style.display = 'none';
    }
  }).catch(() => {});
  await page.waitForTimeout(400);
}

async function autoScroll(page) {
  // lazy-load 이미지/섹션 트리거 후 맨 위로 복귀
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let y = 0;
      const step = 600;
      const timer = setInterval(() => {
        window.scrollBy(0, step);
        y += step;
        if (y >= document.body.scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
  await page.waitForTimeout(800);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
}

export async function captureReference(runName, url, { viewport } = {}) {
  const p = runPaths(runName);
  let vp = viewport;
  if (!vp && fs.existsSync(p.config)) vp = validateFile('config', p.config).viewport;
  vp = vp || { width: 1440, height: 900 };

  fs.mkdirSync(p.reference, { recursive: true });

  const browser = await chromium.launch();
  const out = {};
  try {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => page.goto(url, { waitUntil: 'load', timeout: 60000 }));
    await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
    await dismissPopups(page);

    // 첫 화면
    const fold = path.join(p.reference, 'source-fold.png');
    await page.screenshot({ path: fold });
    out.fold = fold;

    // 풀페이지(lazy-load 후)
    await autoScroll(page);
    const full = path.join(p.reference, 'source.png');
    await page.screenshot({ path: full, fullPage: true });
    out.full = full;

    // DOM 스냅샷
    const dom = path.join(p.reference, 'dom.html');
    fs.writeFileSync(dom, await page.content(), 'utf8');
    out.dom = dom;

    // 관찰용 원시 신호(색/폰트 빈도) — 2단계 도출 참고용. 채점 정답지 아님.
    const meta = await page.evaluate(() => {
      const tally = (arr) => {
        const m = {};
        for (const v of arr) if (v) m[v] = (m[v] || 0) + 1;
        return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 12);
      };
      const els = [...document.querySelectorAll('body *')].slice(0, 4000);
      const bg = [];
      const color = [];
      const font = [];
      const size = [];
      for (const el of els) {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        if (r.width * r.height > 400) bg.push(cs.backgroundColor);
        color.push(cs.color);
        font.push(cs.fontFamily);
        size.push(cs.fontSize);
      }
      return {
        title: document.title,
        viewport: { w: window.innerWidth, h: window.innerHeight },
        scrollHeight: document.body.scrollHeight,
        topBackgrounds: tally(bg),
        topTextColors: tally(color),
        topFonts: tally(font),
        topFontSizes: tally(size),
      };
    });
    const metaPath = path.join(p.reference, 'meta.json');
    fs.writeFileSync(metaPath, JSON.stringify({ url, capturedViewport: vp, ...meta }, null, 2), 'utf8');
    out.meta = metaPath;
  } finally {
    await browser.close();
  }
  return out;
}

if (isMain(import.meta.url)) {
  const runName = process.argv[2];
  const url = process.argv[3];
  if (!runName || !url) {
    console.error('사용법: node clone-harness/scripts/reference.mjs <run-name> <url>');
    process.exit(2);
  }
  const out = await captureReference(runName, url);
  for (const [k, v] of Object.entries(out)) console.log(`✓ ${k}: ${path.relative(process.cwd(), v)}`);
}
