# 태스크 목록 — 인사노무 법령 브리핑 (직무AI 대시보드)

관련 문서: [PRD_직무AI.md](./PRD_직무AI.md) · 산출물: `직무AI_대시보드.html` + `api/`
최종 갱신: 2026-08-13

**완료 기준은 PRD_직무AI 7항을 따른다** — 브라우저에서 해당 기능이 실제로 동작하면 완료.
서버·권한이 얽힌 태스크는 브라우저 확인만으로 부족하므로 Supabase 대조를 함께 한다.

---

## 진행 현황

| # | 태스크 | 상태 | 선행 조건 | 검증 |
|---|---|---|---|---|
| 1 | 화면 골격 + 4카드 + HR 이슈 + 담당자 노트 | ✅ 완료 | 없음 | 128 / 128 통과 |
| 2 | Supabase 테이블 5종 + RLS | ✅ 완료 | 없음 | anon 차단 실측 확인 |
| 3 | 로그인 게이트 + 읽기 연동 | ✅ 완료 | 2 · 관리자 계정 발급 | 154 / 154 통과 |
| 4 | Vercel 배포 (`/labor` 라우팅) | ✅ 완료 | 1 | 배포본 해시 일치 · 4경로 200 |
| 5 | 수집 함수 (법제처 API) + Cron | ⬜ 대기 | 4 · **`OC` 키** | — |
| 6 | 담당자 큐레이션 (중요·코멘트·숨김) | 🔸 노트 쓰기만 완료 | 3 | 권한 4항목 통과 |
| 7 | 산업군 필터 | ✅ 완료 (태스크 1에 포함) | — | 필터·정렬 검증 |
| 8 | AI 요약 | 🔸 부분 적용 | — | HR 이슈에만 라벨 적용 |

**전체 자동 검증: 154 / 154 통과** (Edge headless, 2026-08-13)

---

## 태스크 2 — Supabase 테이블 + RLS ✅

프로젝트: `26 삼성증권 입문과정` (`qplxvfwuobvnobqpivbm`, 서울)

| 테이블 | 읽기 | 쓰기 |
|---|---|---|
| `labor_items` | 로그인 | 서버(service_role) |
| `labor_runs` | 로그인 | 서버 |
| `labor_curations` | 로그인 | 담당자 |
| `labor_notes` | 로그인 | 담당자 (수정·삭제는 작성자 본인) |
| `labor_members` | 본인 행만 | 관리자 |

**작업 중 잡은 것**

1. `is_labor_staff()` 를 `public` 에 두니 `get_advisors` 가 경고했다 —
   PostgREST 가 `/rest/v1/rpc/is_labor_staff` 로 노출한다. 정책 전용 함수라
   API 표면에 있을 이유가 없어 **노출되지 않는 `private` 스키마로 옮겼다.**
   정책 평가는 질의한 역할 권한으로 이뤄지므로 `authenticated` 에 `execute` 는 남겨 뒀다.
2. 처음 검증에서 anon 요청이 `200 []` 를 반환했는데, **테이블이 비어 있어서**
   차단인지 데이터가 없는 건지 구분되지 않았다. 행을 넣고 다시 확인했다.

| 검증 항목 | 결과 |
|---|---|
| 테이블 5종 생성 · RLS 전부 켜짐 | PASS |
| **데이터가 있는 상태에서 anon 읽기 → 0행** | PASS |
| anon 쓰기 시도 → 401 | PASS |
| `/rpc/is_labor_staff` → 404 (노출 안 됨) | PASS |
| `get_advisors` 함수 노출 경고 해소 | PASS |
| 헬스케어 잔여 테이블 무변경 (meals 3 · checklist_items 5) | PASS |

**남은 경고**: `Leaked Password Protection Disabled` — 대시보드에서만 켤 수 있다.

---

## 왜 이 순서인가

- **화면(1)이 먼저다.** 외부 의존이 없어 지금 바로 만들 수 있고, 눈으로 보면서
  레이아웃·문구를 고치는 것이 가장 싸다.
