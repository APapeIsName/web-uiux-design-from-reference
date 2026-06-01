// work/log.json — 채점기의 유일한 출력. 한 줄(JSONL) append. 두 소비처로 갈라짐:
// aggregate/passed → 판단자(결정), axes[*].notes → 에이전트(수선). 채점기는 생산만(DESIGN 7).
import fs from 'node:fs';
import path from 'node:path';

/** 한 회차 한 컴포넌트의 채점 결과 한 줄을 append. */
export function appendLog(logPath, entry) {
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(logPath, JSON.stringify(entry) + '\n', 'utf8');
}

/** log.json 전체를 엔트리 배열로 읽는다. 없으면 빈 배열. 깨진 줄은 건너뛴다. */
export function readLog(logPath) {
  if (!fs.existsSync(logPath)) return [];
  const out = [];
  for (const line of fs.readFileSync(logPath, 'utf8').split('\n')) {
    const s = line.trim();
    if (!s) continue;
    try {
      out.push(JSON.parse(s));
    } catch {
      // 깨진 줄은 무시 — 로그 손상이 루프 전체를 막지 않도록
    }
  }
  return out;
}

/** 로그에서 가장 큰 iter (없으면 0). */
export function maxIter(log) {
  return log.reduce((m, e) => Math.max(m, e.iter ?? 0), 0);
}

/** 컴포넌트별 가장 최근(최대 iter) 엔트리 맵. */
export function latestPerComponent(log) {
  const latest = {};
  for (const e of log) {
    const cur = latest[e.component];
    if (!cur || (e.iter ?? 0) >= (cur.iter ?? 0)) latest[e.component] = e;
  }
  return latest;
}
