---
description: 3단계 — 디자인 선언 기반 HTML 목업 구현 + 컴포넌트 분할
argument-hint: <run-name>
---
3단계: `design/` 선언을 순수 HTML/CSS 로 구현한다. 백엔드 없음.

- 컴포넌트마다 조각 파일 `runs/$ARGUMENTS/src/components/<id>.html` 을 만든다. 루트 요소에 `data-component="<id>"`.
  - 로고처럼 위계를 기하로 판정해야 하는 자식엔 `data-role="logo"` 등을 박으면 레이아웃 신호가 직접 잰다.
- `runs/$ARGUMENTS/src/styles.css` — `.clone-root` 스코프 안에서만. 색·치수는 `var(--token)` 으로 참조.
  토큰 변수는 `tokens.css`(assemble 이 design-system.json 에서 emit)가 `.clone-root` 에 깐다.
- `npm run assemble -- $ARGUMENTS` 로 조각을 배열 순서대로 concat → `src/index.html` + `tokens.css` emit.
- `position:fixed` 헤더는 box 가 0 으로 잡히는 캡처 함정 — sticky 권장(DESIGN 6).

다음: `/04-loop <run-name>`.
