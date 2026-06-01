// 레이아웃 신호 — 측정 가능한 것만 결정론. box 좌표가 진실, CSS 선언은 힌트(DESIGN 5/6).
// 두 갈래: (1) expects.assert 숫자 단언이 있으면 그게 하드 게이트. (2) 없으면 구조 정합성 점수.

function resolveTarget(computed, target = 'self') {
  if (target === 'self' || target == null) return computed.self;
  if (typeof target === 'number') return (computed.children || [])[target] || null;
  // data-role 문자열
  return (computed.children || []).find((c) => c.role === target) || null;
}

function metricVal(node, metric) {
  if (!node?.box) return null;
  return { w: node.box.w, h: node.box.h, x: node.box.x, y: node.box.y }[metric];
}

function evalAssertion(computed, a) {
  const node = resolveTarget(computed, a.target ?? 'self');
  const actual = metricVal(node, a.metric);
  if (actual == null) return { ...a, actual: null, pass: false, why: 'target/metric 못 찾음' };
  const tol = a.tol ?? 8;
  let pass;
  switch (a.op) {
    case '~': pass = Math.abs(actual - a.value) <= tol; break;
    case '<': pass = actual < a.value; break;
    case '>': pass = actual > a.value; break;
    case '<=': pass = actual <= a.value; break;
    case '>=': pass = actual >= a.value; break;
    case '==': pass = Math.abs(actual - a.value) <= (a.tol ?? 0); break; // 부동소수 box 라 strict=== 금지(검증 m11). tol 없으면 0=정확값
    default: pass = false;
  }
  return { ...a, actual, pass };
}

// 구조 정합성: 자식들이 부모 box 안에 있고, 0 크기가 없는가.
function structuralScore(computed) {
  const self = computed.self;
  const kids = computed.children || [];
  if (!self?.box || self.box.w <= 0 || self.box.h <= 0) {
    return { score: 0, notes: 'self box 가 비어있음 — 요소 없음/숨김/빈 샷 의심', detail: { selfBox: self?.box } };
  }
  if (kids.length === 0) {
    return { score: 1, notes: '', detail: { note: '자식 없음 — self box 존재로 통과' } };
  }
  const sb = self.box;
  let withinCount = 0;
  let zeroCount = 0;
  for (const k of kids) {
    if (!k.box || k.box.w <= 0 || k.box.h <= 0) {
      zeroCount++;
      continue;
    }
    const within =
      k.box.x >= sb.x - 1 &&
      k.box.y >= sb.y - 1 &&
      k.box.x + k.box.w <= sb.x + sb.w + 1 &&
      k.box.y + k.box.h <= sb.y + sb.h + 1;
    if (within) withinCount++;
  }
  const score = (withinCount + (kids.length - zeroCount - withinCount) * 0.5) / kids.length;
  const notes = zeroCount > 0 ? `자식 ${zeroCount}개가 0 크기` : '';
  return { score: Math.max(0, Math.min(1, score)), notes, detail: { kids: kids.length, withinCount, zeroCount } };
}

export async function run({ computed, spec }) {
  const asserts = spec.expects?.assert || [];
  const structural = structuralScore(computed);

  if (asserts.length === 0) {
    return { score: structural.score, detail: { mode: 'structural', ...structural.detail }, notes: structural.notes };
  }

  const results = asserts.map((a) => evalAssertion(computed, a));
  const passed = results.filter((r) => r.pass).length;
  const assertScore = passed / results.length;
  // 단언이 1차, 구조 정합성이 보조 (단언 0.7 + 구조 0.3)
  const score = assertScore * 0.7 + structural.score * 0.3;
  const failed = results.filter((r) => !r.pass);
  const notes =
    failed.length > 0
      ? `단언 미충족 ${failed.length}/${results.length}: ` +
        failed.map((f) => `${f.target ?? 'self'}.${f.metric}${f.op}${f.value}(실측 ${f.actual})`).join(', ')
      : structural.notes;

  return { score, detail: { mode: 'assert', results, structural: structural.detail }, notes };
}
