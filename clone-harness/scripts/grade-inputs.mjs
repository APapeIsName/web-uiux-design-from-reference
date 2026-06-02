// grade-inputs — visual=agent 독립 채점용 입력 추출기.
// 각 컴포넌트의 { id, shot 경로, intent, expects, resolve된 tokens } 를 JSON 으로 출력한다.
// 이걸 독립 채점관 서브에이전트들에게 넘긴다(구현한 에이전트가 자기 채점하지 않도록 — 측정자≠구현자).
import fs from 'node:fs';
import path from 'node:path';
import { runPaths, isMain } from '../lib/paths.mjs';
import { validateFile } from '../lib/validate.mjs';
import { resolveTokens } from '../lib/tokens.mjs';

export function gradeInputs(runName) {
  const p = runPaths(runName);
  const ds = validateFile('designSystem', p.designSystem);
  const { components } = validateFile('components', p.componentsJson);
  return components.map((c) => {
    const shot = path.join(p.shots, `${c.id}.png`);
    return {
      id: c.id,
      shot,
      shotExists: fs.existsSync(shot),
      intent: c.intent,
      expects: c.expects || {},
      tokens: resolveTokens(ds, c.tokens || []),
    };
  });
}

if (isMain(import.meta.url)) {
  const runName = process.argv[2];
  if (!runName) {
    console.error('사용법: node clone-harness/scripts/grade-inputs.mjs <run-name>');
    process.exit(2);
  }
  process.stdout.write(JSON.stringify({ runName, items: gradeInputs(runName) }));
}
