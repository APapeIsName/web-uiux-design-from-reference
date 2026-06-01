# 웹사이트 클론 하네스 — 설계 문서

레퍼런스를 분석·재해석해 디자인을 도출하고, 순수 HTML/CSS/JS로 구현한 뒤,
AI 채점기와 결정론적 루프로 "디자인 의도에 얼마나 충실한가"를 반복 측정해
수렴시키는 재사용 가능한 시스템. 최종 산출물은 카페24 에디터에 직접 삽입하는 HTML 조각.

---

## 0. 무엇을 만들고, 무엇을 만들지 않는가

**범위 안**
- 레퍼런스 기반 브랜드 디자인 (단순 모방이 아닌 UI/UX 분석·재해석)
- 순수 HTML/CSS/JS 목업 구현
- 컴포넌트 단위 유사도 측정 + 자동 반복 수렴
- 프론트엔드 인터랙션 (백엔드 없음)
- 위 전체를 반복 사용 가능한 하네스(엔진)로

**범위 밖 (원리적으로 불가능하거나 의도적으로 제외)**
- 서버 로직·DB·비공개 API 복제 → 외부에서 관측 불가, 복제 불가능
- 픽셀 단위 1:1 원본 복제 → 베끼기로 회귀하므로 의도적으로 안 함
- 백엔드 기능 → 범위에서 제외해 "만들 수 있는 영역"에만 집중

**핵심 전제**
무한 반복은 그 자체로 수렴을 보장하지 않는다. 수렴하려면 (1) "지금 얼마나 가까운지"를
재는 오라클과 (2) 종료 조건이 필요하다. 이 시스템은 그 둘을 명시적으로 갖춘다.

---

## 1. 관통하는 설계 원칙 (모든 결정의 뿌리)

### 1-1. 측정과 결정을 분리한다
측정하는 주체가 동시에 "이만하면 됐다"를 선언하면, 루프를 끝내려고 점수를 후하게
합리화한다. 그래서:
- **채점기(score.mjs)** 는 측정만 한다 — 점수 + 피드백 생산. 소비는 안 함.
- **판단자(route)** 는 그 측정을 읽고 흐름만 결정한다.
- **종료 조건(임계치·최대회차)** 은 코드가 정한다 — AI 재량 아님.

이 원칙은 한 층씩 재귀적으로 적용된다:
채점기↔판단자 분리 → 판단자 안에서도 route(결정론)↔수선(AI) 분리.

### 1-2. 비교 대상은 원본이 아니라 "도출된 디자인"이다
2번에서 UI/UX 분석·개선을 거친 결과물을 다시 원본에 끌어다 맞추면 분석이 다 버려지고
베끼기로 회귀한다. 따라서 루프의 비교 기준은 `reference/`가 아니라 `design/`이다.
"구현이 내가 의도한 디자인을 얼마나 충실히 반영했나"를 잰다.

### 1-3. 컴포넌트 경계가 전 단계를 묶는 계약이다
순수 HTML엔 컴포넌트 개념이 코드에 안 드러난다. `data-component` 속성이
`components.json`의 선언 단위 ↔ 마크업 ↔ 캡처 단위를 하나로 묶는다.

### 1-4. 엔진과 실행을 가른다
재사용하려면 재사용되는 것(엔진)과 매번 버려지는 것(한 번의 실행)을 분리해야 한다.

### 1-5. dev와 납품을 가른다
직접 삽입은 완결 문서가 아니라 기존 페이지에 끼우는 *조각*이다. 개발·채점은 우리가
통제하는 독립 페이지에서, 납품은 거기서 export한 조각으로. export는 정보를 변형하므로
"채점한 것 = 올리는 것"을 별도로 보장해야 한다.

---

## 2. 6단계 파이프라인

