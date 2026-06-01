// loop — 4번 루프 '한 바퀴' 오케스트레이터(DESIGN 10).
//   assemble → serve(capture 내부) → capture → score → route
// route 가 continue 를 주면 에이전트가 axes.notes 를 읽고 src/components/<id>.html 을 고친 뒤
// 이 스크립트를 다시 부른다. 편집은 스크립트가 자동화하지 않는다(원칙 1-1, DESIGN 9).
//
// `--audit` 모드: export 후 dist/fragment.audit.html 을 렌더해 마지막 재채점(원칙 1-5).
import path from 'node:path';
import { runPaths, isMain } from '../lib/paths.mjs';
import { validateRun } from '../lib/validate.mjs';
import { readLog } from '../lib/log.mjs';
import { assemble } from '../scripts/assemble.mjs';
import { captureAll } from '../scripts/capture.mjs';
import { scoreAll } from '../scripts/score.mjs';
import { exportFragment } from '../scripts/export.mjs';
import { route } from './route.mjs';

function printScores(entries) {
  for (const e of entries) {
    const mark = e.passed ? '✓ PASS' : '· ----';
    const agg = e.aggregate == null ? '측정불가' : e.aggregate;
    console.log(`  ${mark}  ${e.component.padEnd(16)} ${agg} / ${e.threshold}`);
    if (e.degraded) console.log(`           ⚠ 미측정(요구된 신호): ${e.degraded.join(', ')} — 통과 보류(키/설정 확인)`);
    for (const [ax, v] of Object.entries(e.axes)) {
      if (v.notes) console.log(`           ${ax}: ${v.score == null ? 'skip' : v.score.toFixed(2)} — ${v.notes}`);
    }
  }
}

function printDecision(decision, components, log) {
  console.log('\n── route ──────────────────────────────');
  switch (decision.action) {
    case 'advance':
      console.log('  ▶ advance — 전 컴포넌트 통과. 사람 게이트로 올림(디자인/구현 완성).');
      break;
    case 'continue':
      console.log(`  ↻ continue — 진전 중. 다음 회차 수선 타깃: ${decision.targets.join(', ')}`);
      console.log('    에이전트: 위 axes.notes 를 읽고 해당 src/components/<id>.html 을 고친 뒤 loop 재실행.');
      break;
    case 'call_human':
      console.log(`  ☎ call_human(stall) — 정체: ${decision.stalled.join(', ')}. 사람이 방향/스펙 손볼 것.`);
      printBest(decision.best);
      break;
    case 'halt_call_human':
      console.log('  ⛔ halt(max_iterations) — 회차 소진. best-of 첨부, "이게 최선, 받을래 더 갈래".');
      printBest(decision.best);
      break;
    default:
      console.log('  ? 알 수 없는 결정:', decision);
  }
}

function printBest(best) {
  if (!best) return;
  console.log('    best-of:');
  for (const [id, e] of Object.entries(best)) {
    console.log(`      ${id}: ${e ? `${e.aggregate} @ iter ${e.iter}` : '기록 없음'}`);
  }
}

/** 1단계: assemble → capture. 샷/ computed 만 생산하고 멈춘다(에이전트 시각 채점 틈). */
export async function loopCapture(runName) {
  assemble(runName);
  const manifest = await captureAll(runName, { which: 'src' });
  const capErrors = manifest.filter((m) => m.error);
  if (capErrors.length) {
    console.error('\n캡처 실패(셀렉터 못 찾음 — data-component 계약 확인):');
    for (const e of capErrors) console.error(`  ✗ ${e.id}: ${e.error}`);
    throw new Error('capture 실패로 중단');
  }
  console.log(`✓ capture: ${manifest.length} 컴포넌트 → work/shots/`);
  const p = runPaths(runName);
  for (const m of manifest) console.log(`    ${m.id}: ${path.relative(process.cwd(), m.shot)}`);
  // visual provider 가 agent 면 안내
  const visual = validateRun(runName).config.signals?.visual;
  if (visual?.enabled !== false && (visual?.provider || 'api') === 'agent') {
    console.log(`\n  visual=agent: 위 샷을 보고 work/visual-grades.json 에 {"<id>":{"score":0~1,"notes":"..."}} 를 쓴 뒤`);
    console.log(`  'npm run loop -- ${runName} --score-only' 로 채점·라우팅.`);
  }
  return manifest;
}

/** 2단계: score → route. (visual=agent 면 work/visual-grades.json 의 에이전트 점수를 읽는다.) */
export async function loopScoreRoute(runName) {
  const { components, config } = validateRun(runName);
  const { iter, entries } = await scoreAll(runName);
  console.log(`\n── score (iter ${iter}) ─────────────────`);
  printScores(entries);

  const log = readLog(runPaths(runName).log);
  const decision = route(log, components, config);
  printDecision(decision, components, log);
  return { iter, entries, decision };
}

/** 한 바퀴(단발): assemble → capture → score → route. visual=api/off 일 때 자율 실행용. */
export async function loopOnce(runName) {
  console.log(`\n══ loop ${runName} ══════════════════════`);
  await loopCapture(runName);
  return loopScoreRoute(runName);
}

/** 마지막 재채점: export 후 dist/fragment.audit.html 을 렌더해 "채점한 것 = 올리는 것" 확인. */
export async function auditRescore(runName) {
  const { components, config } = validateRun(runName);
  console.log(`\n══ audit re-score ${runName} ══════════`);
  const r = exportFragment(runName);
  console.log(`  export: ${path.basename(r.fragment)}, ${path.basename(r.audit)}`);
  const manifest = await captureAll(runName, { which: 'dist' });
  const capErrors = manifest.filter((m) => m.error);
  if (capErrors.length) {
    console.error('\n재채점 캡처 실패 — export 가 data-component 를 떨궜는지 확인:');
    for (const e of capErrors) console.error(`  ✗ ${e.id}: ${e.error}`);
    throw new Error('audit capture 실패');
  }
  // 별도 로그(audit-log.json)에 단발 기록 — dev 루프의 iter/시계열을 오염시키지 않는다(원칙 1-5).
  const { iter, entries } = await scoreAll(runName, { iter: 1, logPath: runPaths(runName).auditLog, source: 'audit' });
  console.log(`\n── audit score (iter ${iter}) ───────────`);
  printScores(entries);
  const allPassed = components.every((c) => entries.find((e) => e.component === c.id)?.passed);
  console.log(allPassed ? '\n  ✓ 납품본도 통과 — 채점한 것 = 올리는 것' : '\n  ✗ 납품본에서 점수 하락 — export 변환이 무언가 바꿈');
  return { iter, entries, allPassed };
}

if (isMain(import.meta.url)) {
  const runName = process.argv[2];
  const args = process.argv.slice(3);
  if (!runName) {
    console.error('사용법: node clone-harness/judge/loop.mjs <run-name> [--capture-only|--score-only|--audit]');
    process.exit(2);
  }
  if (args.includes('--audit')) await auditRescore(runName);
  else if (args.includes('--capture-only')) await loopCapture(runName);
  else if (args.includes('--score-only')) await loopScoreRoute(runName);
  else await loopOnce(runName);
}
