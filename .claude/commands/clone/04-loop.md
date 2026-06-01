---
description: 4단계 — 컴포넌트별 유사도 비교 루프 (수렴 또는 타임아웃)
argument-hint: <run-name>
---
4단계: 측정→판단→수선 루프. 비교 기준은 `reference/` 가 아니라 `design/`(원칙 1-2). 종료는 코드가 정한다.

**visual 신호 누가 채점하나** — `config.signals.visual.provider`:
- `"agent"`(기본): **Claude Code(너)가 샷을 보고 채점**. API 키 불필요. → 아래 A 흐름.
- `"api"`: Anthropic SDK 가 자율 채점(ANTHROPIC_API_KEY 필요). → 아래 B 흐름.
- visual `enabled:false`: 결정론 신호만. → B 흐름.

### A. visual=agent (키 없이, 기본)
한 회차:
1. `npm run loop -- $ARGUMENTS --capture-only` — assemble + capture(샷/computed 생산) 후 멈춤.
2. `runs/$ARGUMENTS/work/shots/<id>.png` 를 **각각 Read 해서 holistic 채점**(위계·여백 리듬·정렬·완성도만; 색/폰트/치수는 결정론 신호 담당). 결과를 `runs/$ARGUMENTS/work/visual-grades.json` 에:
   `{ "<id>": { "score": 0~1, "notes": "한 줄 수선 힌트" }, ... }`
3. `npm run loop -- $ARGUMENTS --score-only` — visual 신호가 위 점수를 읽어 집계 + route 결정 출력.
4. 결정대로:
   - **continue** → 출력된 타깃의 `axes.notes` 를 읽고 `src/components/<id>.html`(필요시 styles.css) 수정 → 1로.
   - **advance** → `/05-gate`.
   - **call_human(stall)** / **halt(max_iterations)** → best-of 와 함께 `/05-gate`.

### B. visual=api / off (자율 단발)
- `npm run loop -- $ARGUMENTS` 한 줄이 assemble→capture→score→route 를 끝까지. continue 면 수정 후 재실행.

너(에이전트)는 **측정(visual 채점)과 수선**만 한다. 끝낼지/사람 부를지는 route(결정론)가 정한다 — 점수를 후하게 합리화하지 말 것. 게이트 무게중심은 결정론 신호(layout/color/typography) 쪽.
