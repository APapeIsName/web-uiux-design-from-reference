// export — 납품 어댑터 디스패처. 어떤 형태로 포장할지는 교체 가능한 "어댑터"가 결정한다.
// config.export.adapter 로 고르고, config.export.adapters(+ 내장 기본)가 레지스트리.
//   - cafe24-fragment : 에디터에 통째로 붙이는 단일 정적 조각(현재 기본)
//   - cafe24-skin     : 카페24 스킨 섹션 파일 + 모듈 클래스 타깃 CSS (예정)
// 레퍼런스→디자인→구현→채점 루프는 어댑터와 무관하게 공유된다. 맨 끝 "포장"만 다름.
import path from 'node:path';
import { runPaths, engineResolve, isMain } from '../lib/paths.mjs';
import { validateFile } from '../lib/validate.mjs';

// 내장 어댑터(엔진 루트 기준 경로). config.export.adapters 로 덮어쓰기/추가 가능.
const BUILTIN_ADAPTERS = {
  'cafe24-fragment': 'export/cafe24-fragment.mjs',
  'cafe24-skin': 'export/cafe24-skin.mjs',
};

export async function runExport(runName, opts = {}) {
  const paths = runPaths(runName);
  const config = validateFile('config', paths.config);
  const exCfg = config.export || {};
  const adapterId = opts.adapter || exCfg.adapter || 'cafe24-fragment';
  const registry = { ...BUILTIN_ADAPTERS, ...(exCfg.adapters || {}) };
  const modPath = registry[adapterId];
  if (!modPath) {
    throw new Error(`export: 알 수 없는 어댑터 "${adapterId}". 등록됨: ${Object.keys(registry).join(', ')}`);
  }
  const mod = await import(engineResolve(modPath));
  if (typeof mod.run !== 'function') {
    throw new Error(`export 어댑터 "${adapterId}"(${modPath}) 에 export run() 이 없음`);
  }
  const result = await mod.run({ runName, paths, config, opts });
  return { adapter: adapterId, ...result };
}

if (isMain(import.meta.url)) {
  const runName = process.argv[2];
  if (!runName) {
    console.error('사용법: node clone-harness/scripts/export.mjs <run-name> [--adapter=<id>] [--strip]');
    process.exit(2);
  }
  const adapterArg = (process.argv.find((a) => a.startsWith('--adapter=')) || '').split('=')[1];
  const r = await runExport(runName, { adapter: adapterArg, strip: process.argv.includes('--strip') });
  console.log(`✓ export [${r.adapter}]`);
  for (const o of r.outputs || []) console.log(`  → ${path.relative(process.cwd(), o.path)}  (${o.label})`);
}
