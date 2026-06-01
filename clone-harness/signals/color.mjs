// 색 신호 — 결정론. computed 의 실제 렌더색을 컴포넌트 tokens 의 resolve값과 deltaE 거리 비교.
// 비교 기준은 reference 가 아니라 design(=resolved tokens)임이 입력으로 박힘(원칙 1-2).
//
// 핵심: 토큰을 "컴포넌트 안 아무 색 중 최소 ΔE"가 아니라 "그 토큰이 의미하는 CSS 속성"과 매칭한다.
// (검증 M3) 안 그러면 어두운/중립 bg 토큰이 가까운 텍스트색에 구제돼 틀려도 ~1점이 나온다.
import { parseColor, deltaE, deltaEScore } from '../lib/color.mjs';

const ALL_FIELDS = ['backgroundColor', 'color', 'borderColor'];

// color.<group>.<name> 의 group 으로 비교할 CSS 속성을 좁힌다.
function fieldsForToken(dot) {
  const group = String(dot).split('.')[1]; // 'color'.<group>.<name>
  switch (group) {
    case 'bg':
    case 'background':
    case 'surface':
      return ['backgroundColor'];
    case 'text':
    case 'fg':
      return ['color'];
    case 'border':
    case 'line':
      return ['borderColor'];
    case 'brand':
    case 'accent':
      return ALL_FIELDS; // 강조색은 배경/텍스트/보더 어디든 쓰일 수 있음
    default:
      return ALL_FIELDS; // 매핑 불가 → 전체 풀 fallback
  }
}

// self + 직계 + 손자(2-depth) 평탄화 — 색은 깊은 노드에 있다(검색 버튼/카드 가격 등).
function allNodes(computed) {
  const out = [];
  if (computed.self) out.push(computed.self);
  const walk = (arr) => {
    for (const n of arr || []) {
      out.push(n);
      if (n.children) walk(n.children);
    }
  };
  walk(computed.children);
  return out;
}

function collectColors(computed, fields) {
  const nodes = allNodes(computed);
  const colors = [];
  for (const n of nodes) {
    for (const f of fields) {
      const p = parseColor(n.style?.[f]);
      if (p && p.a > 0.05) colors.push(p); // 투명은 비교에서 제외
    }
  }
  return colors;
}

export async function run({ computed, spec, tokens, config }) {
  const targetColors = (spec.tokens || [])
    .map((dot) => ({ dot, val: tokens[dot] }))
    .filter((t) => parseColor(t.val));

  if (targetColors.length === 0) {
    return { score: null, detail: { reason: 'no-color-tokens' }, notes: '색 토큰 없음 — 색 신호 스킵' };
  }

  const maxDeltaE = config?.signals?.color?.maxDeltaE ?? 50;
  const perToken = targetColors.map(({ dot, val }) => {
    // 1순위: 토큰이 의미하는 속성에서만 찾는다.
    let pool = collectColors(computed, fieldsForToken(dot));
    // 그 속성에 색이 전혀 없으면(예: 모든 배경이 투명) 전체 풀로 한 번 더(빈 샷과 구분).
    if (pool.length === 0) pool = collectColors(computed, ALL_FIELDS);
    if (pool.length === 0) return { dot, val, deltaE: Infinity, score: 0 };

    let best = Infinity;
    for (const rc of pool) {
      const d = deltaE(val, rc);
      if (d != null && d < best) best = d;
    }
    return { dot, val, deltaE: best, score: deltaEScore(best, maxDeltaE) };
  });

  if (perToken.every((t) => t.deltaE === Infinity)) {
    return { score: 0, detail: { reason: 'no-rendered-colors' }, notes: '렌더된 색을 못 찾음(빈 샷 의심)' };
  }

  const score = perToken.reduce((s, t) => s + t.score, 0) / perToken.length;
  const worst = perToken.reduce((w, t) => (t.score < w.score ? t : w), perToken[0]);
  const notes =
    worst.score < 0.9
      ? `색 ${worst.dot}(${worst.val}) 가장 멀음 (ΔE≈${Number.isFinite(worst.deltaE) ? worst.deltaE.toFixed(1) : '∞'})`
      : '';

  return { score, detail: { perToken, maxDeltaE }, notes };
}
