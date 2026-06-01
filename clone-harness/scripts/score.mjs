// score — 채점기. 측정만 한다(원칙 1-1). 점수 + 피드백 생산, 소비 안 함.
// 출력 = work/log.json 한 줄. aggregate/passed → 판단자(결정), axes[*].notes → 에이전트(수선).
import fs from 'node:fs';
import path from 'node:path';
import { runPaths, engineResolve, isMain } from '../lib/paths.mjs';
import { resolveTokens } from '../lib/tokens.mjs';
import { validateFile } from '../lib/validate.mjs';
import { appendLog, readLog, maxIter } from '../lib/log.mjs';

const VISUAL_KEY = 'visual'; // 비싼 멀티모달 신호 — early-out 대상

// 신호 모듈 동적 로드(레지스트리 = config.signals). 플러그인 이음새가 사는 곳.
const _cache = new Map();
async function loadSignal(key, reg) {
  if (_cache.has(key)) return _cache.get(key);
  const mod = await import(engineResolve(reg.module));
  if (typeof mod.run !== 'function') throw new Error(`신호 "${key}" 모듈에 export run() 이 없음: ${reg.module}`);
  _cache.set(key, mod.run);
  return mod.run;
}

// 가중합 — enabled=false/weight=0/score=null 은 제외, 합≠1 이면 정규화.
// 참여 신호가 전부 측정 불가(null)면 null 반환(= "측정 불가" ≠ "0점"). 0 으로 환원하면
// passed=false 가 영구 고정되고 정체 오판으로 이어진다(검증 m8).
function aggregate(results, weights) {
  let wsum = 0;
  let acc = 0;
  for (const [k, w] of Object.entries(weights)) {
    if (!(w > 0)) continue;
    const r = results[k];
    if (!r || r.score == null) continue;
    wsum += w;
    acc += w * r.score;
  }
  return wsum > 0 ? acc / wsum : null;
}

function axesFrom(results) {
  const axes = {};
  for (const [k, r] of Object.entries(results)) {
    axes[k] = { score: r.score, notes: r.notes || '' };
  }
  return axes;
}

/**
 * 한 컴포넌트 채점. ctx: { runName, paths, ds, config, iter, spec, shot, computed, logPath?, source? }
 * 반환: log 엔트리. (append 도 한다)
 */
export async function scoreComponent(ctx) {
  const { config, spec, shot, computed, ds, paths, iter, runName, source } = ctx;
  const logPath = ctx.logPath ?? paths.log;

  const tokens = resolveTokens(ds, spec.tokens || []);
  config._run = { paths, runName, iter };

  const weights = spec.scoring?.weights ?? config.defaultWeights;
  const threshold = spec.scoring?.threshold ?? config.defaultThreshold;

  // 참여 신호: 레지스트리 enabled !== false AND weight > 0
  const participating = Object.keys(config.signals).filter(
    (k) => config.signals[k]?.enabled !== false && (weights[k] ?? 0) > 0
  );

  const results = {};
  const runArgs = { shot, computed, spec, tokens, config };

  // 1) 결정론(visual 외) 먼저 — early-out 판단용
  for (const key of participating) {
    if (key === VISUAL_KEY) continue;
    const run = await loadSignal(key, config.signals[key]);
    results[key] = await run(runArgs);
  }

  // 2) early-out(비대칭): visual 이 참여하면, "best-case 로도 임계치 미달"일 때만 스킵.
  //    통과권에선 항상 풀 채점(안 그러면 시각 점수가 로그에 안 남아 정체 감지에 구멍).
  if (participating.includes(VISUAL_KEY)) {
    const bestCase = aggregate({ ...results, [VISUAL_KEY]: { score: 1 } }, weights);
    if (bestCase < threshold) {
      results[VISUAL_KEY] = { score: null, notes: 'early-out: 결정론만으로 명백 미달 → visual 스킵', detail: { earlyOut: true } };
    } else {
      const run = await loadSignal(VISUAL_KEY, config.signals[VISUAL_KEY]);
      results[VISUAL_KEY] = await run(runArgs);
    }
  }

  const agg = aggregate(results, weights);
  const measurable = agg != null;

  // 참여하기로 한(enabled & weight>0) 신호가 측정 실패(score==null)했고, 그게 의도된
  // early-out 이 아니면 "degraded". 통과권에서 요구 축을 못 쟀는데 조용히 통과시키지 않는다(검증 M1).
  const degraded = participating.filter((k) => {
    const r = results[k];
    return r && r.score == null && !r.detail?.earlyOut;
  });

  // 측정 불가이거나 요구 축 미측정이면 통과 불가 — route 가 advance 로 새지 않게.
  const passed = measurable && degraded.length === 0 && agg >= threshold;

  const entry = {
    iter,
    component: spec.id,
    aggregate: measurable ? Number(agg.toFixed(4)) : null,
    threshold,
    passed,
    ...(degraded.length ? { degraded } : {}),
    ...(measurable ? {} : { unmeasurable: true }),
    ...(source ? { source } : {}),
    axes: axesFrom(results),
    ts: new Date().toISOString(),
  };
  appendLog(logPath, entry);
  return entry;
}

/**
 * 한 run 의 모든 컴포넌트 채점. computed/shot 은 work/shots 에서 읽는다.
 * logPath/source 로 dev 루프와 audit 재채점을 분리한다(검증 M2): audit 는 별도 파일에 쓴다.
 */
export async function scoreAll(runName, { iter, logPath, source } = {}) {
  const paths = runPaths(runName);
  const ds = validateFile('designSystem', paths.designSystem);
  const { components } = validateFile('components', paths.componentsJson);
  const config = validateFile('config', paths.config);

  const targetLog = logPath ?? paths.log;
  const useIter = iter ?? maxIter(readLog(targetLog)) + 1;

  const entries = [];
  for (const spec of components) {
    const shot = path.join(paths.shots, `${spec.id}.png`);
    const computedFile = path.join(paths.shots, `${spec.id}.computed.json`);
    if (!fs.existsSync(computedFile)) {
      throw new Error(`score: ${spec.id} 의 computed 가 없음(${computedFile}). 먼저 capture 를 돌리세요.`);
    }
    const computed = JSON.parse(fs.readFileSync(computedFile, 'utf8'));
    entries.push(
      await scoreComponent({
        runName,
        paths,
        ds,
        config,
        iter: useIter,
        logPath: targetLog,
        source,
        spec,
        shot: fs.existsSync(shot) ? shot : null,
        computed,
      })
    );
  }
  return { iter: useIter, entries };
}

if (isMain(import.meta.url)) {
  const runName = process.argv[2];
  if (!runName) {
    console.error('사용법: node clone-harness/scripts/score.mjs <run-name>');
    process.exit(2);
  }
  const { iter, entries } = await scoreAll(runName);
  console.log(`# iter ${iter}`);
  for (const e of entries) {
    const mark = e.passed ? '✓' : '·';
    const agg = e.aggregate == null ? '측정불가' : e.aggregate;
    const tail = e.degraded ? `  ⚠ 미측정(요구됨): ${e.degraded.join(', ')}` : '';
    console.log(`${mark} ${e.component}: ${agg} / ${e.threshold}${tail}`);
    for (const [ax, v] of Object.entries(e.axes)) {
      if (v.notes) console.log(`    ${ax}: ${v.score == null ? 'skip' : v.score.toFixed(2)} — ${v.notes}`);
    }
  }
}