| 단계 | 내용 | 사람 개입 |
|---|---|---|
| 1 | 레퍼런스 찾기 (사용자 제공 시 스킵) | - |
| 2 | 브랜드 디자인 + UI/UX 분석 → 디자인 시스템 도출 | - |
| 3 | 디자인 선언 기반 HTML 목업 구현 + 컴포넌트 분할 | - |
| 4 | 컴포넌트별 유사도 비교 루프 (수렴 또는 타임아웃) | - |
| 5 | 분기: 재작업 vs 기능 구현 | **게이트** |
| 6 | 프론트 인터랙션 구현 (대화 주도, 백엔드 없음) | 대화 |

사람은 **중요한 두 순간**(디자인 완성 게이트, 구현 완성 게이트)에만 개입한다.
나머지 기계적 반복은 AI 판단자가 가져간다. 성공이든 실패든 결과는 게이트로 올리며,
실패를 best-of로 몰래 통과시키지 않는다.

4번 루프는 `reference/`가 아니라 `design/`과 비교한다(원칙 1-2).
6번은 루프 밖이며 유사도 채점 대상이 아니다 — 기능의 기준은 "유사"가 아니라 "동작".

---

## 3. 디렉터리 구조

엔진(재사용)과 실행 인스턴스(일회성)를 분리한다.

```
clone-harness/              # 재사용 엔진 (버전 관리·재사용 대상)
├── scripts/
│   ├── assemble.mjs         # components/*.html → index.html (concat + 토큰 emit)
│   ├── serve.mjs            # 정적 서버 (Playwright가 붙음)
│   ├── capture.mjs          # data-component별 shot + computed 생산
│   ├── score.mjs            # 신호 집계 채점기 (측정만)
│   └── export.mjs           # src → dist (스코프 래핑·인라인화)
├── signals/                 # 신호 플러그인 (공통 인터페이스)
│   ├── layout.mjs
│   ├── color.mjs
│   ├── typo.mjs
│   ├── pixel.mjs
│   └── visual.mjs           # 멀티모달 채점도 "신호 하나"로 통합
├── judge/                   # 오케스트레이터 — route(결정론) 정책
├── schemas/                 # JSON Schema 검증 (실제 게이트)
├── commands/                # 단계별 진입점 (.claude/commands)
└── config.default.json

runs/
└── <project-name>/          # 1회 실행 = 인스턴스
    ├── reference/           # 1번: source.png, dom.html, signals.json
    ├── design/              # 2번: design-system.json, components.json  ← 척추
    ├── src/                 # 3번: components/*.html, tokens.css, styles.css,
    │                        #      interactions.js, index.html
    ├── work/                # 루프 상태: shots/, log.json  ← 타임아웃·best-of 근거
    ├── dist/                # 납품: fragment.html, fragment.audit.html
    └── config.json          # 이 프로젝트의 임계치·가중치·신호 토글 override
```

**당연하지 않은 선택**
- 컴포넌트를 조각 파일(`src/components/*.html`)로 쪼갠다 → 루프의 편집 타깃이 작은
  단일 파일이어야 diff가 깔끔하고 루프가 안 흔들린다. 채점은 풀페이지에서 하므로
  `assemble`로 합친다(빌드 아님, concat).
- `scripts/` = 기계, `src/` = AI 편집 영역. 측정/결정 분리가 디렉터리로 드러남.
- `dist/`를 `src/`와 분리 → 마지막 재채점은 export된 결과물로(원칙 1-5).
- Node 단일 런타임 → Playwright·pixelmatch·node-vibrant·Anthropic SDK 모두 JS.

---

## 4. 계약 (스키마)

세 파일 모두 `schemas/`의 JSON Schema로 검증한다. 이 검증이 "엔진이 임의의 run을
안전하게 받는" 실제 게이트다.

### 4-1. `design/design-system.json` — 토큰, 객관 비교의 진실 원천

