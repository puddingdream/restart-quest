# Re:Start Quest MVP 정본 설계

## 1. 제품 결정

TASK-001의 명시적 요청을 Re:Start Quest 제품 선택으로 간주한다. `PROJECT_BRIEF.md`가 보존한 문제 인식을 이어받되, 첫 릴리스는 취업 정보나 지원서 관리가 아니라 **막힌 구직 행동을 더 작은 다음 행동으로 바꾸는 재진입 루프**만 검증한다.

- 대상 사용자: 취업 공백이나 반복된 거절 뒤 무엇부터 다시 해야 할지 막힌 구직자
- 핵심 문제: 큰 목표와 실패 기록이 부담이 되어 다음 행동을 시작하지 못한다.
- 가치 제안: 사용 가능한 시간과 에너지를 입력하면 오늘 끝낼 수 있는 작은 행동 하나를 받고, 막혔을 때 이유를 선택하면 즉시 더 쉬운 행동으로 이어진다.
- 차별점: 할 일 목록이나 연속 달성률이 아니라 `막힘 → 난이도 축소 → 재시도`의 상태 변화를 제품의 중심에 둔다.
- MVP 성공 신호: 신규 사용자가 가입부터 첫 행동 생성까지 완료하고, 같은 세션에서 완료 또는 막힘 후 축소 행동 생성까지 서버에 기록할 수 있다.

이 문서는 TASK-001 구현 계약이다. 구현 중 제품·API·공유 UI 계약 변경이 필요하면 각 구현자가 임의로 넓히지 않고 Design에 변경 제안을 남긴다.

## 2. 사용자 목표와 금지 범위

### 사용자가 달성해야 하는 것

1. 계정을 만들고 자신의 기록만 안전하게 조회한다.
2. 오늘의 에너지, 가용 시간, 집중 영역을 30초 안에 입력한다.
3. 조건에 맞는 작은 구직 행동 하나를 확인한다.
4. 행동을 완료하거나, 막힌 이유를 선택하고 더 쉬운 행동으로 즉시 다시 시작한다.
5. 최근 기록에서 완료와 재시도 과정을 확인한다.

### 제품이 하지 않는 것

- 취업 성공, 합격 가능성, 치료 효과를 보장하지 않는다.
- 연속 달성률 손실, 순위, 벌점처럼 실패를 압박하는 장치를 두지 않는다.
- 이력서 원문, 채용 공고, 건강 정보, 상담 기록, 자유 형식 일기를 수집하지 않는다.
- 사용자의 막힘 메모를 AI 학습·분석·진단에 사용하지 않는다.
- 임의의 LLM 출력을 바로 행동으로 노출하지 않는다. MVP 추천은 검증된 행동 카탈로그와 결정 규칙으로 재현 가능해야 한다.
- 다른 사용자의 데이터 식별자만으로 기록을 읽거나 바꿀 수 없게 한다.

UI에는 “Re:Start Quest는 구직 행동 정리 도구이며 전문 상담이나 의료 서비스를 대신하지 않습니다.”라는 짧은 경계 문구를 가입 화면과 설정/프로필 영역에 노출한다.

## 3. MVP와 후순위

### 첫 릴리스에 포함

- 이메일·비밀번호 가입, 로그인, 로그아웃, 현재 사용자 조회
- 오늘 체크인: 에너지 3단계, 가용 시간 5/15/30분, 집중 영역 4종
- 규칙 기반 행동 카탈로그와 오늘의 행동 생성
- 행동 완료 기록
- 막힌 이유 선택과 선택적 300자 메모, 더 쉬운 후속 행동 생성
- 오늘 상태와 최근 14일 기록 조회
- 데스크톱과 모바일 웹 반응형 UI, 키보드 사용, 오류/빈 상태/로딩 상태
- PostgreSQL 영속화, 스키마 마이그레이션, 상태 점검, 컨테이너 실행과 smoke 검증

