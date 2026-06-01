---
description: 5단계 — 게이트(사람 개입). 분기: 재작업 vs 기능 구현
argument-hint: <run-name>
---
5단계: **사람 게이트.** 루프가 advance / call_human / halt 로 올린 결과를 사람이 판단하는 자리.
성공이든 실패든 결과를 그대로 올린다 — 실패를 best-of 로 몰래 통과시키지 않는다(DESIGN 2).

사람에게 제시할 것:
- 컴포넌트별 최종 aggregate / threshold / passed, 그리고 `work/log.json` 기반 진전 추이.
- advance 가 아니면 best-of 와 함께 무엇이 막혔는지(stall) 또는 회차 소진(max_iterations)인지.

분기(사람이 결정):
- **재작업** → spec/디자인을 손보고 `/04-loop` 로 되돌아간다.
- **기능 구현으로 진행** → `/06-interactions`.

이 게이트와 6단계 완성 게이트, 단 두 순간에만 사람이 개입한다.
