// 픽셀 신호 — 옵트인(기본 off). 픽셀 비교는 본질적으로 "타깃 이미지"가 필요한데,
// 유일한 이미지는 reference/ 라서 원칙 1-2(원본 아닌 design 과 비교)와 결이 어긋난다.
// 그래서 기본 비활성. 켜려면 컴포넌트별 참조 크롭을 제공해야 한다:
//   spec.pixel.ref (run 루트 기준 상대경로) 또는 reference/components/<id>.png
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

function findRef(spec, config) {
  const runRoot = config?._run?.paths?.root;
  if (spec.pixel?.ref && runRoot) {
    const p = path.resolve(runRoot, spec.pixel.ref);
    if (fs.existsSync(p)) return p;
  }
  const ref = config?._run?.paths?.reference;
  if (ref) {
    const p = path.join(ref, 'components', `${spec.id}.png`);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export async function run({ shot, spec, config }) {
  const refPath = findRef(spec, config);
  if (!refPath) {
    return {
      score: null,
      detail: { reason: 'no-pixel-reference' },
      notes: '픽셀 참조 이미지 없음 — pixel 신호 스킵(기본 비활성)',
    };
  }
  if (!shot || !fs.existsSync(shot)) {
    return { score: null, detail: { reason: 'no-shot' }, notes: '샷 파일 없음' };
  }

  const a = PNG.sync.read(fs.readFileSync(shot));
  const b = PNG.sync.read(fs.readFileSync(refPath));
  if (a.width !== b.width || a.height !== b.height) {
    return {
      score: null,
      detail: { reason: 'dimension-mismatch', shot: [a.width, a.height], ref: [b.width, b.height] },
      notes: `치수 불일치 ${a.width}x${a.height} vs ${b.width}x${b.height} — 픽셀 비교 스킵`,
    };
  }

  const total = a.width * a.height;
  const diff = pixelmatch(a.data, b.data, null, a.width, a.height, { threshold: 0.1 });
  const score = Math.max(0, 1 - diff / total);
  const notes = score < 0.9 ? `픽셀 불일치 ${(100 * diff / total).toFixed(1)}%` : '';
  return { score, detail: { diffPixels: diff, total }, notes };
}