### 후순위 후보

- 소셜 로그인, 이메일 인증·비밀번호 재설정
- 알림, 캘린더, 연속 기록, 배지 및 소셜 기능
- 채용 공고·지원 현황 관리, 이력서 파일 업로드
- 개인화 AI 추천과 자유 형식 코칭
- 관리자용 카탈로그 편집 화면과 분석 대시보드
- 네이티브 모바일 앱, 다국어, 외부 캘린더 연동

후순위 기능은 첫 릴리스 데이터/API에 미리 끼워 넣지 않는다. 계정 삭제와 개인정보 정책의 법적 문구는 공개 운영 전 별도 검토가 필요하며, 이번 데모 릴리스에서는 운영 Runbook의 배포 전 점검 항목으로 다룬다.

## 4. 핵심 도메인 계약

### 값과 소유권

| 개념 | 핵심 필드 | 불변조건 |
| --- | --- | --- |
| `Account` | `id`, `email`, `passwordHash`, `createdAt` | 이메일은 정규화 후 유일하다. 비밀번호 원문은 저장·로그하지 않는다. |
| `DailyCheckIn` | `id`, `accountId`, `localDate`, `energyLevel`, `availableMinutes`, `focusArea` | 계정·로컬 날짜당 하나만 존재한다. 서버가 지원하는 시간대는 MVP에서 `Asia/Seoul`로 고정한다. |
| `Quest` | `id`, `accountId`, `checkInId`, `templateKey`, `title`, `estimatedMinutes`, `difficulty`, `status`, `predecessorQuestId`, `version` | 계정당 활성 행동은 하나다. 후속 행동은 같은 계정과 체크인에 속하며 이전 행동보다 어렵거나 길 수 없다. |
| `QuestOutcome` | `id`, `questId`, `type`, `barrier`, `note`, `createdAt` | 행동당 종료 결과는 하나다. `barrier`는 `BLOCKED`에만 필수이고 메모는 300자 이하이다. |
| `ActionTemplate` | 코드 내 정본 `key`, `focusArea`, `difficulty`, `minutes`, `fallbackKey` | `fallbackKey` 연결은 순환하지 않고 더 짧거나 쉬운 행동으로 끝난다. |

열거형은 다음 값으로 고정한다.

- `energyLevel`: `LOW`, `MEDIUM`, `HIGH`
- `availableMinutes`: `5`, `15`, `30`
- `focusArea`: `EXPLORE`, `RESUME`, `APPLY`, `INTERVIEW`
- `quest.status`: `ACTIVE`, `COMPLETED`, `REPLACED`
- `outcome.type`: `COMPLETED`, `BLOCKED`
- `barrier`: `TOO_LARGE`, `NO_TIME`, `LOW_ENERGY`, `UNCLEAR`, `EMOTIONAL_LOAD`, `OTHER`

### 추천 규칙과 초기 카탈로그

추천 난이도 상한은 에너지(`LOW=1`, `MEDIUM=2`, `HIGH=3`)와 시간(`5분=1`, `15분=2`, `30분=3`)의 최솟값이다. 서버는 선택한 집중 영역에서 상한 이하인 가장 높은 난이도 템플릿 하나를 고른다. 동일 카탈로그 버전과 입력이면 항상 같은 `templateKey`를 반환하며 무작위 선택을 하지 않는다.

