// 타이포 신호 — 결정론. computed 의 fontFamily/fontSize/fontWeight/lineHeight 를
// 컴포넌트 type.* 토큰의 resolve값과 비교. 비교 기준은 design(원칙 1-2).

// self + 직계 + 손자(2-depth) 평탄화 — 폰트 크기/패밀리는 깊은 노드에 있다(히어로 헤드라인 등).
function nodes(computed) {
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

function px(v) {
  if (v == null) return null;
  const m = String(v).match(/-?[0-9.]+/);
  return m ? Number.parseFloat(m[0]) : null;
}

function familyName(v) {
  // 'Pretendard', sans-serif → pretendard
  return String(v || '')
    .split(',')[0]
    .replace(/['"]/g, '')
    .trim()
    .toLowerCase();
}

function closeness(target, actual, scale) {
  if (actual == null) return null;
  return Math.max(0, 1 - Math.abs(target - actual) / scale);
}

export async function run({ computed, spec, tokens }) {
  const ns = nodes(computed);
  if (ns.length === 0) return { score: 0, detail: {}, notes: '노드 없음(빈 샷 의심)' };

  const checks = [];
  for (const dot of spec.tokens || []) {
    const val = tokens[dot];
    if (val == null) continue;

    if (dot.startsWith('type.family')) {
      const want = familyName(val);
      const got = ns.some((n) => familyName(n.style?.fontFamily).includes(want) || want.includes(familyName(n.style?.fontFamily)));
      checks.push({ dot, want: val, score: got ? 1 : 0 });
    } else if (dot.startsWith('type.size')) {
      const target = px(val);
      const actuals = ns.map((n) => px(n.style?.fontSize)).filter((x) => x != null);
      const best = actuals.length ? Math.max(...actuals.map((a) => closeness(target, a, Math.max(target * 0.5, 6)))) : null;
      checks.push({ dot, want: val, score: best ?? 0 });
    } else if (dot.startsWith('type.weight')) {
      const target = Number.parseFloat(val);
      const actuals = ns.map((n) => Number.parseFloat(n.style?.fontWeight)).filter((x) => !Number.isNaN(x));
      const best = actuals.length ? Math.max(...actuals.map((a) => closeness(target, a, 300))) : null;
      checks.push({ dot, want: val, score: best ?? 0 });
    } else if (dot.startsWith('type.leading')) {
      const target = Number.parseFloat(val);
      const actuals = ns
        .map((n) => {
          const lh = n.style?.lineHeight;
          const fs = px(n.style?.fontSize);
          const lhp = px(lh);
          // px 면 비율로 환산
          if (lhp != null && fs) return lhp / fs;
          // 'normal'(브라우저 기본) → 폰트 기본 비율 근사(~1.2). 0 점으로 집계 오염 방지(검증 M4).
          if (String(lh).trim() === 'normal') return 1.2;
          const num = Number.parseFloat(lh);
          return Number.isNaN(num) ? null : num;
        })
        .filter((x) => x != null);
      const best = actuals.length ? Math.max(...actuals.map((a) => closeness(target, a, 0.5))) : null;
      checks.push({ dot, want: val, score: best ?? 0 });
    }
  }

  if (checks.length === 0) {
    return { score: null, detail: { reason: 'no-type-tokens' }, notes: '타이포 토큰 없음 — 스킵' };
  }

  const score = checks.reduce((s, c) => s + c.score, 0) / checks.length;
  const worst = checks.reduce((w, c) => (c.score < w.score ? c : w), checks[0]);
  const notes = worst.score < 0.9 ? `타이포 ${worst.dot}(${worst.want}) 어긋남` : '';
  return { score, detail: { checks }, notes };
}
