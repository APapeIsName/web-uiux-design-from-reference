// route — 판단자의 결정론 부분(원칙 1-1). 흐름만 정한다: advance/continue/call_human/halt.
// 비결정론(어떻게 고칠까)은 여기 없다 — 그건 continue 일 때 에이전트 본체의 일(DESIGN 9).
import { latestPerComponent, maxIter } from '../lib/log.mjs';

/** 컴포넌트 id 의 최근 stallWindow 회 개선폭이 모두 minDelta 미만이면 정체. */
export function isStalled(log, id, judge) {
  const { stallWindow, minDelta } = judge;
  const entries = log
    .filter((e) => e.component === id && e.aggregate != null) // 측정 불가 엔트리는 NaN 비교 방지차 제외
    .sort((a, b) => (a.iter ?? 0) - (b.iter ?? 0));
  if (entries.length < stallWindow + 1) return false; // 정체 판정엔 최소 이력 필요
  const recent = entries.slice(-(stallWindow + 1));
  for (let i = 1; i < recent.length; i++) {
    const delta = recent[i].aggregate - recent[i - 1].aggregate;
    if (delta >= minDelta) return false; // 한 번이라도 유효 진전 → 정체 아님
  }
  return true;
}

/** 컴포넌트별 최고 aggregate 엔트리 맵 — call_human/halt 에 첨부할 best-of. */
export function bestOf(log, components) {
  const best = {};
  for (const c of components) {
    const entries = log.filter((e) => e.component === c.id && e.aggregate != null);
    best[c.id] = entries.reduce((b, e) => (!b || e.aggregate > b.aggregate ? e : b), null);
  }
  return best;
}

/**
 * 로그를 읽고 흐름을 결정. 순수 함수(부수효과 없음, 테스트 가능, 재현됨).
 * 반환 action: advance | continue | call_human | halt_call_human
 */
export function route(log, components, config) {
  const latest = latestPerComponent(log);
  const allPassed = components.every((c) => latest[c.id]?.passed);
  if (allPassed) return { action: 'advance' };

  const iter = maxIter(log);
  if (iter >= config.maxIterations) {
    return { action: 'halt_call_human', reason: 'max_iterations', best: bestOf(log, components) };
  }

  const failing = components.filter((c) => !latest[c.id]?.passed);
  const stalled = failing.filter((c) => isStalled(log, c.id, config.judge));
  if (stalled.length === failing.length && stalled.length > 0) {
    return {
      action: 'call_human',
      reason: 'stall',
      stalled: stalled.map((c) => c.id),
      best: bestOf(log, components),
    };
  }

  return { action: 'continue', targets: failing.map((c) => c.id) };
}