| 집중 영역 | 난이도/분 | `templateKey`와 제목 | `fallbackKey` |
| --- | --- | --- | --- |
| `EXPLORE` | 3/30 | `explore.compare`: 채용 공고 3개에서 공통 기술 하나 찾기 | `explore.requirement` |
| `EXPLORE` | 2/15 | `explore.requirement`: 채용 공고 하나에서 요구 기술 하나 표시하기 | `explore.keyword` |
| `EXPLORE` | 1/5 | `explore.keyword`: 관심 직무 검색어 하나 적기 | `explore.pause` |
| `EXPLORE` | 0/2 | `explore.pause`: 내일 다시 볼 탐색 한 문장 남기기 | 없음 |
| `RESUME` | 3/30 | `resume.result`: 경험 한 건을 성과형 문장으로 다시 쓰기 | `resume.verb` |
| `RESUME` | 2/15 | `resume.verb`: 경력 한 줄의 동사와 결과 다듬기 | `resume.pick` |
| `RESUME` | 1/5 | `resume.pick`: 고칠 경력 한 줄 표시하기 | `resume.pause` |
| `RESUME` | 0/2 | `resume.pause`: 내일 다시 볼 이력서 한 문장 남기기 | 없음 |
| `APPLY` | 3/30 | `apply.motivation`: 공고 하나에 맞춰 지원 동기 첫 문장 쓰기 | `apply.match` |
| `APPLY` | 2/15 | `apply.match`: 요구사항 하나와 내 경험 하나 연결하기 | `apply.open` |
| `APPLY` | 1/5 | `apply.open`: 지원 후보 공고 하나 열고 제목 적기 | `apply.pause` |
| `APPLY` | 0/2 | `apply.pause`: 내일 다시 볼 공고 한 문장 남기기 | 없음 |
| `INTERVIEW` | 3/30 | `interview.star`: 질문 하나에 STAR 답변 초안 만들기 | `interview.points` |
| `INTERVIEW` | 2/15 | `interview.points`: 답변의 상황·행동·결과 핵심어 적기 | `interview.question` |
| `INTERVIEW` | 1/5 | `interview.question`: 연습할 면접 질문 하나 고르기 | `interview.pause` |
| `INTERVIEW` | 0/2 | `interview.pause`: 내일 다시 볼 질문 한 문장 남기기 | 없음 |

난이도 0 안전 행동은 일반 추천으로 선택하지 않고 난이도 1 행동이 막혔을 때만 생성한다. 안전 행동에는 다시 `막힘` 동작을 노출하지 않으며, 해당 ID로 block API를 직접 호출하면 상태를 바꾸지 않고 `409 NO_SMALLER_QUEST`를 반환한다.

### 상태 전이

```text
오늘 체크인 없음
  -> 체크인 생성 + 조건에 맞는 ACTIVE 행동 1개 생성
  -> [완료] 행동 COMPLETED + COMPLETED 결과 기록
  -> [막힘] 기존 행동 REPLACED + BLOCKED 결과 기록
             + fallbackKey의 더 쉬운 ACTIVE 행동 생성
  -> 후속 행동에서도 완료 또는 막힘 반복
```

- `COMPLETED`와 `REPLACED`는 다시 활성화하지 않는다.
- 완료/막힘 명령은 `version`을 받아 낙관적 잠금으로 중복 클릭과 경합을 거부한다.
- 막힘 처리에는 항상 실제로 더 쉬운 후속 행동이 있어야 한다. 카탈로그의 최저 단계가 다시 막히면 2분짜리 “내일 다시 볼 한 문장 남기기” 안전 행동을 생성한다.
- 추천 규칙은 `(focusArea, availableMinutes, energyLevel)`과 카탈로그 버전만으로 같은 결과를 내야 한다. 추천 이유도 템플릿 문구로 함께 반환한다.

## 5. HTTP API 계약 v1

모든 응답은 JSON이며 날짜·시간은 ISO 8601을 사용한다. 인증은 서버 세션 쿠키로 처리한다. 운영 쿠키는 `HttpOnly`, `Secure`, `SameSite=Lax`를 적용하고 모든 변경 요청은 CSRF 토큰을 요구한다. 비인증 응답은 `401`, 다른 사용자의 리소스는 존재 여부를 숨기기 위해 `404`로 반환한다.

### 공통 오류

```json
{
  "code": "ACTIVE_QUEST_CONFLICT",
  "message": "사용자에게 보여 줄 안전한 설명",
  "fieldErrors": { "email": "올바른 이메일을 입력해 주세요." },
  "traceId": "로그 상관관계 식별자"
}
```