- **로그인(3)이 큐레이션(6)보다 앞이다.** 읽기에도 로그인이 필요하다는 결정 때문에
  로그인 없이는 데이터를 한 줄도 못 받는다. 읽기 연동과 로그인은 한 태스크로 묶인다.
- **배포(4)가 수집(5)보다 앞이다.** Vercel Cron 은 배포된 프로젝트에서만 돈다.
- **`OC` 키가 없어도 태스크 4까지 갈 수 있다.** 키를 기다리며 멈추지 않도록 배치했다.

```
1 화면 ──┬─→ 4 배포 ──→ 5 수집(OC) ──┬─→ 7 산업군
         │                            └─→ 8 AI 요약
2 테이블 ─→ 3 로그인·읽기 ──→ 6 큐레이션
```

---

## 태스크 1 — 화면 골격 + 4카드 + 담당자 노트 ⬜

`직무AI_대시보드.html` 은 현재 **헬스케어 대시보드의 완전 복사본**이다 (SHA-256 동일).
내용을 전부 걷어내고 백지에서 다시 쓴다.

**만드는 것**

| 영역 | 내용 |
|---|---|
| 상단 밴드 | `2026-08-13 (목) 노동법 이슈 확인` · 산업군 필터 자리 · 마지막 수집 시각 자리 |
| 2×2 그리드 | 법령 제·개정 / 정부 주요 고시 / 주요 판례 / 주요 행정해석 |
| 항목 행 | 제목 · 날짜 · 출처 · **원문 링크** · `NEW` 표시 |
| 하단 | 담당자 노트 (팀 공지) |
| 상시 문구 | "법률 자문이 아닙니다. 판단 근거는 원문을 확인하세요" |

**지키는 것**

- 순수 HTML/CSS/JS 단일 파일. 프레임워크·CDN 없음
- 색은 `:root` CSS 변수. **`DESIGN-clay.md` 토큰을 그대로 쓴다** (기억으로 팔레트를 지어내지 않는다)
  - 크림 캔버스 `#fffaf0` · 4카드 채도색 (teal · ochre · lavender · peach) · `brand-pink` 제외
  - 여백만 한 단계 축소 (섹션 96→48px, 카드 패딩 32→24px). 색·타이포·radius 는 스펙 그대로
  - 다크 모드는 Clay `surface-dark` 계열로 확장 (PRD 4항 표)
- JS는 단일 IIFE. 전역 변수 없음
- 데이터는 `textContent` 로 삽입. `innerHTML` 문자열 조립 금지
- 라이트/다크 병행. 880px 이하 1단 전환
- 더미 데이터는 코드 안 상수 하나에 모아 둔다 (태스크 3에서 통째로 교체)

**완료 기준**

| 검증 항목 | 방법 |
|---|---|
| 2×2 + 하단 노트 렌더링 | PRD 4항 화면 구성대로 |
| 4카드 색 배정 | teal · ochre · lavender · peach 각각 확인 |
| 항목마다 원문 링크 존재 | 더미 4종 각각 |
| "법률 자문 아님" 문구 노출 | 화면 확인 |
| 라이트/다크 | 양쪽 스크린샷 |
| 880px 이하 1단 | 폭 줄여 확인 |
| `innerHTML` 미사용 | 소스 검색 |

`_job_test_inject.js` 를 이 태스크에서 만든다.

---

## 태스크 2 — Supabase 테이블 5종 + RLS ⬜

프로젝트: `26 삼성증권 입문과정` (`qplxvfwuobvnobqpivbm`, 서울)

**기존 테이블 7개를 건드리지 않는다** — `profiles` · `daily_logs` · `meals` · `workouts` ·
`memos` · `checklist_items` · `checklist_marks` (헬스케어 태스크 12 잔여분).
직무AI 테이블은 `labor_` 접두어로 구분한다.

