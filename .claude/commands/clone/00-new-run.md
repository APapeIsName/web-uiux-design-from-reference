---
description: 새 클론 실행 인스턴스를 스캐폴드한다 (runs/<name>/ 골격 + 기본 config 복사)
argument-hint: <run-name>
---
새 실행 인스턴스를 만든다. 엔진(clone-harness/)은 건드리지 않고 일회성 인스턴스만 생성한다(원칙 1-4).

1. `npm run new-run -- $ARGUMENTS` 실행 → `runs/$ARGUMENTS/` 골격(reference/ design/ src/ work/ dist/) + `config.json` + 최소 유효 스텁.
2. `npm run validate -- $ARGUMENTS` 로 세 계약 파일이 스키마를 통과하는지 확인.
3. 다음 단계 안내: `/01-reference $ARGUMENTS`.