`code`는 안정적인 기계 판독 값이고 `message`에는 예외, SQL, 이메일, 세션 값이 포함되지 않는다. 주요 코드는 `VALIDATION_ERROR`, `AUTH_REQUIRED`, `INVALID_CREDENTIALS`, `EMAIL_ALREADY_USED`, `RESOURCE_NOT_FOUND`, `ACTIVE_QUEST_CONFLICT`, `STALE_QUEST`, `CHECK_IN_ALREADY_EXISTS`, `NO_SMALLER_QUEST`, `RATE_LIMITED`, `INTERNAL_ERROR`이다.

### 인증

| 메서드/경로 | 요청 | 성공 | 주요 오류 |
| --- | --- | --- | --- |
| `GET /api/v1/auth/csrf` | 없음 | `200 {token,headerName}` 및 CSRF 쿠키 | - |
| `POST /api/v1/auth/register` | `{email,password}` | `201 {user}`와 세션 생성 | `400`, `409 EMAIL_ALREADY_USED`, `429` |
| `POST /api/v1/auth/login` | `{email,password}` | `200 {user}`와 세션 교체 | `401 INVALID_CREDENTIALS`, `429` |
| `POST /api/v1/auth/logout` | 없음 | `204`와 세션 무효화 | `401` |
| `GET /api/v1/auth/me` | 없음 | `200 {user}` | `401` |

클라이언트는 CSRF 응답의 `headerName`(MVP 기본값 `X-CSRF-TOKEN`)을 하드코딩하지 않고 그대로 사용한다. 가입·로그인 성공으로 세션이 교체되면 이전 토큰을 폐기하고 다음 변경 요청 전에 새 토큰을 조회한다.

비밀번호는 10~72자이며 서버에서 강한 단방향 해시를 사용한다. 로그인은 정규화 이메일과 IP 조합당 연속 실패 5회 뒤 15분, 가입은 IP당 1시간에 5회로 제한한다. 제한 응답은 `429 RATE_LIMITED`와 초 단위 `Retry-After`를 반환한다. 성공한 로그인은 해당 이메일/IP 실패 횟수를 초기화한다. 인증 실패 메시지는 계정 존재 여부를 구분하지 않는다.

### 오늘과 행동

| 메서드/경로 | 요청 | 성공 | 주요 오류 |
| --- | --- | --- | --- |
| `GET /api/v1/today` | 없음 | `200 TodayView` | `401` |
| `POST /api/v1/check-ins` | `{energyLevel,availableMinutes,focusArea}` | `201 TodayView` | `400`, `409 CHECK_IN_ALREADY_EXISTS` |
| `POST /api/v1/quests/{questId}/complete` | `{version}` | `200 TodayView` | `404`, `409 STALE_QUEST` |
| `POST /api/v1/quests/{questId}/block` | `{version,barrier,note?}` | `200 TodayView`와 새 `activeQuest` | `400`, `404`, `409 STALE_QUEST` |
| `GET /api/v1/history?from=YYYY-MM-DD&to=YYYY-MM-DD` | 최대 31일 범위 | `200 {days:[...]}` | `400`, `401` |

`TodayView.phase`는 `CHECK_IN_REQUIRED`, `QUEST_ACTIVE`, `DAY_COMPLETED` 중 하나다. 각 phase에 필요 없는 필드는 `null`이며, 클라이언트는 문자열 문구가 아니라 phase로 화면을 결정한다.

```json
{
  "date": "2026-09-03",
  "phase": "QUEST_ACTIVE",
  "checkIn": {
    "energyLevel": "LOW",
    "availableMinutes": 5,
    "focusArea": "RESUME"
  },
  "activeQuest": {
    "id": "uuid",
    "title": "경력 한 줄에서 동사 하나 바꾸기",
    "estimatedMinutes": 5,
    "difficulty": 1,
    "reason": "에너지가 낮아 5분 안에 끝낼 수 있는 행동을 골랐어요.",
    "version": 0,
    "predecessorQuestId": null
  },
  "completedQuest": null
}
```

