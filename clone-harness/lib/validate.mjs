// 스키마 검증 = "엔진이 임의의 run 을 안전하게 받는" 실제 게이트(DESIGN 4, 12-3).
import fs from 'node:fs';
import path from 'node:path';
import Ajv from 'ajv';
import { ENGINE_ROOT, runPaths, isMain } from './paths.mjs';

const ajv = new Ajv({ allErrors: true, allowUnionTypes: true, strict: false });

const SCHEMA_DIR = path.join(ENGINE_ROOT, 'schemas');
const SCHEMAS = {
  designSystem: 'design-system.schema.json',
  components: 'components.schema.json',
  config: 'config.schema.json',
};

const compiled = new Map();
function validatorFor(kind) {
  if (compiled.has(kind)) return compiled.get(kind);
  const file = SCHEMAS[kind];
  if (!file) throw new Error(`validate: 알 수 없는 스키마 종류 "${kind}"`);
  const schema = JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, file), 'utf8'));
  const v = ajv.compile(schema);
  compiled.set(kind, v);
  return v;
}

/** 검증 실패 시 사람이 읽을 메시지로 throw. 성공 시 데이터 그대로 반환. */
export function validate(kind, data, { label } = {}) {
  const v = validatorFor(kind);
  if (v(data)) return data;
  const where = label ? ` (${label})` : '';
  const lines = (v.errors || []).map(
    (e) => `  • ${e.instancePath || '/'} ${e.message}${e.params ? ' ' + JSON.stringify(e.params) : ''}`
  );
  throw new Error(`스키마 검증 실패 [${kind}]${where}:\n${lines.join('\n')}`);
}

/** 파일에서 JSON 을 읽어 검증. */
export function validateFile(kind, filePath) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return validate(kind, data, { label: filePath });
}

/** 한 run 의 세 계약 파일을 모두 검증하고 파싱 결과를 반환. components 는 배열(파일 래퍼가 아니라). */
export function validateRun(runName) {
  const p = runPaths(runName);
  const designSystem = validateFile('designSystem', p.designSystem);
  const componentsDoc = validateFile('components', p.componentsJson);
  const config = validateFile('config', p.config);
  return { designSystem, components: componentsDoc.components, config, paths: p };
}

if (isMain(import.meta.url)) {
  const runName = process.argv[2];
  if (!runName) {
    console.error('사용법: node clone-harness/lib/validate.mjs <run-name>');
    process.exit(2);
  }
  try {
    validateRun(runName);
    console.log(`✓ ${runName}: 세 계약 파일 모두 스키마 통과`);
  } catch (err) {
    console.error(`✗ ${err.message}`);
    process.exit(1);
  }
}
