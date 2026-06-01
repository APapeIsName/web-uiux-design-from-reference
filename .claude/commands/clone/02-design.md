---
description: 2단계 — 브랜드 디자인 + UI/UX 분석·재해석 → 디자인 시스템 도출
argument-hint: <run-name>
---
2단계: 레퍼런스를 **분석·재해석**해 디자인을 도출한다. 단순 모방이 아니라 UI/UX 를 분석하고 개선한다.
이 단계의 결과가 이후 모든 채점의 정답지가 된다(원칙 1-2).

1. `runs/$ARGUMENTS/design/design-system.json` — 토큰(color/type/space/radius). 객관 비교의 진실 원천.
2. `runs/$ARGUMENTS/design/components.json` — 척추. **배열(순서 보존)**. 각 컴포넌트:
   - `id`(= 파일명 = data-component, 3중 계약), `intent`, `expects`(산문 + 옵션 `assert` 숫자 단언),
   - `tokens`(도트경로 — 색·타이포 신호의 정답지), `scoring`(threshold + 신호별 weights, 컴포넌트마다 다름).
   - 특정 치수를 하드 게이트로 걸려면 산문이 아니라 `expects.assert` 에 숫자로 박는다(DESIGN 5).
3. `npm run validate -- $ARGUMENTS` 로 스키마 통과 확인(실제 게이트).

다음: `/03-implement <run-name>`.