모든 쓰기 서비스는 인증된 `accountId`를 경로 ID보다 먼저 적용해 소유권을 확인한다. 체크인 생성, 완료, 막힘 처리는 각각 하나의 데이터베이스 트랜잭션이다.

## 6. 화면과 사용자 흐름

### 정보 구조

```text
비인증
  랜딩 -> 가입 / 로그인

인증
  오늘(기본) -> 체크인 -> 오늘의 행동 -> 완료 또는 막힘 재설계
  기록       -> 최근 14일 완료·재시도 타임라인
  계정       -> 경계 문구, 로그아웃
```

### 화면별 구현 기준

1. **랜딩/인증**: 첫 화면 제목 아래에 “막히면 더 작게, 오늘 다시 시작하기”와 시작 버튼 하나를 우선 노출한다. 인증 오류는 폼 상단과 해당 필드에 연결하며 비밀번호 값을 보존하지 않는다.
2. **오늘 체크인**: 에너지·시간·집중 영역을 한 화면의 큰 선택 버튼으로 제공한다. 기본값을 임의 선택하지 않고 세 그룹을 모두 고른 뒤에만 제출한다.
3. **오늘의 행동**: 제목, 예상 시간, 추천 이유를 한 읽기 영역에 배치한다. 주 동작은 `완료했어요`, 보조 동작은 `지금은 막혔어요`다. 대시보드 카드 여러 개로 핵심 행동을 밀어내지 않는다.
4. **막힘 재설계**: 이유 6개를 선택하고 선택적 메모를 입력한다. 제출 후 기존 행동과 더 쉬워진 지점을 함께 보여 주되 실패·벌점 표현을 사용하지 않는다.
5. **완료**: 오늘의 완료 문구와 기록 보기만 제공한다. 같은 날 새 행동을 강요하지 않는다.
6. **기록**: 날짜별 체크인과 행동 결과를 최신순 타임라인으로 표시한다. 기록이 없으면 오늘 체크인으로 이동시키고, 막힘 메모는 작성자에게만 보인다.

### 상태와 접근성

- 변경 요청 중 버튼을 비활성화하고 한 번의 진행 표시만 보인다. 중복 요청이 `STALE_QUEST`면 `GET /today`로 재동기화한다.
- 네트워크 오류는 입력을 유지한 채 재시도를 제공한다. 인증 만료는 로그인으로 이동하되 복구 가능한 목적 경로를 보존한다.
- 320px에서도 가로 스크롤과 텍스트 겹침이 없어야 하며, 읽기 본문은 최대 680px로 제한한다.
- 본문 16px 이상, 보조문 14px 이상, 터치 대상 44px 이상, 명도 대비 WCAG AA를 목표로 한다.
- 색만으로 상태를 구분하지 않고 텍스트·아이콘을 함께 쓴다. 모든 폼에는 label, 오류 연결, 보이는 포커스가 있어야 한다.
- 검증 viewport는 `360x800`, `768x1024`, `1440x900`이다.

## 7. 기술 및 품질 기준

- Backend: Java 21, Spring Boot, Gradle, Spring Security 세션, Spring Data JPA, Flyway, PostgreSQL.
- Frontend: React, TypeScript, Vite. 서버 상태는 쿼리 캐시 계층으로 관리하고 API 열거형을 화면 문구와 분리한다.
- 배포: 같은 origin에서 SPA와 `/api`를 제공하는 컨테이너 구성을 기본으로 하여 CORS와 쿠키 복잡도를 줄인다.
- 시간: 서버 도메인 기준일은 `Asia/Seoul`, 저장 timestamp는 UTC이다. 테스트는 Clock 주입으로 자정 경계를 고정한다.
- 로그: `traceId`, 결과 코드, 지연 시간만 구조화해 기록한다. 이메일, 메모, 비밀번호, 쿠키, CSRF 토큰은 로그에서 제외한다.
- 테스트: 도메인 상태 전이와 카탈로그 fallback은 단위 테스트, 소유권·트랜잭션·세션·CSRF는 통합 테스트, 가입→체크인→막힘→축소 행동→완료→기록은 브라우저 smoke 테스트로 검증한다.