```json
{
  "color": {
    "bg":    { "page": "#FFFFFF", "surface": "#0E0E10" },
    "text":  { "primary": "#111111", "muted": "#6B7280" },
    "brand": { "primary": "#2F6BFF", "accent": "#FF5C39" }
  },
  "type": {
    "family":  { "heading": "'Pretendard', sans-serif", "body": "'Pretendard', sans-serif" },
    "size":    { "h1": "48px", "h2": "32px", "body": "16px", "caption": "13px" },
    "weight":  { "regular": 400, "bold": 700 },
    "leading": { "tight": 1.1, "normal": 1.5 }
  },
  "space":  { "xs": "4px", "sm": "8px", "md": "16px", "lg": "32px", "xl": "64px" },
  "radius": { "sm": "4px", "md": "12px", "pill": "999px" }
}
```

두 곳에서 쓰인다:
1. `tokens.css`가 여기서 emit됨. 도트경로를 케밥으로 평탄화: `color.brand.primary`
   → `--color-brand-primary`. `.clone-root`에 깔린다(전역 `:root` 아님 → 스코프 격리).
2. 색·타이포 신호의 정답지. 비교 기준이 `reference/`가 아니라 여기임이 파일로 박힘.

### 4-2. `design/components.json` — 척추. 객체맵이 아니라 배열(순서 보존)

```json
{
  "components": [
    {
      "id": "header",
      "intent": "상단 고정 바. 로고 좌측, 주 내비 우측. 히어로 위 투명, 스크롤 후 solid.",
      "expects": {
        "layout": "로고와 내비가 양 끝 정렬, 높이 ~72px",
        "hierarchy": "로고가 1차 초점, 내비는 2차"
      },
      "tokens": ["color.bg.surface", "type.family.heading"],
      "scoring": {
        "threshold": 0.85,
        "weights": { "layout": 0.45, "color": 0.15, "typography": 0.2, "pixel": 0, "visual": 0.2 }
      }
    },
    {
      "id": "footer",
      "intent": "다컬럼 링크 + 저작권. 정보 밀도 높고 시각 위계는 낮음.",
      "expects": { "layout": "3~4 컬럼, 좌측 정렬" },
      "tokens": ["color.text.muted", "type.size.caption"],
      "scoring": {
        "threshold": 0.7,
        "weights": { "layout": 0.3, "color": 0.2, "typography": 0.2, "pixel": 0, "visual": 0.3 }
      }
    }
  ]
}
```

**당연하지 않은 선택**
- **배열이라 순서가 있다.** `assemble`이 이 순서로 concat → 풀페이지 흐름 결정.
  in-context 캡처에서 위 컴포넌트가 아래를 미는 결합 때문에 순서가 의미를 가짐.
- **`id`가 3중 계약.** `id` = `src/components/<id>.html` 파일명 = `data-component="<id>"`.
  셀렉터는 `[data-component="<id>"]`로 규약 고정(엣지케이스용 `selector` override만 옵션).
- **`intent`/`expects`/`tokens`가 채점기 입력.** 멀티모달 채점기는 "스크린샷 + 이 텍스트
  스펙 + 참조 토큰 실제값"으로 채점 → 원칙 1-2가 실제 입력으로 구현됨.
- **`scoring`이 컴포넌트마다 다르다.** 헤더는 layout 0.45, 푸터는 threshold 0.7.
  `weights` 키가 0이면 "그 신호 꺼짐 + 가중치 0"을 한 필드로 겸함. 합이 1이 아니면
  집계기가 정규화. 컴포넌트가 값을 안 주면 config 기본값으로 폴백.

### 4-3. `runs/<name>/config.json` — 엔진/실행 정책

```json
{
  "viewport": { "width": 1440, "height": 900 },
  "maxIterations": 12,
  "defaultThreshold": 0.85,
  "defaultWeights": { "layout": 0.3, "color": 0.2, "typography": 0.2, "pixel": 0, "visual": 0.3 },
  "signals": {
    "layout":     { "module": "signals/layout.mjs", "enabled": true },
    "color":      { "module": "signals/color.mjs",  "enabled": true },
    "typography": { "module": "signals/typo.mjs",   "enabled": true },
    "pixel":      { "module": "signals/pixel.mjs",  "enabled": false },
    "visual":     { "module": "signals/visual.mjs", "enabled": true, "model": "<model-id>" }
  },
  "judge": { "stallWindow": 3, "minDelta": 0.01 }
}
```

