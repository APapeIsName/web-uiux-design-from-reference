// design-preview — 도출된 design/(토큰 + 컴포넌트 선언)을 '눈으로 보는' 스펙 시트로 렌더.
// 구현(3단계) 전에 사람이 디자인 자체를 검토하는 게이트용. 원본 썸네일과 나란히 둬서 충실도 판단을 돕는다.
// 출력: design/preview.html (run 루트에서 serve 하면 ../reference/*.png 도 같이 보임).
import fs from 'node:fs';
import { runPaths, isMain } from '../lib/paths.mjs';
import { validateFile } from '../lib/validate.mjs';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function colorBlock(group, map) {
  const items = Object.entries(map)
    .map(([k, v]) => {
      if (v && typeof v === 'object') return colorBlock(`${group}.${k}`, v);
      return `<figure class="sw"><span class="chip" style="background:${esc(v)}"></span>
        <figcaption><code>${esc(group)}.${esc(k)}</code><b>${esc(v)}</b></figcaption></figure>`;
    })
    .join('');
  return items;
}

function typeScale(size) {
  return Object.entries(size)
    .map(([k, v]) => `<div class="trow"><code>type.size.${esc(k)} · ${esc(v)}</code>
      <div style="font-size:${esc(v)};line-height:1.1">다람쥐 헌 쳇바퀴 Aa 가나다 123</div></div>`)
    .join('');
}

function spaceScale(space) {
  return Object.entries(space)
    .map(([k, v]) => `<div class="srow"><code>space.${esc(k)} · ${esc(v)}</code><span class="sbar" style="width:${esc(v)}"></span></div>`)
    .join('');
}

function radiusScale(radius) {
  return Object.entries(radius)
    .map(([k, v]) => `<figure class="sw"><span class="rad" style="border-radius:${esc(v)}"></span>
      <figcaption><code>radius.${esc(k)}</code><b>${esc(v)}</b></figcaption></figure>`)
    .join('');
}

function weightBars(weights = {}) {
  const max = Math.max(0.0001, ...Object.values(weights).map((w) => Number(w) || 0));
  return Object.entries(weights)
    .map(([k, w]) => `<div class="wbar"><span>${esc(k)}</span><i style="width:${((Number(w) || 0) / max) * 100}%"></i><em>${esc(w)}</em></div>`)
    .join('');
}

function componentCard(c, i) {
  const expects = Object.entries(c.expects || {})
    .filter(([k]) => k !== 'assert')
    .map(([k, v]) => `<li><code>${esc(k)}</code> ${esc(typeof v === 'string' ? v : JSON.stringify(v))}</li>`)
    .join('');
  const asserts = (c.expects?.assert || [])
    .map((a) => `<span class="pill">${esc(a.target ?? 'self')}.${esc(a.metric)} ${esc(a.op)} ${esc(a.value)}${a.tol != null ? `±${esc(a.tol)}` : ''}</span>`)
    .join('');
  const tokens = (c.tokens || []).map((t) => `<span class="tok">${esc(t)}</span>`).join('');
  return `<section class="card">
    <header><span class="num">${i + 1}</span><h3>${esc(c.id)}</h3>
      <span class="thr">threshold ${esc(c.scoring?.threshold ?? '(config 기본)')}</span></header>
    <p class="intent">${esc(c.intent)}</p>
    ${expects ? `<ul class="expects">${expects}</ul>` : ''}
    ${asserts ? `<div class="asserts">숫자 단언: ${asserts}</div>` : ''}
    ${tokens ? `<div class="tokens">${tokens}</div>` : ''}
    <div class="weights">${weightBars(c.scoring?.weights)}</div>
  </section>`;
}

