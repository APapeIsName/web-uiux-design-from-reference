# 케이스 스터디 — 운영 카페24 스킨(skin3)에 통합

clone-harness 가 도출·수렴한 디자인이 **데모를 넘어 운영 카페24 쇼핑몰의 실제 스킨까지 닿은** 사례. `cafe24-skin` 어댑터(`clone-harness/export/cafe24-skin.mjs`)가 내보내는 결과를 실제 스킨에 매핑하면서 배운 점을 정리한다. 어댑터의 `INTEGRATION.md` "실전 매핑 플레이북"은 여기서 나왔다.

> **요약 한 줄**: 어댑터의 `skin.css` 는 '카페24 표준 상품 클래스'를 가정한 **출발점**이고, 운영 스킨은 자기 고유 클래스/레이아웃/스마트디자인(ez) 모듈을 쓰므로 **영역별로 실제 마크업에 직접 매핑**해야 한다.

---

## 무엇을 / 어디에

- **디자인**: `runs/phytotech-cafe24` — 자동차 워셔액 커머스 [autowash.co.kr](https://autowash.co.kr/) 의 UI/UX 무드를, 가상 건강기능식품 브랜드 **PHYTOTECH** 로 재해석. (브랜드·업종은 레퍼런스와 **무관**, 룩앤필만 차용.)
- **타깃**: 운영 카페24 쇼핑몰의 스킨 **skin3**(PHYTOTECH 스킨). *비공개 레포라 링크는 접근 권한 필요.*
- **방식**: `.ph-skin` 스코프 디자인 레이어를 스킨 CSS **뒤(마지막)**에 로드, **마크업/데이터(서버 모듈)·레이아웃은 그대로** 두고 색·타이포·배지만 입힘. 운영 main 에 머지하지 않고 **브랜치 + PR**로 핸드오프.

## 적용 범위 (영역별 phyto-*.css, 실제 skin3 클래스 타깃)

| 영역 | 실제 skin3 클래스(예) | 입힌 것 |
|---|---|---|
| 헤더(전역) | `#header` · `.top_category`(GNB) · `.top_mypage .count` | 화이트 배경·보더, GNB hover 그린, 장바구니 레드 배지 |
| 상품 그리드 | `.prdList__item` · `.thumbnail` · `.badge` · `.spec .price` | 라운드 썸네일·색 배지·정가취소선+그린가 (어댑터 기본 CSS 활용) |
| 푸터(전역) | `#footer` · `.bt_util` · `.bt_cscenter` · `.bt_sns` | 다크 그린 + 약관/사업자/고객센터/SNS 색·타이포 |
| 카테고리(메인) | `.main_product_category` · `.main_title_txt01` · `.main_product_tab` | 섹션 타이틀·탭(active=브랜드 그린). *skin3 엔 원형 아이콘 퀵메뉴 없음 → GNB+탭형 섹션이 카테고리 표면* |
| 플로팅(quick) | `#quick` · `.pageTop` · `.count` | cart·recent·top 패널 룩. *`detail_layout.html`에서만 @import(상세페이지 렌더)* |
| 히어로/프로모 | `main_3dan_banner`(`main_image_text_gallery`) · `.main_banner_txt01` · `.main_banner_more` · `main_text`/`main_map` 텍스트 | 텍스트·CTA 룩만 CSS. **이미지·카피는 어드민 가이드**(스마트배너 슬롯 INIT00001/00002 는 어드민 전용) |

## 배운 점 (= 어댑터 플레이북의 근거)

1. **표준 클래스 가정 금지.** 어댑터의 `skin.css(B)` 는 `.prdList__item` 등 표준 상품 클래스를 노린다. 그러나 헤더·푸터·내비·플로팅·배너는 스킨마다 고유 클래스(`#header`, `.bt_util`, `#quick`, `main_3dan_banner` …)라 **실제 HTML을 열어 영역별로 매핑**해야 했다. → 영역별 `phyto-<area>.css` 분리.
2. **레이아웃 파일이 여러 개.** 메인/리스트는 `layout.html`, 상세는 `detail_layout.html`. 플로팅(`quick.html`)이 `detail_layout` 에서만 `@import` 되어, 토큰·CSS를 `detail_layout` 에도 로드해야 상세페이지에서 적용됐다(덤으로 상세 푸터도 일관 적용). **컴포넌트가 렌더되는 레이아웃마다 @css 배선.**
3. **스마트디자인(ez) 인라인 스타일이 외부 CSS를 덮는다.** `main_map_banner_txt01`(인라인 `font-weight:bold; color:rgb(58,58,58)`), `main_map_banner_txt02`(`color:rgb(138,138,138)`), `main_text_title`(`font-weight:bold`)는 인라인이 우선. `!important` 로 소리없이 싸우지 않고, **잠긴 속성은 미선언 + "어드민에서 ez 서식 지우기"로 가이드**했다.
4. **스마트배너 슬롯·이미지는 어드민 전용.** `@import` 외부 스마트배너 슬롯(INIT00001/00002)과 배너 이미지는 스킨 CSS로 제어 불가. 배너 영역은 **스타일 가능한 텍스트/CTA 클래스만** 재스킨하고, 이미지·카피는 **어드민 운영 가이드**(이미지 스펙·팔레트·카피 톤·정직한 메뉴 경로 고지)로 분리했다.

## 검증 방식과 한 가지 교훈

- 배너 매핑은 **멀티에이전트 워크플로**로: 디자인 스펙 추출 / 실제 skin3 마크업 실측 / 카페24 어드민 메커니즘 조사를 병렬 → 합성(`phyto-banner.css` + 운영 가이드) → **3개 렌즈로 적대적 검증**(selector 정확도 · 어드민 날조 · 브랜드 충실도).
- **교훈**: '어드민 날조' 검증관이 **잘못된 디렉토리(엔진 런)** 를 grep 하고는 "skin3·main_3dan_banner·INIT00001…이 전부 날조"라고 강하게 결론냈다. 실제 통합 대상은 **운영 skin3 레포**였고, 식별자·인라인스타일은 모두 실재했다(16/16 클래스 1차 확인). → **검증 결과도 스코프를 의심하고 1차 증거로 재확인**해야 한다. selector 검증관의 저severity 2건(영상 박스 클리핑·`a` 한정자)만 타당해 반영했다.

## 정직한 한계

- 납품물은 `{$변수}` + ez 모듈이라 **로컬 렌더 불가** → 로컬 채점은 `mockup.html` 트윈(`loop --audit`), 실제 화면은 **카페24 스테이징에서 확인**.
- 어드민 메뉴 경로/라벨은 **버전(스마트디자인 vs Easy)·테마에 따라 다름** → 가이드는 모든 경로를 '어드민에서 확인'으로 표기. 단일 공식 배너 크기는 없음.
- 운영 **main 미머지** — 브랜치/PR로만 핸드오프, 스테이징 검증 후 사람이 머지 판단.

---

*관련*: `clone-harness/export/cafe24-skin.mjs` (어댑터·플레이북) · [DESIGN.md](../DESIGN.md) (하네스 설계) · [README.md](../README.md)