**분담**
- config = 엔진/실행 정책: 신호 모듈 레지스트리(플러그인 이음새가 사는 곳),
  판단자 정체 기준, 최대 회차, 기본값.
- components.json = 디자인 의도: 컴포넌트별 override.

**판단자 관련 박힘**
- 종료 조건(`maxIterations`, `threshold`)은 데이터지 판단자 재량 아님.
- 판단자는 `judge.stallWindow`/`minDelta`로 "정체"만 감지해 사람 호출 라우팅.
- 끝낼지 말지를 vibes로 못 정함.

---

## 5. 신호 인터페이스 (확장 이음새 = 미뤄둔 "루프 추상화"의 실체)

색·타이포·레이아웃·픽셀·**시각**을 전부 동일 인터페이스의 플러그인으로. 시각 채점기도
특별취급 없이 "API를 부르는 신호 하나"일 뿐. `config.signals`가 단일 레지스트리.

```js
// signals/*.mjs 공통 시그니처
export async function run({ shot, computed, spec, tokens, config }) {
  // shot     : 이 컴포넌트 스크린샷 경로
  // computed : capture가 뽑은 getComputedStyle·boundingBox 페이로드
  // spec     : components.json의 이 컴포넌트 객체
  // tokens   : design-system.json에서 resolve된 실제 값
  return {
    score: 0.0,            // 0~1 정규화
    detail: { /* 디버그·근거 */ },
    notes: "한 줄 수선 힌트"  // 에이전트가 읽을 피드백
  };
}
```

**각 신호가 무엇과 비교하나 (전부 design/ 기준)**
- 색·타이포 → 결정론. `computed`의 실제 렌더값을 컴포넌트 `tokens`의 resolve값과
  거리 비교(색은 deltaE 등). AI 없이 숫자로 끝.
- 레이아웃 → 측정 가능한 것만 결정론. 요소 존재·자식 정렬·boundingBox 기하.
  CSS 선언(`justify-content`)은 힌트일 뿐, boundingBox가 진실. "~72px"처럼 숫자로
  박힌 것만 결정론으로 잡힘. 특정 치수를 하드 게이트로 걸려면 산문이 아니라 spec에
  숫자 필드(옵션: `expects`의 assertion 배열)로 박아야 함.
- 시각 → holistic만. 위계·여백 리듬·전체 충실도 등 숫자로 환원 안 되는 것.

---

## 6. capture.mjs — computed 페이로드

신호의 입력을 생산하는 곳. 두 가지를 생산한다:
- **shot(PNG)**: 시각 신호가 먹음 (보는 용도)
- **computed(JSON)**: 결정론 신호가 먹음 (재는 용도)

**핵심 결정: computed는 "요소 하나"가 아니라 "작은 트리".**
컨테이너 하나의 style만 뽑으면 색·폰트는 되지만 레이아웃이 죽는다. "양 끝 정렬"은
자식들의 상대 배치라서 자식 boundingBox가 있어야 판정 가능. 그렇다고 전체 DOM은
폭발하므로, 루트 + 직계(필요시 2-depth) 자식까지, 신호가 쓰는 필드만 화이트리스트.

