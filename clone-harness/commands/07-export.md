---
description: 납품 — 카페24 삽입용 조각 export + 재채점("채점한 것 = 올리는 것")
argument-hint: <run-name>
---
납품 단계: dev 와 납품을 가른다(원칙 1-5). export 는 정보를 변형하고 그 변형이 채점 대상을 바꾸므로,
"채점한 것 = 올리는 것"을 별도로 닫는다.

1. `npm run loop -- $ARGUMENTS --audit` 실행 →
   - `export`: `src/` → `dist/fragment.html`(납품본, 기본은 data 속성 보존) + `dist/fragment.audit.html`(재채점본, data-component 보존).
     CSS 는 tokens→styles 순서로 인라인, 전역 셀렉터는 `.clone-root` 하위로 강제 스코프.
     CSS 를 클래스 기반으로 옮긴 경우에만 `npm run export -- $ARGUMENTS --strip` 으로 data 속성 제거(아니면 가드가 막는다).
   - 그다음 `dist/fragment.audit.html` 을 렌더해 **마지막 재채점**. 납품본에서 점수가 하락하면 export 변환이 무언가 바꾼 것.
2. 통과하면 `dist/fragment.html` 을 카페24 에디터에 붙인다.
   - 에디터가 `<script>`/data 속성을 살려주는지 사전 "2분 테스트". script 잘리면 인라인, 그래도 안 되면 CSS-only 후퇴.

이게 마지막 게이트. 재채점이 통과해야 납품한다.

## 납품 어댑터 선택 (`config.export.adapter`)
- **`cafe24-fragment`**(기본): 위 흐름 — 에디터에 통째로 붙이는 단일 정적 조각.
- **`cafe24-skin`**: 카페24 실제 스킨에 얹는 디자인 레이어. `npm run export -- $ARGUMENTS --adapter=cafe24-skin` →
  `dist/skin/`에 tokens.css + skin.css(카페24 클래스 `prdList__item`·`thumbnail`·`name`·`badge`·`spec .price` 타깃) +
  product/list_product.html(모듈 마크업) + mockup.html(채점/미리보기 트윈) + INTEGRATION.md.
  상품 그리드는 카페24 서버 모듈이 실제 상품으로 채우고 skin.css 가 디자인을 입힌다.
  mockup.html 은 이 run 의 **9개 컴포넌트 전체**를 `.ph-skin` 스코프로 옮긴 채점 트윈 — `config.export.adapter`를 cafe24-skin 으로 두고
  `npm run loop -- $ARGUMENTS --audit` 하면 9개 전부 재채점해 "채점한 것 = 올리는 것"을 닫는다(원칙 1-5).