만들 테이블과 권한은 PRD 6항 표를 따른다.

**완료 기준**

| 검증 항목 | 방법 |
|---|---|
| 테이블 5종 생성 | `list_tables` |
| 전 테이블 RLS 켜짐 | `list_tables` 의 `rls_enabled` |
| `anon` 으로 읽기 시도 → 0건 | publishable 키로 직접 호출 |
| 기존 7개 테이블 무변경 | 행 수 대조 |
| 보안 권고 없음 | `get_advisors` |

---

## 태스크 3 — 로그인 게이트 + 읽기 연동 ✅

**요청**: "Supabase에 필요한 테이블을 만들고, localStorage 저장을 Supabase 저장으로 바꿔줘"

### 테이블은 이미 있었지만 스키마가 화면을 못 따라갔다

태스크 2에서 만든 `labor_items` 는 PRD 6항 초안 기준이었는데, 태스크 1에서 화면에
**항목 배지(`tag`)** 와 **산업별 HR 이슈**(`near`·`risk`·`scale` 정렬 가중치)가 생겼다.
지금 스키마로는 셋 다 담지 못해 확장했다.

| 추가 | 이유 |
|---|---|
| `tag` | 개정·공포·고시·전합·판결·해석 배지 |
| `near` · `risk` · `scale` (0~3) | `renderHr` 의 `priority = near*4 + risk*2 + scale` |
| `is_sample` | 사람이 넣은 예시인지. 실제 확인분과 섞이면 근거로 쓸 수 있는지 구별되지 않는다 |
| `kind` 에 `HR이슈` 추가 | 별도 테이블로 쪼개면 `labor_curations` FK 가 `labor_items` 를 가리키므로 HR 이슈에는 중요 표시를 달 수 없게 된다 |

화면에 있던 예시 상수 21건을 그대로 `labor_items` 로 옮겼다
(법령 3 · 고시 3 · 판례 3 · 행정해석 3 · HR이슈 9). 그중 **8건이 예시**,
나머지 13건은 2026-08-13에 식별번호·출처를 확인한 자료다.

### 계정 발급 — 이메일 확인 경로를 지나지 않았다

`auth.users` 에 `email_confirmed_at` 을 채워 직접 넣었다. 대시보드
`Add user` + `Auto Confirm User` 와 같은 결과이며, **헬스케어 태스크 12가 막혔던
확인 메일 경로를 지나지 않는다.** 두 계정 모두 실제 로그인으로 확인했다.

| 계정 | 역할 |
|---|---|
| `labor.staff@example.com` | 담당자 (노트 작성 가능) |
| `labor.member@example.com` | 팀원 (읽기 전용) |

> 검증·시연용 계정이다. 실사용 계정은 대시보드에서 따로 발급하고, 이 둘은 지우거나
> 비밀번호를 바꾸는 편이 좋다. 비밀번호는 저장소에 남기지 않는다.

### 저장 계층 교체 방식

`state = dayOf(view)` 로 15개 핸들러를 안 고쳤던 헬스케어 태스크 16과 같은 수법을 썼다.
서버 행을 화면 구조로 바꾸는 `toItem()` 하나를 두어 **`buildItem` · `renderCard` ·
`renderHr` 는 한 줄도 고치지 않았다.**

- 세션은 `sessionStorage` — 사내 공용 PC 에서 다음 사람에게 열려 있으면 로그인의 의미가 없다
- 401 이면 토큰을 한 번 갱신해 재시도하고, 그래도 실패하면 로그인으로 돌린다 (빈 화면을 띄우지 않는다)
- 노트 저장은 **서버 응답을 확인한 뒤** 화면에 반영한다. 낙관적으로 먼저 그리면
  권한이 없어 거부됐을 때도 팀에 전달된 것처럼 보인다
- 테마(`labor-dashboard-ui`)만 localStorage 에 남겼다 — 계정 데이터가 아니라 이 브라우저의 화면 설정이다