```js
async function captureComponent(page, id, outDir) {
  const sel = `[data-component="${id}"]`;
  const root = page.locator(sel).first();

  await root.screenshot({ path: `${outDir}/${id}.png` });   // 1) shot

  const computed = await root.evaluate((el) => {            // 2) computed
    const fields = [
      "backgroundColor", "color", "borderColor",
      "fontFamily", "fontSize", "fontWeight", "lineHeight",
      "display", "flexDirection", "justifyContent", "alignItems",
      "paddingTop", "paddingBottom", "paddingLeft", "paddingRight",
      "borderRadius"
    ];
    const pick = (node) => {
      const cs = getComputedStyle(node);
      const r = node.getBoundingClientRect();
      const style = {};
      for (const f of fields) style[f] = cs[f];
      return {
        tag: node.tagName.toLowerCase(),
        role: node.getAttribute("data-role") || null,
        box: { x: r.x, y: r.y, w: r.width, h: r.height },
        style
      };
    };
    return { self: pick(el), children: [...el.children].map(pick) };
  });

  return { id, shot: `${outDir}/${id}.png`, computed };
}
```

**당연하지 않은 선택**
- box 좌표가 레이아웃 신호의 진실. CSS 선언은 힌트로만 믿는다.
- `data-role`(옵션): "로고가 1차 초점"을 기하로 판정하려면 어느 자식이 로고인지 필요.
  `data-role="logo"`를 박으면 레이아웃 신호가 직접 잼. 안 박으면 시각 신호로 넘어감.
  (3중 계약에 이은 선택적 4번째 훅)
- 필드 화이트리스트: computed style은 수백 개라 신호가 보는 것만. 신호 추가 시 같이 늘어남.

**캡처 전 안정화 (회차 간 jitter 제거 → 유령 점수 변동 방지)**
```js
await page.evaluate(() => document.fonts.ready);            // 폰트 로딩 대기
await page.addStyleTag({ content:
  `*,*::before,*::after{ animation:none!important; transition:none!important; }` });
await page.waitForLoadState("networkidle");
// 뷰포트는 config.viewport 고정 → box 좌표 회차 간 비교 가능
```

**함정**
- header `position: fixed`는 자리를 차지 안 해 박스가 예상과 다를 수 있음. 격리 캡처 시
  눈으로 확인. 캡처용으로만 static 우회는 "채점한 것 ≠ 실제"가 되니 신중히.
- 화면 밖 요소(푸터 등)는 빈 샷 위험. `scrollIntoViewIfNeeded()` 먼저. locator는
  대체로 자동 처리하나, 빈 샷의 1순위 의심 지점.

---

## 7. score.mjs — 채점기 (측정만 한다)

```
입력 : componentId, shot, computed, spec(=components.json[id]), tokens(=resolved)
1. config.signals에서 enabled 모듈 수집
2. (선택) 싼 결정론 신호 먼저 → 명백히 미달이면 비싼 visual 스킵 (early-out)
3. 켜진 신호 run() → { signal: {score, notes} } 수집
4. 가중합 집계: weights = spec.scoring.weights ?? config.defaultWeights
              합≠1이면 정규화, enabled=false/weight=0 제외
5. threshold = spec.scoring.threshold ?? config.defaultThreshold
6. passed = aggregate >= threshold   // 순수 산술 → 결정론이라 채점기에 둬도 OK
출력 : 결과 객체 반환 + work/log.json 에 한 줄 append
```

- **2번 early-out** = "구조 신호 1차 게이트, 시각 미세 조정"의 구현. 단, 비대칭으로:
  명백히 미달일 때만 스킵. 통과권에선 항상 풀 채점(안 그러면 시각 점수가 로그에 안 남아
  판단자 정체 감지에 구멍).
- **6번 passed**를 채점기가 정해도 측정/결정 분리를 안 깸. `점수 >= 임계치`는 결정론적
  산술이라, 오히려 AI한테서 뺏어 코드에 두고 싶었던 그 결정.