export function generate(runName) {
  const p = runPaths(runName);
  const ds = validateFile('designSystem', p.designSystem);
  const { components } = validateFile('components', p.componentsJson);

  const colors = Object.entries(ds.color).map(([g, m]) => `<div class="grp"><h4>color.${esc(g)}</h4><div class="row">${colorBlock(g, m)}</div></div>`).join('');
  const fams = Object.entries(ds.type.family).map(([k, v]) => `<div class="trow"><code>type.family.${esc(k)}</code><div style="font-family:${esc(v)};font-size:22px">${esc(v)} · 다람쥐 Aa 123</div></div>`).join('');

  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>DESIGN 미리보기 · ${esc(runName)}</title>
<style>
  :root{font-family:'Pretendard',system-ui,sans-serif;color:#16181d}
  *{box-sizing:border-box} body{margin:0;background:#fafafa;line-height:1.5}
  .wrap{max-width:1100px;margin:0 auto;padding:32px}
  h1{font-size:28px;margin:0 0 4px} .sub{color:#6b7280;margin:0 0 24px}
  h2{font-size:20px;margin:40px 0 12px;padding-top:16px;border-top:2px solid #eee}
  h4{margin:16px 0 8px;font-size:13px;color:#6b7280}
  .banner{background:#fff;border:1px solid #eee;border-radius:12px;padding:16px;margin-bottom:8px}
  .banner img{width:100%;border-radius:8px;display:block}
  .note{background:#fffbe6;border:1px solid #ffe58f;border-radius:8px;padding:10px 14px;font-size:13px;color:#7a5c00}
  .row{display:flex;flex-wrap:wrap;gap:14px}
  .sw{margin:0;text-align:center} .chip{display:block;width:84px;height:56px;border-radius:8px;border:1px solid #0001}
  .rad{display:block;width:84px;height:56px;background:#cfd8dc} figcaption{font-size:11px;margin-top:6px}
  figcaption code{display:block;color:#6b7280} figcaption b{font-size:12px}
  .trow{padding:8px 0;border-bottom:1px solid #f0f0f0} .trow code{color:#6b7280;font-size:12px}
  .srow{display:flex;align-items:center;gap:12px;padding:4px 0} .srow code{width:160px;color:#6b7280;font-size:12px}
  .sbar{height:14px;background:#16a34a;border-radius:4px;display:inline-block}
  .cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px}
  .card{background:#fff;border:1px solid #eee;border-radius:12px;padding:16px}
  .card header{display:flex;align-items:center;gap:8px;margin-bottom:8px}
  .num{background:#16a34a;color:#fff;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font-size:12px}
  .card h3{margin:0;font-size:16px;flex:1} .thr{font-size:11px;color:#6b7280}
  .intent{margin:0 0 10px;font-size:14px} .expects{margin:0 0 10px;padding-left:16px;font-size:12px;color:#444}
  .expects code{color:#16a34a} .asserts{font-size:12px;margin-bottom:8px}
  .pill{display:inline-block;background:#eef7f0;color:#0e5a33;border-radius:999px;padding:2px 8px;margin:2px;font-size:11px}
  .tokens{margin-bottom:10px} .tok{display:inline-block;background:#f3f4f6;border-radius:6px;padding:2px 7px;margin:2px;font-size:11px;color:#374151}
  .weights .wbar{display:flex;align-items:center;gap:8px;font-size:11px;margin:2px 0}
  .wbar span{width:80px;color:#6b7280} .wbar i{height:8px;background:#16a34a;border-radius:4px;min-width:1px} .wbar em{color:#6b7280;font-style:normal}
</style></head><body><div class="wrap">
  <h1>DESIGN 미리보기 — ${esc(runName)}</h1>
  <p class="sub">구현(3단계) 전에 '도출된 디자인'을 검토하는 게이트. 토큰 + 컴포넌트 선언을 눈으로 확인하고 원본과 대조한다(원칙 1-2: 베끼기 아닌 재해석).</p>

  <h2>원본 레퍼런스 (대조용)</h2>
  <div class="banner"><img src="../reference/source-fold.png" alt="reference fold"
    onerror="this.parentNode.innerHTML='<p class=note>원본 썸네일을 찾을 수 없음 — run 루트에서 serve 했는지 확인</p>'"></div>
  <p class="note">이 디자인이 위 원본의 <b>밀도·에너지·구성</b>을 (베끼지 않고) 충분히 재해석해 담았는지 보라.</p>

  <h2>색 (color)</h2>${colors}
  <h2>타이포 (type)</h2>${fams}${typeScale(ds.type.size)}
  <h2>간격 (space)</h2>${spaceScale(ds.space)}
  <h2>라운드 (radius)</h2><div class="row">${radiusScale(ds.radius)}</div>
  <h2>컴포넌트 (${components.length}) — 배열 순서 = 페이지 흐름</h2>
  <div class="cards">${components.map(componentCard).join('')}</div>
</div></body></html>`;

  fs.writeFileSync(p.designPreview ?? `${p.design}/preview.html`, html, 'utf8');
  return `${p.design}/preview.html`;
}

if (isMain(import.meta.url)) {
  const runName = process.argv[2];
  if (!runName) {
    console.error('사용법: node clone-harness/scripts/design-preview.mjs <run-name>');
    process.exit(2);
  }
  const out = generate(runName);
  console.log(`✓ 디자인 미리보기 → ${out}`);
  console.log(`  보기: npm run serve -- ${runName} root  →  http://127.0.0.1:4173/design/preview.html`);
}