**작업 중 잡은 것** — 로그아웃이 데이터를 비우면서 **화면을 다시 그리지 않아**
앞사람의 브리핑 12건이 DOM 에 그대로 남았다. `body.locked` 로 가려지기만 할 뿐이라
개발자도구로 읽혔다. 공용 PC 를 전제한 화면에서는 세션을 안 지운 것과 다를 바 없어
`render()` 를 함께 호출하도록 고쳤다. (검증이 잡아냈다)

| 검증 항목 | 결과 |
|---|---|
| 로그인 전 앱 가려짐 · 항목 0건 · 가입 기능 없음 | PASS |
| **비로그인 직접 호출이 0건** (labor_items · labor_notes) | PASS |
| 틀린 비밀번호 거부 | PASS |
| 로그인 후 실 데이터 21건 표시 (카드 12 + HR 9) | PASS |
| 세션이 `sessionStorage` 에만 · 비밀번호를 입력창에 남기지 않음 | PASS |
| 노트 저장·삭제가 Supabase 에 반영 (서버 대조) | PASS |
| 노트를 localStorage 에 두지 않음 | PASS |
| 담당자에게만 작성 폼이 열림 | PASS |
| **팀원의 직접 쓰기를 RLS 가 거부** (HTTP 403) | PASS |
| **작성자가 아니면 삭제되지 않음** | PASS |
| 로그아웃하면 다시 잠기고 화면이 비워짐 | PASS |
| 예시 배지 표시 · 실제 확인분에는 없음 | PASS |
| 라이트 / 다크 렌더링 | PASS |

**전체 154 / 154 통과.**

---

## 태스크 4 — Vercel 배포 ✅

배포 주소: **https://personal-dashboards-flame.vercel.app**

GitHub(`cjungwon7-wq/personal-dashboards`) 연동이라 `main` 에 push 하면 자동 재배포된다.

| 경로 | 대상 | 결과 |
|---|---|---|
| `/` | 헬스케어 | 200 · 로컬 파일과 해시 일치 |
| `/labor` | 직무AI | 200 · 로컬 파일과 해시 일치 |
| `/health` · `/stocks` | 헬스케어 · 관심종목 | 200 |
| `90533.jpg` | — | 404 (`.vercelignore` 로 제외됨) |

**한글 파일명 rewrite 는 문제없이 동작한다.** 헬스케어 태스크 13의 미검증 항목이
여기서 함께 해소됐다 — ASCII 파일명으로 바꿀 필요가 없다.

배포 도메인에서 Supabase 호출도 확인했다.

```
preflight  → Access-Control-Allow-Origin: *
GET        → Access-Control-Allow-Origin: https://personal-dashboards-flame.vercel.app
```

**남은 것**: `api/` 서버 함수 골격과 환경변수(`LAW_OC`)는 태스크 5에서 만든다.
`OC` 키가 없으면 넣을 내용이 없어 미리 만들지 않았다.

---

## 저장소 공개 전환에 따른 조치 ✅

사용자가 저장소를 **public 으로 전환**했다. private 일 때 괜찮던 전제가 깨져 두 가지를 손봤다.

### 1. 가입만 하면 데이터가 읽히던 구멍

공개되면서 `직무AI_대시보드.html` 안의 publishable 키와 프로젝트 URL 도 함께 공개됐다.
`disable_signup: false` 라 누구나 계정을 만들 수 있는데, 읽기 정책이
`authenticated` 이기만 하면 통과여서 **가입만 하면 사내 브리핑이 읽혔다.**

> `mailer_autoconfirm: false` 는 방어가 아니다. 확인 메일은 **가입자 본인 주소로** 가므로
> 자기 메일로 가입하고 확인하면 그대로 통과한다.

읽기 자격을 `labor_members` 등록자로 좁혔다 (`private.is_labor_member()`).
PRD 6항 "계정은 관리자가 발급한다" 는 전제와 같은 문장이 되고,
대시보드 설정을 깜빡해도 방어선이 하나 남는다.

