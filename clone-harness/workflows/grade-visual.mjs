export const meta = {
  name: 'grade-visual',
  description: '독립 채점관들이 컴포넌트 스크린샷을 holistic 채점 — 구현한 에이전트가 자기 작업을 채점하지 않도록(측정자 ≠ 구현자)',
  phases: [{ title: 'Grade', detail: '컴포넌트별 독립 서브에이전트가 샷을 보고 0~1 채점' }],
};

// args = { runName, items?: [{ id, shot, intent, expects, tokens }] }
// items 가 없으면 runName 으로 grade-inputs.mjs 를 실행해 스스로 모은다(독립).
let A = args;
if (typeof A === 'string') { try { A = JSON.parse(A); } catch { A = {}; } }
A = A || {};
const runName = A.runName;
let items = A.items || [];

const ITEMS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true,
        required: ['id', 'shot', 'intent'],
        properties: {
          id: { type: 'string' },
          shot: { type: 'string' },
          intent: { type: 'string' },
          expects: { type: 'object', additionalProperties: true },
          tokens: { type: 'object', additionalProperties: true },
        },
      },
    },
  },
};

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['score', 'notes'],
  properties: {
    score: { type: 'number', description: '0~1 holistic 충실도(위계·여백·정렬·완성도). 후하게 주지 말 것.' },
    notes: { type: 'string', description: '한 줄 수선 힌트(한국어)' },
  },
};

phase('Grade');

if (!items.length && !runName) {
  log('grade-visual: runName/items 가 비었음 — args 전달 확인 필요');
  return { grades: [], error: 'no-input' };
}

if (!items.length && runName) {
  const gathered = await agent(
    `Bash 로 \`node clone-harness/scripts/grade-inputs.mjs ${runName}\` 를 실행하고, 그 stdout 은 {runName, items:[...]} JSON 이다. 그 안의 items 배열을 그대로 반환하라(가공 금지).`,
    { label: 'gather-inputs', phase: 'Grade', schema: ITEMS_SCHEMA }
  );
  items = (gathered && gathered.items) || [];
}

const graded = await parallel(
  items.map((it) => () =>
    agent(
      `너는 **독립 UI 디자인 채점관**이다. 이 화면을 네가 만들지 않았다 — 만든 사람의 의도나 사정과 무관하게,
처음 보는 사람처럼 객관적·회의적으로 본다. (자기 작업을 후하게 봐주는 편향을 제거하는 게 목적)

먼저 스크린샷을 Read 도구로 직접 열어서 본 뒤 채점하라(추측 금지):
  샷 파일: ${it.shot}

채점 기준 — **holistic 측면만**: 위계(무엇이 1차 초점인가), 여백 리듬, 정렬의 짜임새, 전체적 완성도.
색/폰트/치수 같은 수치는 다른 결정론 신호가 따로 보므로 너는 보지 않는다.
비교 기준은 원본 사이트가 아니라 아래 "디자인 의도"다.

[컴포넌트 id] ${it.id}
[의도(intent)] ${it.intent}
[기대(expects)] ${JSON.stringify(it.expects)}
[참조 토큰(resolved)] ${JSON.stringify(it.tokens)}

0~1 점수와 한 줄 수선 힌트를 내라. 빈/깨진 샷이면 낮게.`,
      { label: `grade:${it.id}`, phase: 'Grade', schema: SCHEMA, isolation: undefined }
    ).then((g) => ({ id: it.id, score: g?.score ?? null, notes: g?.notes || '' }))
  )
);

// items 순서 보존. 실패(null)한 건 그대로 표시.
return { grades: graded };