## 8. 구현 Slice와 진입 조건

| Slice | 목적과 사용자 흐름 | Backend 작업 | Frontend 작업 | QA 기준 | 제외 범위 | 다음 진입 조건 |
| --- | --- | --- | --- | --- | --- | --- |
| S0 기반 | 실행 가능한 양쪽 기반을 만든다. | 빌드, DB/Flyway, health, 공통 오류·시간·보안 경계 | Vite, 공통 스타일·폼·API 클라이언트 기반 | 양쪽 단위 테스트와 health 통과 | 기능 화면 | 기반 계약 테스트 통과 |
| S1 신원 | 가입 후 자신의 세션으로 진입한다. | 가입/로그인/로그아웃/me, CSRF, 제한 | 인증 화면은 S2와 함께 연결 | 타 계정 은닉, 세션 교체, CSRF 거부 검증 | OAuth, 재설정 | identity API 통합 테스트 통과 |
| S2 재진입 루프 | 체크인→행동→막힘→축소 행동→완료를 수행한다. | 체크인, 추천, 상태 전이, 기록 API | 인증·체크인·행동·막힘·완료·기록 전체 화면 | 양성·음성·경합 회귀표와 핵심 E2E 통과 | AI, 공고/이력서 | 통합 head에서 핵심 E2E 통과 |
| S3 릴리스 후보 | 새 환경에서 같은 revision을 실행한다. | 이미지, 환경 설정, health/rollback | 정적 빌드, same-origin 프록시 | compose 기동과 브라우저 smoke, 모바일 viewport | 운영 인프라 자동화 | Runbook과 통합 검증 증거 확보 |

### 실행 패키지 DAG

아래 표는 구현 역할이 따라야 할 정본 분해다. AgentFlow `designBacklog`는 이 표와 같은 ID와 의존성을 사용해야 한다. `dependsOn`은 계약 또는 실행에 실제로 필요한 선행 작업만 뜻하며, 배열에 없는 패키지는 병렬 실행할 수 있다.

```text
backend-platform -> backend-identity -> backend-quest-loop ----┐
                                                               ├-> release-runtime -> release-e2e
frontend-shell -----> frontend-auth -> frontend-quest-flow ----┘
```