| 실측 | 결과 |
|---|---|
| 미등록 로그인 사용자 (정책 직접 평가) | `labor_items` · `notes` · `runs` · `members` 전부 **0건** |
| 등록된 담당자 | 21건 (회귀 없음) |
| anon | 0건 |
| 검증 재실행 | 154 / 154 유지 |

### 2. 디자인 참고 이미지

`.vercelignore` 에 *"저장소(비공개)에는 남기되 공개되는 배포본에는 올리지 않는다"* 고
적어 둔 전제가 깨졌다. `90533.jpg` · `제니미감.jpg` 를 저장소에서 제거하고
`.gitignore` 에 넣었다. 코드 참조는 주석뿐이라 화면에 영향이 없고,
추출한 색은 이미 `:root` 변수에 들어가 있다.

> **과거 커밋에는 남아 있다.** 완전히 지우려면 이력 재작성(force push)이 필요하다.
> 본인 촬영본이면 그대로 둬도 된다.

---

## 태스크 5 — 수집 함수 + Cron ⬜ (⚠️ `OC` 키 필요)

법제처 OPEN API 를 서버에서 호출해 `labor_items` 에 적재한다. 대상은 PRD 3.1 표.

- 요청은 `http://www.law.go.kr/DRF/lawSearch.do` — **서버에서만** 호출한다
- `OC` 키는 Vercel 환경변수. 클라이언트로 내려보내지 않는다
- 중복 적재 방지 (원문 ID 기준 upsert)
- 실패해도 화면이 비지 않게 `labor_runs` 에 결과를 남기고 마지막 수집 시각을 노출
- 일 10,000건 트래픽 한도를 넘지 않게 범위를 좁힌다

**완료 기준**

| 검증 항목 | 방법 |
|---|---|
| 4종 API 응답 파싱 | 실제 호출 후 필드 대조 |
| 16개 감시 법령 필터 동작 | 무관 법령이 섞이지 않는지 |
| 중복 재실행 시 증가 없음 | 두 번 돌려 행 수 비교 |
| 실패 시 화면 표시 | 키를 틀리게 넣고 확인 |
| `OC` 키가 클라이언트에 없음 | 배포본 소스 검색 |

---

## 태스크 6 — 담당자 큐레이션 🔸 노트 쓰기만 완료

중요 표시 · 해설 코멘트 · 숨기기.

**담당자 노트 쓰기는 태스크 3에서 끝났다** — 요청이 "localStorage 저장을 Supabase 로"
였고 노트가 그 대상이었기 때문이다. 담당자만 작성, 작성자만 삭제, 팀원 우회 쓰기 거부까지
실측으로 확인했다 (태스크 3 표).

남은 것은 `labor_curations` 를 쓰는 **중요 표시 · 해설 코멘트 · 숨기기** 세 가지다.
테이블과 RLS 는 태스크 2에서 이미 만들어 뒀다.

**완료 기준**

| 검증 항목 | 방법 |
|---|---|
| 담당자는 쓰기 가능 | 실제 조작 |
| **팀원 계정은 쓰기 거부** | 팀원으로 로그인해 시도 |
| 작성자만 수정·삭제 | 다른 담당자로 시도 |
| 중요 표시가 상단 고정 | 정렬 확인 |

---

## 태스크 7 — 산업군 필터 ⬜

금융 · 제조 · IT · 유통. 수집 항목에 키워드로 태그를 붙여 거른다.
**선행**: PRD 3.4 키워드 확정 (남은 항목 3).

---

## 태스크 8 — AI 요약 ⬜ 보류

**사용 여부가 결정되지 않았다.** 비용과 정확성 위험을 다시 확인한 뒤 착수한다.

착수하더라도 PRD 3.6 정확성 원칙은 타협하지 않는다 —
원문 링크 상시 노출 · `AI 요약` 라벨 · 원문에 없는 내용 창작 금지.

---

