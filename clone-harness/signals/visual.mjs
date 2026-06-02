// 시각 신호 — holistic 만(위계·여백 리듬·전체 충실도 등 숫자로 환원 안 되는 것).
// 특별취급 없이 "신호 하나"(DESIGN 5/7). 누가 그 측정을 수행하느냐는 provider 로 교체 가능(재사용 이음새):
//   - "agent"(기본): **독립 채점관**이 샷을 보고 work/visual-grades.json 에 쓴 점수를 읽는다. API 키 불필요.
//       ⚠️ 측정자 ≠ 구현자(원칙 1-1). 컴포넌트를 구현한 에이전트가 자기 작업을 채점하면 편향이 생긴다.
//       그래서 채점은 grade-visual 워크플로(구현 맥락 없는 독립 서브에이전트들)가 채운다. 구현 에이전트가 직접 점수를 쓰지 말 것.
//   - "api"        : Anthropic SDK 직접 호출(ANTHROPIC_API_KEY 필요). 사람/에이전트 없는 자율 실행용.
import fs from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';

const SYSTEM = `너는 엄격한 UI 디자인 채점관이다. 스크린샷 하나가 주어진 "디자인 의도(intent/expects)"와
참조 토큰을 holistic 하게 얼마나 충실히 반영했는지 0~1 로 채점한다. 비교 기준은 원본 사이트가 아니라
주어진 디자인 의도다. 숫자로 환원 가능한 색/폰트/치수는 다른 결정론 신호가 따로 보므로, 너는
위계(무엇이 1차 초점인가), 여백 리듬, 정렬의 짜임새, 전체적 완성도 같은 holistic 측면만 본다.
반드시 아래 JSON 만 출력한다. 다른 텍스트·마크다운·코드펜스 금지.
{"score": <0~1 숫자>, "notes": "<한 줄 수선 힌트, 한국어>"}`;

function clampScore(s) {
  return Math.max(0, Math.min(1, s));
}

// ── provider: agent ── 독립 채점관(구현자 ≠ 채점자, grade-visual 워크플로)이 써둔 점수를 읽는다.
// 형식: { "<componentId>": { "score": 0~1, "notes": "..." }, ... }
function runAgent({ spec, config }) {
  const work = config?._run?.paths?.work;
  if (!work) {
    return { score: null, detail: { provider: 'agent' }, notes: 'visual(agent): _run.paths 없음' };
  }
  const file = path.join(work, 'visual-grades.json');
  if (!fs.existsSync(file)) {
    return {
      score: null,
      detail: { provider: 'agent', file },
      notes: 'visual(agent): 에이전트 채점 대기 — work/visual-grades.json 없음(샷 보고 작성)',
    };
  }
  let grades;
  try {
    grades = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    return { score: null, detail: { provider: 'agent', error: String(err) }, notes: 'visual(agent): grades 파싱 실패' };
  }
  const g = grades[spec.id];
  if (!g || typeof g.score !== 'number') {
    return { score: null, detail: { provider: 'agent' }, notes: `visual(agent): "${spec.id}" 채점 없음` };
  }
  return { score: clampScore(g.score), detail: { provider: 'agent', raw: g }, notes: g.notes || '' };
}

function stripFences(text) {
  return String(text)
    .replace(/^\s*```(?:json)?/i, '')
    .replace(/```\s*$/i, '')
    .trim();
}

function safeParse(text) {
  const cleaned = stripFences(text);
  try {
    return JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        /* fallthrough */
      }
    }
    return null;
  }
}

// ── provider: api ── Anthropic SDK 직접 호출.
async function runApi({ shot, spec, tokens, config }) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { score: null, detail: { provider: 'api', skipped: true }, notes: 'visual(api) 스킵: ANTHROPIC_API_KEY 없음' };
  }
  if (!shot || !fs.existsSync(shot)) {
    return { score: null, detail: { provider: 'api', skipped: true }, notes: 'visual(api) 스킵: 샷 파일 없음' };
  }
  const model = config?.signals?.visual?.model || 'claude-sonnet-4-6';
  const data = fs.readFileSync(shot).toString('base64');
  const tokenLines = Object.entries(tokens || {}).map(([k, v]) => `  - ${k}: ${v}`).join('\n');
  const userText = `컴포넌트 id: ${spec.id}
의도(intent): ${spec.intent}
기대(expects): ${JSON.stringify(spec.expects || {}, null, 2)}
참조 토큰(resolved):
${tokenLines || '  (없음)'}

위 스크린샷이 이 의도를 holistic 하게 얼마나 충실히 반영했는지 채점하라.`;

  const client = new Anthropic();
  let resp;
  try {
    resp = await client.messages.create({
      model,
      max_tokens: 400,
      temperature: 0,
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/png', data } },
            { type: 'text', text: userText },
          ],
        },
      ],
    });
  } catch (err) {
    return { score: null, detail: { provider: 'api', error: String(err?.message || err) }, notes: `visual(api) 오류: ${err?.message || err}` };
  }

  const text = (resp.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  const parsed = safeParse(text);
  if (!parsed || typeof parsed.score !== 'number') {
    return { score: null, detail: { provider: 'api', raw: text }, notes: 'visual(api) 파싱 실패(JSON 아님)' };
  }
  return { score: clampScore(parsed.score), detail: { provider: 'api', model, raw: parsed }, notes: parsed.notes || '' };
}

export async function run(args) {
  const provider = args.config?.signals?.visual?.provider || 'api';
  if (provider === 'agent') return runAgent(args);
  return runApi(args);
}