**출력 = log.json 한 줄. 두 소비처로 갈라짐**
```json
{
  "iter": 4, "component": "header",
  "aggregate": 0.83, "threshold": 0.85, "passed": false,
  "axes": {
    "layout":     { "score": 0.91, "notes": "정렬 OK, 높이 80px로 spec 72px보다 큼" },
    "color":      { "score": 0.97, "notes": "" },
    "typography": { "score": 0.88, "notes": "내비 폰트 weight 600, spec 700" },
    "visual":     { "score": 0.7,  "notes": "로고-내비 위계 약함, 로고 더 키울 것" }
  },
  "ts": "..."
}
```
- `aggregate`·`passed` → **결정**(게이트·판단자 입력).
- `axes[*].notes` → **수선**(에이전트가 다음 회차에 뭘 고칠지 읽는 곳).
- 채점기는 둘 다 *생산*만, 소비 안 함. B안 분리가 출력 필드 수준까지 내려옴.

**멀티모달 신호 구현**
- SDK 호출, 모델은 config 필드로 분리(재사용 이음새).
- `temperature: 0`, 프롬프트에 "오직 JSON만" 못 박고 파싱은 try/catch + 펜스 제거 가드.
- 입력: 스크린샷(image 블록) + spec 텍스트 + resolve된 토큰값 + 채점할 축 목록.

**주의 둘**
- 시각 점수는 temp 0이어도 ±0.0x 흔들림. 이게 `minDelta`보다 크면 유령 진전/정체 발생.
  → minDelta를 시각 jitter보다 위로, 게이트 무게중심은 결정론 신호 쪽에(헤더 layout 0.45).
- early-out은 양날: 비용 절감 vs 정체 감지 구멍 → "미달일 때만 스킵" 비대칭 적용.

---

## 8. assemble.mjs & export.mjs — 양 끝 변환

### assemble — 사소함 (정보 안 바꾸고 합치기만)
`src/components/*.html`을 components.json **배열 순서대로** concat → `src/index.html`.
곁들여 design-system.json → `tokens.css` emit(도트경로 케밥 평탄화).
`.clone-root` 래퍼를 **개발 단계부터** 씌운다(export 때 처음 씌우면 그때 스코프가
처음 적용되며 화면이 틀어짐). 빌드 아님, concat.

### export — 함정 (정보를 변형하고 그 변형이 채점 대상을 바꿈)
카페24 에디터에 붙이는 형태로 변환. 세 작업 + 각 위험:
1. 외부 CSS 인라인 합치기 (`<link>` → `<style>`). 위험: 합치는 순서가 cascade를
   바꿈 → tokens → styles 순서 고정.
2. 스코프 재확인. 전역 셀렉터(`body`, `h1{}`)가 새면 카페24 테마와 충돌 →
   전역 셀렉터를 `.clone-root` 하위로 강제 prefix하는 가드.
3. 에디터가 살려주는 것만 (사전 "2분 테스트" 결과 반영). script 잘리면 인라인 `<script>`,
   그래도 안 되면 CSS-only 후퇴. data 속성 strip되면 재채점은 strip 전에 해야 함.

**출력이 둘**
- `dist/fragment.html` — 카페24에 실제 붙일 것. data 속성 제거 가능, 최소화.
- `dist/fragment.audit.html` — **재채점 전용. data-component 살린 채** export 변환만 거침.

마지막 재채점은 audit 버전을 렌더해서 한다. 안 그러면 "채점한 물건 ≠ 올리는 물건"이
재채점 자체를 막는다(채점엔 data-component 필요한데 납품본엔 없음). 변환은 똑같이 거치되
캡처 훅만 남긴 쌍둥이.

---

## 9. judge — 판단자 (대부분 결정론, AI는 수선에만)

"AI 판단자"를 풀어보면 흐름 결정은 코드로 충분하고 AI는 수선에만 필요하다.
판단자가 답하는 질문은 셋:
- 전 컴포넌트 통과 → **advance** (자동 → 사람 게이트로)
- 아직인데 진전 중 → **continue** (자동)
- 아직인데 정체 → **call_human** (게이트로 올림)