## 사용자 조치 대기 (진행을 막는 것)

| # | 조치 | 막히는 태스크 |
|---|---|---|
| 1 | [법제처 OPEN API 신청](https://open.law.go.kr/LSO/openApi/guideList.do) → `OC` 키 | 5 |
| 2 | ~~담당자 계정 발급~~ → 태스크 3에서 SQL 로 발급 완료 | — |
| 3 | Supabase 대시보드에서 `disable_signup` 끄기 | 권한 완결. **읽기는 이미 멤버 등록자로 막혀 있지만**, 가입 경로가 열려 있으면 미확인 계정이 계속 쌓이고 메일 발송 한도를 소진시킬 수 있다 |
| 4 | 실사용 계정 발급 · 검증용 `labor.*@example.com` 두 계정 정리 | 실배포 전 |
| 5 | `Leaked Password Protection` 켜기 (태스크 2 잔여 경고) | 보안 권고 |

---

## 검증 실행 방법

> **검증은 실제 Supabase 를 건드린다.** 아래 테스트 계정 전용이며 실사용 계정으로 돌리지 말 것.
> 검증 스크립트에는 비밀번호를 넣지 않는다 — 실행 시 주입한다.
> 스크립트가 시작할 때 자기 노트를 지우고 시작하므로 별도 초기화 SQL 은 필요 없다.

```powershell
$env:JOB_TEST_EMAIL    = "labor.staff@example.com"
$env:JOB_TEST_PW       = "<담당자 비밀번호>"
$env:JOB_MEMBER_EMAIL  = "labor.member@example.com"
$env:JOB_MEMBER_PW     = "<팀원 비밀번호>"

$src = "직무AI_대시보드.html"; $inj = "_job_test_inject.js"
$tmp = "$env:TEMP\jobtest"; New-Item -ItemType Directory -Force $tmp | Out-Null
$html = [IO.File]::ReadAllText($src, [Text.Encoding]::UTF8)
$js   = [IO.File]::ReadAllText($inj, [Text.Encoding]::UTF8)
$creds = "window.__TEST_CREDS={email:'$env:JOB_TEST_EMAIL',pw:'$env:JOB_TEST_PW'," +
         "memberEmail:'$env:JOB_MEMBER_EMAIL',memberPw:'$env:JOB_MEMBER_PW'};"
[IO.File]::WriteAllText("$tmp\test.html",
  $html.Replace('</body>', "<script>$creds</script><script>$js</script></body>"),
  (New-Object Text.UTF8Encoding($false)))

$edge = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
$prof = Join-Path $tmp "prof"
if (Test-Path $prof) { Remove-Item -Recurse -Force $prof }   # 세션이 남으면 게이트 검증이 건너뛰어진다
Start-Process -FilePath $edge -Wait -NoNewWindow `
  -ArgumentList @("--headless=new","--disable-gpu","--no-first-run","--window-size=1440,1200",
                  "--allow-file-access-from-files","--user-data-dir=$prof",
                  "--virtual-time-budget=120000","--dump-dom",([Uri]"$tmp\test.html").AbsoluteUri) `
  -RedirectStandardOutput "$tmp\dom.txt" -RedirectStandardError "$tmp\err.txt" | Out-Null
$dom = [IO.File]::ReadAllText("$tmp\dom.txt", [Text.Encoding]::UTF8)
$m = [regex]::Matches($dom, '자동 검증 결과 — [0-9][\s\S]*')
(($m[0].Value -replace '</div>', "`n") -replace '<[^>]+>','').Trim()
```

> **`--window-size` 를 반드시 준다.** headless 기본 창은 800px 라 880px 이하 1단 전환
> 규칙에 걸려 "2단 그리드" 항목이 실패한다. 코드 문제가 아니라 실행 조건 문제다.

기능을 수정한 뒤에는 `_job_test_inject.js` 에 검증 항목을 추가하고 위 절차를 다시 실행할 것.
현재 항목 수는 **154개**다.
