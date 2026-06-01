---
description: 1단계 — 레퍼런스 찾기/수집 (사용자 제공 시 스킵)
argument-hint: <run-name> [레퍼런스 URL 또는 설명]
---
1단계: 레퍼런스 확보. **사용자가 레퍼런스를 제공하면 탐색은 스킵**하고 정리만 한다.

- 산출물은 `runs/$ARGUMENTS/reference/` 에: `source.png`(스크린샷), 필요시 `dom.html`, `signals.json`(관찰 메모).
- 이건 **2단계 디자인 도출의 입력일 뿐, 채점의 정답지가 아니다**(원칙 1-2). 루프는 나중에 `design/` 과 비교한다.
- 서버/DB/비공개 API 는 외부에서 관측 불가 → 범위 밖. 픽셀 1:1 복제도 의도적으로 안 함.

다음: `/02-design <run-name>`.
