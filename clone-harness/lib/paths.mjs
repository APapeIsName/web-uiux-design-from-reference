// 엔진/실행 경로 해석. 엔진(clone-harness/)과 실행 인스턴스(runs/<name>/)를 가른다(원칙 1-4).
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)); // clone-harness/lib
export const ENGINE_ROOT = path.resolve(here, '..'); // clone-harness
export const REPO_ROOT = path.resolve(ENGINE_ROOT, '..'); // 저장소 루트 (clone-harness 와 runs 의 부모)

/** 한 실행 인스턴스의 모든 경로를 한 곳에서 해석한다 — 스크립트마다 경로를 재조립하지 않도록. */
export function runPaths(runName) {
  if (!runName) throw new Error('runPaths: runName 이 필요합니다 (예: "example")');
  const root = path.join(REPO_ROOT, 'runs', runName);
  return {
    runName,
    root,
    reference: path.join(root, 'reference'),
    design: path.join(root, 'design'),
    designSystem: path.join(root, 'design', 'design-system.json'),
    componentsJson: path.join(root, 'design', 'components.json'),
    designPreview: path.join(root, 'design', 'preview.html'),
    src: path.join(root, 'src'),
    components: path.join(root, 'src', 'components'),
    index: path.join(root, 'src', 'index.html'),
    tokensCss: path.join(root, 'src', 'tokens.css'),
    stylesCss: path.join(root, 'src', 'styles.css'),
    interactions: path.join(root, 'src', 'interactions.js'),
    work: path.join(root, 'work'),
    shots: path.join(root, 'work', 'shots'),
    log: path.join(root, 'work', 'log.json'),
    auditLog: path.join(root, 'work', 'audit-log.json'), // 납품본 재채점 전용(dev 로그와 분리)
    dist: path.join(root, 'dist'),
    fragment: path.join(root, 'dist', 'fragment.html'),
    audit: path.join(root, 'dist', 'fragment.audit.html'),
    config: path.join(root, 'config.json'),
  };
}

/** 엔진 기준 상대 모듈 경로(config 의 "signals/layout.mjs")를 절대 경로로. */
export function engineResolve(relPath) {
  return path.resolve(ENGINE_ROOT, relPath);
}

/** 이 모듈이 `node x.mjs` 로 직접 실행됐는지 — CLI 가드용. */
export function isMain(importMetaUrl) {
  const invoked = process.argv[1];
  if (!invoked) return false;
  return importMetaUrl === pathToFileURL(invoked).href;
}