```js
function route(log, components, config) {
  const latest = latestPerComponent(log);
  const allPassed = components.every(c => latest[c.id]?.passed);
  if (allPassed) return { action: "advance" };

  const iter = maxIter(log);
  if (iter >= config.maxIterations)
    return { action: "halt_call_human", reason: "max_iterations", best: bestOf(log, components) };

  const failing = components.filter(c => !latest[c.id]?.passed);
  const stalled = failing.filter(c => isStalled(log, c.id, config.judge));
  if (stalled.length === failing.length && stalled.length > 0)
    return { action: "call_human", reason: "stall", stalled, best: bestOf(log, components) };

  return { action: "continue", targets: failing.map(c => c.id) };
}
```

**비결정론은 route에 없다.** AI가 드는 자리는 딱 하나 — `continue`일 때 "다음 회차에
뭘 어떻게 고칠까". 그게 에이전트 본체의 일(편집은 스크립트로 자동화 안 됨), 입력은
log의 `axes[*].notes`.
- route = 결정론 (계속/정지/호출 중 무엇). 빠르고 테스트 가능하고 재현됨.
- 고치기 = AI 에이전트 (어떻게). route가 continue·targets를 줬을 때만 발동.

**정체 감지**: `isStalled` = "최근 stallWindow회 동안 aggregate 개선폭이 모두 minDelta
미만". 시각 jitter 때문에 minDelta를 그 흔들림보다 위로. 게이트 무게를 결정론 신호 쪽에
실을수록 정체 판정 신뢰도 ↑.

**사람 호출 두 종류**
- `stall`: 회차 남았는데 막힘 → 사람이 방향 틀거나 spec 손봄.
- `max_iterations`: 소진 → best-of 들고 "이게 최선, 받을래 더 갈래".
둘 다 best 첨부하지만 묻는 게 다름.

---

## 10. 4번 루프 한 바퀴 (전체 종합)

```
assemble                       # 조각 → index.html + tokens.css emit
  → serve                      # 정적 서버 기동
  → capture (컴포넌트별)        # shot + computed 생산
  → score (신호 집계)           # → work/log.json append
  → route                      # 로그 읽고 흐름 결정
      ├ advance        → 사람 게이트 (디자인/구현 완성)
      ├ continue       → 에이전트가 axes.notes 읽고 src/components/<id>.html 수정 → 반복
      ├ call_human(stall)        → best 첨부, 사람 호출
      └ halt(max_iterations)     → best 첨부, 사람 호출
```

종료: 임계치 도달 OR 최대 회차 도달(결정론). 실패 시 best-of로 몰래 넘기지 않고
게이트로 올림.

마지막 재채점은 `src/index.html`이 아니라 export된 `dist/fragment.audit.html`을
렌더해서(원칙 1-5) "채점한 것 = 올리는 것"을 닫는다.

---

## 11. 두 요구가 서로를 보강한다

"AI 판단자"와 "재사용 하네스"는 충돌이 아니라 보강 관계다. AI 판단자에 프로젝트별
취향을 박으면 제일 재사용 안 되는 부분이 된다. 그런데 재사용 압력이 판단자에게
"측정 + config 정책 위에서만 판단하라"를 강제하고, 그게 곧 판단자가 vibes로 흘러가는 걸
막는 안전장치가 된다. 측정/결정 분리를 끝까지 밀면 도착하는 자연스러운 지점.

---

## 12. 의도적으로 안 한 것 (미래 위한 추상화 경계)

재사용처가 아직 불명확하므로 다음 네 이음새까지만 판다:
1. 신호 추출기 플러그인 인터페이스
2. 컴포넌트별 임계치·가중치 config
3. 스키마 검증 게이트
4. 판단자 정책의 config/프롬프트 외부화

모양이 안 보이는 것(플러그인 마켓 등)은 추상화하지 않는다 — 모르는 미래를 위한
추상화는 비용만 남는다. 루프 자체의 추상화도 쓸 곳이 명확해질 때까지 미룬다(다만
신호 인터페이스 형태로 일부는 이미 자연 도달).
