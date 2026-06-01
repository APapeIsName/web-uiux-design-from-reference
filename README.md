# clone-harness

레퍼런스를 **분석·재해석**해 디자인을 도출하고, 순수 HTML/CSS/JS 로 구현한 뒤,
AI 채점기와 **결정론적 루프**로 "디자인 의도에 얼마나 충실한가"를 반복 측정해 수렴시키는
재사용 가능한 시스템. 최종 산출물은 카페24 에디터에 직접 삽입하는 **HTML 조각**.

> 무한 반복은 그 자체로 수렴을 보장하지 않는다. 수렴하려면 (1) "지금 얼마나 가까운지"를 재는
> 오라클과 (2) 종료 조건이 필요하다. 이 시스템은 그 둘을 명시적으로 갖춘다.
>
> 설계 근거 전체는 [`DESIGN.md`](./DESIGN.md). 이 README 는 실행 방법.

---

## 이 저장소에 담긴 것

| 경로 | 내용 |
|---|---|
| `clone-harness/` | **재사용 엔진** — 스크립트·신호 플러그인·판단자·스키마·커맨드 |
| `runs/example/` | 최소 동작 예제(header + footer). 오프라인 스모크용 |
| `runs/phytotech-cafe24/` | **완결 예제** — 레퍼런스([autowash.co.kr](https://autowash.co.kr/))의 UI/UX 를 가상 건강기능식품 브랜드 *PHYTOTECH* 로 재해석. 9개 컴포넌트 풀 페이지 + 프론트 인터랙션 |
| `DESIGN.md` | 설계 문서(원칙·계약·파이프라인) |

`runs/*` 는 **예제로 그대로 둔다.** 실제 작업은 `npm run new-run -- <name>` 으로 새 인스턴스를 만들어 진행한다.

---

## 핵심 원칙 (코드에 박힘)

- **측정과 결정을 분리한다.** 채점기(`scripts/score.mjs`)는 측정만, 판단자(`judge/route.mjs`)는 흐름만 결정.
  종료 조건(임계치·최대회차)은 데이터지 AI 재량이 아니다.
- **비교 기준은 원본이 아니라 도출된 디자인.** 루프는 `reference/` 가 아니라 `design/` 과 비교한다(베끼기 회귀 방지).
- **컴포넌트 경계가 전 단계를 묶는 계약.** `id` = `src/components/<id>.html` = `data-component="<id>"` (3중 계약).
- **엔진과 실행을 가른다.** `clone-harness/`(재사용) vs `runs/<name>/`(일회성).
- **dev 와 납품을 가른다.** 마지막 재채점은 `src/` 가 아니라 export 된 `dist/fragment.audit.html` 로 — "채점한 것 = 올리는 것".

---

## 설치

```bash
npm install
npx playwright install chromium      # 캡처용 브라우저
```

- 요구사항: **Node ≥ 22.9** (`--env-file-if-exists` 사용).
- 시각 채점은 기본이 `provider:"agent"` (Claude Code 가 직접 채점, **API 키 불필요**).
  완전 자율(CI/크론)로 돌리려면 `provider:"api"` 로 두고 `cp .env.example .env` 후 `ANTHROPIC_API_KEY` 입력.

---

## 빠른 시작

```bash
# 1) 결정론 신호만으로 한 바퀴(오프라인, 키 불필요)
npm run loop -- example

# 2) 완결 예제를 브라우저로 보기
npm run serve -- phytotech-cafe24            # → http://127.0.0.1:4173  (전체 페이지)
npm run serve -- phytotech-cafe24 root 4174  # → http://127.0.0.1:4174/design/preview.html (디자인 스펙 시트)
```

`runs/example/` 는 visual 신호가 꺼져 있어 한 줄로 **assemble → capture → score → route** 를 돌고
`advance` 까지 간다. `runs/phytotech-cafe24/` 는 visual `provider:"agent"` 라 아래 "시각 신호" 두 단계 흐름을 탄다.

---

## 파이프라인 (사람은 게이트에서만 개입)

| 단계 | 커맨드 | 내용 | 사람 |
|---|---|---|---|
| 1 | `/clone:01-reference` | 레퍼런스 수집 (제공 시 스킵) | - |
| 2 | `/clone:02-design` | 토큰 + 컴포넌트 선언 도출 (`design/`) | - |
| 2.5 | `/clone:02-review` | **design ↔ reference 충실도 게이트** + 사람 미리보기 | **게이트** |
| 3 | `/clone:03-implement` | HTML 목업 + 컴포넌트 분할 (`src/`) | - |
| 4 | `/clone:04-loop` | 컴포넌트별 유사도 루프 (수렴/타임아웃) | - |
| 5 | `/clone:05-gate` | 분기: 재작업 vs 기능 구현 | **게이트** |
| 6 | `/clone:06-interactions` | 프론트 인터랙션 (백엔드 없음) | 대화 |
| 납품 | `/clone:07-export` | 카페24 조각 export + 재채점 | **게이트** |

**두 종류의 게이트를 분리한다**: `02-review` 는 *"도출된 디자인이 원본의 본질을 담았나"*(홀리스틱),
`04→05` 는 *"구현이 그 디자인에 수렴했나"*(결정론+시각). 이 둘을 한 게이트가 겸하면 얇은 디자인이 통과한다.

### 새 프로젝트

```bash
npm run new-run -- mysite     # runs/mysite/ 골격 + 기본 config + 최소 유효 스텁
# 이후 /clone:01-reference mysite → ... → /clone:07-export mysite
```

---

## 시각(visual) 신호 — 누가 채점하나

`config.signals.visual.provider` 로 교체한다(확장 이음새):

| provider | 채점 주체 | 키 | 흐름 |
|---|---|---|---|
| `"agent"` (기본) | **Claude Code 에이전트가 샷을 보고 채점** | 불필요 | capture → 에이전트가 `work/visual-grades.json` 작성 → score |
| `"api"` | Anthropic SDK 자율 채점 | `ANTHROPIC_API_KEY` | `npm run loop` 단발 |

`"agent"` 일 때 루프는 두 단계로 나뉜다(중간에 에이전트가 채점):

```bash
npm run loop -- <run> --capture-only   # 샷/computed 생산 후 멈춤
#  → work/shots/<id>.png 를 보고 work/visual-grades.json 에 {"<id>":{"score":0~1,"notes":"…"}} 작성
npm run loop -- <run> --score-only     # 에이전트 점수 읽어 집계 + route
```

홀리스틱 품질을 실제로 기준에 물게 하려면 `threshold` 가 아니라 컴포넌트별 `weights.visual` 을 올린다
(결정론 신호가 보통 만점에 가까워 threshold 만으론 시각 품질을 거의 못 거른다).

---

## Claude Code 슬래시 커맨드

단계별 진입점을 슬래시 커맨드로 노출한다. 정본은 `clone-harness/commands/`, `.claude/commands/clone/` 로
미러링되어 `/clone:` 네임스페이스로 뜬다(`/clone:01-reference …` 등). 커맨드 수정 후 미러 갱신: `npm run sync-commands`.

매 단계가 부르는 `npm run …` 을 승인 없이 돌리려면 `.claude/settings.json` 의 `permissions.allow` 에 등록한다.

---

## 스크립트

```bash
npm run new-run       -- <run>                     # 새 인스턴스 스캐폴드
node clone-harness/scripts/reference.mjs <run> <url>  # 1단계: 레퍼런스 캡처(샷+DOM+색/폰트 신호, 팝업 닫기)
npm run validate      -- <run>                     # 세 계약 파일 스키마 검증 (실제 게이트)
npm run design-preview -- <run>                    # design/ → preview.html (스펙 시트, root 로 serve 해서 봄)
npm run assemble      -- <run>                     # 조각 concat → index.html + tokens.css emit
npm run capture       -- <run> [src|dist]          # 컴포넌트별 shot + computed 생산
npm run score         -- <run>                     # 신호 집계 채점 → work/log.json
npm run loop          -- <run> [--capture-only|--score-only|--audit]   # 한 바퀴 / 단계 분리 / 납품 재채점
npm run export        -- <run> [--strip]           # src → dist (인라인·.clone-root 스코프)
npm run serve         -- <run> [src|dist|root] [port]   # 정적 서버
```

---

## 디렉터리

```
clone-harness/                # 재사용 엔진
├── lib/                      # 공통 계약 (paths, tokens, color, validate, log)
├── scripts/                  # assemble · serve · capture · score · export · reference · design-preview · new-run
├── signals/                  # 신호 플러그인 (layout · color · typo · pixel · visual) — 동일 인터페이스
├── judge/                    # 판단자: route(결정론) + loop(오케스트레이터)
├── schemas/                  # JSON Schema 게이트 3종 (design-system · components · config)
├── commands/                 # 단계별 진입점 (00~07 + 02-review)
└── config.default.json       # 엔진 기본값 (viewport·임계치·가중치·신호 레지스트리)

runs/<name>/                  # 1회 실행 = 인스턴스
├── reference/                # 1번: source.png · dom.html · signals.json · brief.md  (채점 정답지 아님)
├── design/                   # 2번: design-system.json · components.json  ← 척추(채점 정답지)
├── src/                      # 3번: components/*.html · styles.css · interactions.js · assets/  (+ 생성물 index.html·tokens.css)
├── work/                     # 루프 상태: shots/ · log.json · visual-grades.json
├── dist/                     # 납품: fragment.html · fragment.audit.html
└── config.json               # 이 프로젝트의 임계치·가중치·신호 토글 override
```

`work/`·`dist/`·생성물(`index.html`·`tokens.css`·`preview.html`)은 `.gitignore` 로 제외 — 매 회차 다시 만든다.

---

## 신호 추가 (확장 이음새)

`signals/*.mjs` 는 모두 동일 시그니처:

```js
export async function run({ shot, computed, spec, tokens, config }) {
  // shot     : 이 컴포넌트 스크린샷 경로
  // computed : capture 가 뽑은 getComputedStyle·boundingBox 트리(루트+직계+손자, 2-depth)
  // spec     : components.json 의 이 컴포넌트 객체
  // tokens   : design-system.json 에서 resolve 된 실제 값
  return { score: 0.0 /* 0~1, 또는 null = 측정 불가(집계 제외) */, detail: {}, notes: '한 줄 수선 힌트' };
}
```

새 신호는 (1) `signals/<name>.mjs` 추가, (2) `config.signals.<name>` 레지스트리 등록, (3) `weights.<name>` 부여.
시각 채점기도 특별취급 없이 "신호 하나"일 뿐이다.

---

## 예제(PHYTOTECH)에 쓴 무료 자산

`runs/phytotech-cafe24` 는 외부 무료 소스를 임베드해 만들었다(모두 키 불필요):

- **아이콘** — [Lucide](https://lucide.dev) via [Iconify API](https://iconify.design)(`api.iconify.design/lucide/<icon>.svg`). ISC/MIT, 상업적 사용 가능.
- **제품 이미지** — [Pollinations.ai](https://pollinations.ai) 로 생성해 `src/assets/` 에 **자체호스팅**.

> ⚠️ 예제 이미지는 AI 생성물이고 무료 티어라 상표/워터마크 리스크가 있다. **실제 상업 운영 전 진짜 제품 촬영컷으로 교체**하라
> (슬롯·구조는 그대로 두고 URL 만 교체). 레퍼런스 캡처(`reference/source.png` 등)는 분석용일 뿐 납품물이 아니다.

---

## 라이선스 / 주의

- 엔진 코드는 자유롭게 사용. 외부 자산(아이콘·이미지·웹폰트)·레퍼런스 캡처는 각 출처의 라이선스를 따른다.
- 이 시스템은 **픽셀 1:1 복제가 아니라 UI/UX 재해석**을 목표로 한다(원칙 1-2). 타사 디자인을 그대로 베끼는 용도가 아니다.