| Package ID | 역할 | 목표 | 완료 조건 요약 |
| --- | --- | --- | --- |
| `backend-platform` | `backend-infra` | Java 21/Spring Boot/Gradle 기반, 공통 오류, Clock, PostgreSQL/Flyway, 세션·CSRF 기본 경계와 health를 만든다. | 새 DB 설정의 application context와 health 통합 테스트가 통과하고 secret/개인정보가 로그에 남지 않는다. |
| `frontend-shell` | `frontend-ui` | React/Vite 기반, 반응형 앱 셸, 디자인 토큰, 접근 가능한 폼·오류·로딩 기본 컴포넌트를 만든다. | 단위 테스트가 통과하고 360/768/1440px 기준에서 셸이 겹치거나 가로 스크롤되지 않는다. |
| `backend-identity` | `backend` | 가입·로그인·로그아웃·현재 사용자, 세션 교체, CSRF와 소유 계정 식별 계약을 구현한다. | 정상 인증, 중복 이메일, 계정 열거 방지, 세션 교체, CSRF 거부와 rate limit 통합 테스트가 통과한다. |
| `backend-quest-loop` | `backend` | 체크인, 결정적 추천, 완료·막힘 상태 전이, 더 쉬운 후속 행동과 14일 기록 API를 구현한다. | 양성 흐름과 타 계정 접근, 중복/오래된 version, fallback 종료, 자정 경계 테스트가 통과한다. |
| `frontend-auth` | `frontend-state` | CSRF 포함 API 클라이언트, 인증 서버 상태, 보호 라우트와 가입·로그인·계정 화면을 구현한다. | 세션 복원·만료·폼 오류·재시도 테스트가 통과하고 비밀번호를 보존하거나 로그에 남기지 않는다. |
| `frontend-quest-flow` | `frontend` | 체크인→행동→막힘→축소 행동→완료→기록 화면 흐름과 상태 복구를 구현한다. | 계약 기반 UI 테스트와 키보드/오류/빈 상태 테스트가 통과하며 `STALE_QUEST` 뒤 오늘 상태를 재동기화한다. |
| `release-runtime` | `backend-infra` | backend, frontend, PostgreSQL을 같은 origin으로 실행하는 컨테이너 구성과 Runbook을 만든다. | 새 환경에서 build·기동·health 확인이 가능하고 백업·rollback 절차가 문서화된다. |
| `release-e2e` | `frontend` | 통합 runtime을 대상으로 핵심 브라우저 여정과 세 viewport smoke를 자동화한다. | 가입→체크인→막힘→축소→완료→기록 E2E와 360x800, 768x1024, 1440x900 검증이 같은 통합 head에서 통과한다. |

패키지별 파일 경계는 다음과 같다. 공통 파일 수정이 필요한 후행 패키지는 선행 패키지 완료 뒤에만 수정하고, 다른 범위로 계약을 넓혀야 하면 먼저 Design 변경 제안을 남긴다.

- `backend-platform`: `backend` 빌드 파일, 애플리케이션 진입점, `common`/`config`, 기본 설정과 platform 테스트
- `backend-identity`: `auth` 모듈, identity migration과 auth 테스트
- `backend-quest-loop`: `quest` 모듈, quest migration과 quest 테스트
- `frontend-shell`: frontend 빌드 파일, `app`/`components`/`styles`/`public`과 공통 UI 테스트 기반
- `frontend-auth`: `features/auth`, `lib/api`, `lib/query`
- `frontend-quest-flow`: `features/today`, `features/history`
- `release-runtime`: 컨테이너 파일, same-origin 웹 서버 설정, `compose.yaml`, `docs/RUNBOOK.md`, smoke script
- `release-e2e`: Playwright 설정·의존성과 `frontend/e2e`

각 slice의 검증 증거에는 사용한 PR head SHA와 명령, 기대 결과, 실제 결과를 남긴다. 개별 패키지가 통과해도 `release-e2e`가 같은 통합 head에서 통과하기 전에는 TASK-001 완료로 보고하지 않는다.

## 9. 릴리스 완료 조건

- 새 데이터베이스에서 문서 명령으로 backend, frontend, PostgreSQL이 기동되고 health가 정상이다.
- 사용자가 가입→체크인→추천 확인→막힘 이유 제출→더 쉬운 행동 확인→완료→최근 기록 확인을 한 브라우저 세션에서 수행한다.
- 다른 계정은 리소스 UUID를 알아도 조회·변경할 수 없다.
- 중복 클릭과 오래된 version 요청이 결과를 두 번 만들지 않는다.
- 모바일·태블릿·데스크톱 viewport에서 핵심 CTA, 오류, 빈 상태가 읽히고 키보드로 조작된다.
- 단위·통합·E2E 테스트가 같은 통합 head에서 통과하며 실행하지 못한 항목은 통과로 기록하지 않는다.
- 저장소에 secret, 실제 운영 자격 증명, 생성된 build output이나 dependency cache가 포함되지 않는다.
- Runbook에 준비, 실행, health check, 데이터 백업, rollback 절차가 함께 기록된다.
