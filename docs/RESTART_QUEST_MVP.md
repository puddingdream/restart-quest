# Re:Start Quest 첫 릴리스 정본 설계

## 1. 결정 상태

- 대상: TASK-001 첫 릴리스 가능한 MVP
- 제품: 취업 공백자가 실패 뒤 더 작은 구직 행동으로 다시 진입하도록 돕는 웹 애플리케이션
- 핵심 가설: 사용자가 행동 실패 원인을 고르면, 원래 목표와 이력을 잃지 않은 채 수행 난도가 낮은 다음 행동을 즉시 만들 수 있다.
- 근거 경계: 이 가설은 TASK-001의 구현 방향이며 경쟁 서비스 대비 우위가 검증되었다는 뜻은 아니다.
- 기술 기준: Java 21/Spring Boot 3 계열 백엔드, PostgreSQL, React/TypeScript 웹 클라이언트, 동일 origin 배포를 기본으로 한다.

이 문서는 제품 범위, 도메인 불변조건, HTTP API, 화면 상태, 구현 순서의 정본이다. 구현 중 계약을 바꿔야 한다면 backend와 frontend가 각자 추측하지 않고 이 문서를 먼저 갱신하고 소비자에게 변경을 알린다.

## 2. 사용자 목표와 성공 기준

### 핵심 사용자

지원 실패, 긴 공백, 낮아진 실행 자신감 때문에 해야 할 일을 알면서도 다시 시작하지 못하는 구직자 한 명을 대상으로 한다. 의료적 진단이나 상담이 필요한 상태를 판정하는 제품은 아니다.

### 사용자가 얻는 가치

1. 진행 중인 구직 목표와 지금 할 행동 하나를 한 화면에서 확인한다.
2. 행동을 완료하거나 막힌 이유를 2~3번의 입력으로 기록한다.
3. 막혔을 때 원래 행동보다 짧고 구체적인 후속 행동을 제안받는다.
4. 제안을 수정·수락하면 실패 이력과 연결된 새 행동으로 곧바로 재시작한다.
5. 기록 화면에서 실패 횟수가 아니라 완료와 재시작의 연결을 확인한다.

첫 세션의 대표 성공 흐름은 `목표/첫 행동 생성 -> 막힘 기록 -> 더 쉬운 행동 수락 -> 새 행동 완료 -> 이력 확인`이다. QA가 이 흐름을 새 브라우저 상태에서 자동 재현할 수 있어야 한다.

### 제품 완료 지표

첫 릴리스에서는 외부 분석 도구를 붙이지 않는다. 다음 값은 서버 로그가 아니라 도메인 데이터로 계산 가능해야 한다.

- `restartCreated`: BLOCKED attempt 뒤 successor action이 생성되었는가
- `restartCompleted`: 그 successor action이 DONE 되었는가
- `timeToRestart`: BLOCKED attempt와 successor 생성 사이의 시간

개인 메모, 목표 제목, 행동 제목을 관측 로그나 오류 응답에 원문으로 남기지 않는다.

## 3. MVP와 금지 범위

### 첫 릴리스에 포함한다

- 브라우저별 익명 private workspace 생성과 재방문 유지
- workspace마다 동시에 한 개의 활성 목표
- 목표 아래 동시에 한 개의 READY 행동
- 첫 행동 및 완료 후 다음 행동 직접 생성
- 현재 목표 보관과 새 목표 시작
- 행동 완료 또는 막힘 기록
- 막힘 원인별 결정론적 난이도 축소 제안, 사용자 수정, 수락
- 최근 attempt와 successor 연결 이력 조회
- 전체 사용자 데이터 삭제
- 마지막 유효 활동을 기준으로 한 익명 workspace의 90일 sliding TTL과 제한된 자동 정리
- 작은 화면 우선 반응형 UI, 키보드 탐색, 오류/빈 상태/로딩 상태
- PostgreSQL migration, health check, 같은 origin 컨테이너 실행, 릴리스 runbook

### 명시적으로 포함하지 않는다

- 이력서/자기소개서 생성, 채용 공고 검색, 지원서 관리
- 생성형 AI 추천 또는 외부 AI API
- 캘린더, 푸시/이메일 알림, 소셜 기능, 점수·랭킹·연속 출석
- 여러 활성 목표, 팀 workspace, 관리자 화면
- 회원가입, 비밀번호, 소셜 로그인, 기기 간 동기화, 잃어버린 익명 세션 복구
- 의료·심리 상태 진단, 치료 조언, 위기 대응 자동화
- 자유 형식 일기, 파일 업로드, 민감정보 분석
- 운영 관리자용 분석 대시보드와 외부 telemetry SDK

화면과 API는 제외 기능의 빈 메뉴나 동작하지 않는 버튼을 미리 노출하지 않는다. 사용자의 막힘을 실패 점수, 연속 기록 손실, 비난 문구로 표현하지 않는다.

## 4. 정보 구조와 사용자 흐름

### 전역 구조

```text
Re:Start Quest
├─ 지금 할 행동 (기본 화면)
├─ 기록
└─ 데이터 관리
```

전역 탐색은 최대 3개 항목만 사용한다. 기본 화면은 대시보드 카드 모음이 아니라 다음 행동을 중심으로 한 단일 읽기 흐름을 사용한다.

### 첫 방문

1. 서버가 익명 workspace를 만들고 private session cookie를 설정한다.
2. 첫 목표를 저장하기 전에 다음 제한을 상시 문구로 알린다: “이 브라우저에서만 접근할 수 있어요. 브라우저 데이터를 지우거나 잃으면 복구하거나 즉시 삭제할 수 없어요. 90일 동안 사용하지 않으면 다음 정리 배치에서 삭제되며, 격리된 백업에는 최대 30일 더 남을 수 있어요.”
3. 목표 제목, 오늘 할 가장 작은 행동, 예상 시간(2~30분)을 입력한다.
4. 생성 성공 뒤 기본 화면에서 READY 행동을 보여 준다.

중복 클릭이나 네트워크 재시도로 목표가 두 개 생기면 안 된다. 필드 오류는 해당 입력 가까이에 표시하고 입력값을 보존한다.

### 기본 화면 상태

- `NO_QUEST`: 목표 만들기 CTA를 보여 준다.
- `READY`: 목표 맥락, 행동 제목, 예상 시간, `완료했어요`, `막혔어요`를 순서대로 보여 준다.
- `PENDING_ADAPTATION`: 막힘 원인과 재설계 제안을 다시 열 수 있는 CTA를 보여 준다.
- `NEEDS_NEXT_ACTION`: 완료 피드백 뒤 `다음 행동 만들기`와 `목표 완료`를 보여 준다.
- `QUEST_COMPLETED`: 완료 요약과 새 목표 만들기를 보여 준다.
- `ERROR`: 사용자의 마지막 입력을 보존하고 재시도 또는 안전한 기본 화면 이동을 제공한다.

클라이언트가 상태를 임의 추론하지 않고 bootstrap 응답의 명시적 `nextRequiredAction`을 렌더링한다.

### 만료되거나 알 수 없는 session

1. `rq_session` cookie가 전혀 없으면 신규 방문으로 취급하고 `POST /session`으로 새 workspace를 만든다. 이미 cookie가 사라진 방문은 실제 신규 방문과 구별할 수 없으므로 cookie-loss를 감지했다고 표현하지 않는다.
2. 비어 있지 않은 `rq_session`이 서버에서 인식되지 않으면 서버는 cookie를 만료하고 401 `WORKSPACE_ACCESS_UNAVAILABLE`을 반환한다. 과거 workspace의 존재, 만료·삭제·위조 중 어느 원인인지 노출하지 않으며 새 workspace를 자동 생성하지 않는다.
3. 화면은 “이 브라우저에서 이전 작업 공간에 접근할 수 없어요. 이전 기록은 복구할 수 없습니다.”라는 generic 안내와 `새 작업 공간 시작` 버튼을 제공한다. 복구 중, 재연결 가능, 즉시 삭제 완료라고 표현하지 않는다.
4. 사용자가 명시적으로 새 시작을 선택하면 이전 controller snapshot, 보존된 submission, retry command와 `sessionStorage`의 `restart-quest.completed-title`을 먼저 지운 뒤 새 session을 만든다. workspace 명시 삭제와 자동 만료 전환에도 같은 정리를 적용한다.
5. 안내와 새 시작은 키보드만으로 도달·실행할 수 있고 screen reader가 제목, 설명, 결과를 순서대로 읽을 수 있어야 한다.

### 막힘과 재시작

1. 사용자가 READY 행동에서 `막혔어요`를 누른다.
2. `TOO_BIG`, `LOW_ENERGY`, `UNCLEAR`, `NO_TIME`, `OTHER` 중 한 원인을 고른다. 선택적 메모는 500자 이내다.
3. attempt 저장 응답으로 더 쉬운 제목, 예상 시간, 전략 안내를 받는다.
4. 사용자는 제목과 예상 시간을 수정하거나 수락한다. 취소해도 attempt는 보존되고 기본 화면은 `PENDING_ADAPTATION`이 된다.
5. 수락 시 기존 행동은 BLOCKED로 남고 새 READY 행동은 `sourceAttemptId`로 연결된다.

### 완료 후 흐름

1. READY 행동을 완료하면 action과 attempt가 DONE이 된다.
2. 활성 목표에는 READY 행동이 없고 기본 화면은 `NEEDS_NEXT_ACTION`이 된다.
3. 사용자는 새 행동을 추가하거나 목표 자체를 완료한다.
4. 새 행동 생성 시 다시 `READY`, 목표 완료 시 `QUEST_COMPLETED`가 된다.
5. 사용자가 현재 목표를 중단하려면 `목표 보관`을 선택한다. READY 행동은 취소되고 기록은 남으며 새 목표를 만들 수 있다.

## 5. 도메인 계약

### 엔터티

- `Workspace`: 익명 사용자 경계, IANA timezone, session token hash, 생성 시각, 별도 `lastActivityAt`
- `Quest`: workspace에 속한 목표, `ACTIVE | COMPLETED | ARCHIVED`, 제목, version, 생성/완료/보관 시각
- `Action`: quest에 속한 작은 행동, `READY | DONE | BLOCKED | CANCELLED`, 제목, 예상 시간, `sourceAttemptId`, 생성/종료 시각
- `Attempt`: action 결과, `DONE | BLOCKED`, blocker code, 선택 메모, 생성 시각
- `IdempotencyRecord`: workspace, route, key, request digest, response reference, 만료 시각

외부 식별자는 UUID를 사용하되, UUID 존재 여부만으로 접근을 허용하지 않는다. 모든 조회와 변경은 session에서 얻은 workspace 범위를 함께 조건으로 사용한다.

별도 `Adaptation` 엔터티는 만들지 않는다. pending adaptation은 “BLOCKED attempt는 있지만 그 attempt를 `sourceAttemptId`로 참조하는 successor action은 아직 없음”에서 파생한다. 제안 당시의 `strategyCode`, `guidance`, 제목, 예상 시간은 BLOCKED attempt에 snapshot으로 저장해 새로고침 뒤에도 같은 제안을 복구한다.

### 불변조건

1. workspace에는 `ACTIVE` quest가 최대 한 개다.
2. active quest에는 `READY` action이 최대 한 개다.
3. action은 `READY -> DONE`, `READY -> BLOCKED`, 목표 보관에 의한 `READY -> CANCELLED` 중 하나로 한 번만 종료된다.
4. attempt는 action마다 최대 한 개이며 DONE/BLOCKED action에는 정확히 하나가 있다.
5. BLOCKED attempt에는 blocker code가 필수이고 DONE attempt에는 없어야 한다.
6. adaptation은 BLOCKED attempt마다 최대 한 개이며 생성된 action의 `sourceAttemptId`가 그 attempt를 가리킨다.
7. DONE 또는 BLOCKED action을 다시 종료하거나 다른 workspace 자원을 변경하면 안 된다.
8. quest 완료는 READY action이나 미수락 BLOCKED adaptation이 없을 때만 가능하다. 보관은 어떤 ACTIVE 상태에서도 가능하며 남은 READY action을 같은 transaction에서 CANCELLED로 만든다.
9. 제목은 앞뒤 공백 제거 후 quest 1~120자, action 1~100자이고 메모는 최대 500자다.
10. 예상 시간은 2~30분, timezone은 유효한 IANA 이름이어야 한다.
11. 저장 시각은 UTC ISO-8601로 반환하고 화면 날짜만 workspace timezone으로 계산한다.
12. 같은 write endpoint의 같은 `Idempotency-Key`와 같은 payload는 최초 응답을 재생한다. 같은 key를 다른 payload에 쓰면 409를 반환한다.
13. 동시 변경은 quest version 또는 행 잠금으로 직렬화하며 패배한 요청은 409 `STALE_STATE` 뒤 bootstrap 재조회로 복구한다.

DB unique constraint와 transaction으로 1~8을 지키고 서비스 계층 검사만 믿지 않는다.

### 익명 workspace 보존과 활동 계약

- live workspace의 활동 정본은 PostgreSQL `TIMESTAMPTZ NOT NULL`인 `last_activity_at`이다. 일반 자원 수정 시각인 `updated_at`을 TTL 계산에 재사용하지 않는다.
- 기존 V1 migration은 수정하지 않는다. forward migration으로 `last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now()`와 cleanup 조회용 index를 추가하고, 기존 행은 migration에 사용한 DB 시각으로 backfill해 그 시점부터 90일 유예한다.
- cleanup job은 시작할 때 DB UTC 시각으로 `cutoff = databaseNow - interval '90 days'`를 한 번 계산하고 실행 내내 고정한다. 삭제 후보와 삭제 직전 조건은 모두 `last_activity_at < cutoff`이다. 89일 행과 정확히 cutoff와 같은 행은 보존하고, 엄격히 90일을 초과한 행만 다음 cleanup batch에서 삭제한다.
- qualifying activity는 새 workspace 생성, 유효 token을 재사용한 `POST /session`, 유효 cookie로 인증된 `GET /bootstrap`, `GET /history`, workspace mutation이다. mutation은 Origin·CSRF 검증을 통과한 뒤 DB 시각으로 touch하며, business validation 오류와 409도 실제 사용으로 센다.
- health, readiness와 운영 probe, `OPTIONS`/CORS preflight, 인증·Origin·CSRF 실패, cleanup 자체는 활동이 아니다. `DELETE /workspace`는 touch하지 않고 삭제 transaction으로 끝낸다. 자동 background polling이나 숨김 탭 요청으로 qualifying read endpoint를 호출해 TTL을 연장하지 않는다.
- qualifying activity가 성공적으로 workspace를 식별할 때마다 서버는 `last_activity_at`과 `rq_session`의 `Max-Age=7776000`(90일)을 갱신한다. session/bootstrap은 서버 DB 시각으로 계산한 `workspaceExpiresAt = lastActivityAt + 90 days`를 응답하며, 클라이언트 시계를 만료 판정의 정본으로 사용하지 않는다.
- mutation은 workspace 행을 잠근 뒤 활동 시각을 갱신하고 같은 요청의 상태 전이를 수행한다. cleanup은 같은 workspace 행 잠금을 획득한 뒤 고정 cutoff 조건을 다시 검사한다. 활동 update가 먼저 lock/commit되면 workspace를 보존하고, cleanup 삭제가 먼저 commit되면 요청은 `WORKSPACE_ACCESS_UNAVAILABLE`로 끝나며 삭제된 workspace를 부활시키지 않는다.
- cleanup은 전역 단일 실행 잠금, `FOR UPDATE SKIP LOCKED`, batch 500, 실행당 최대 20 batch를 사용한다. 각 batch는 workspace와 quest/action/attempt/idempotency record를 한 transaction에서 cascade 삭제하며 중단 뒤 재실행해도 안전해야 한다.

### 재설계 규칙

제안은 서버가 생성하고 클라이언트는 그대로 표시한 뒤 편집만 허용한다. 같은 입력은 같은 전략과 예상 시간을 만들어야 한다.

| blocker code | 전략 | 제안 제목 형식 | 제안 시간 |
| --- | --- | --- | --- |
| `TOO_BIG` | 첫 단계만 분리 | `첫 단계만 하기: {기존 제목}` | `max(2, min(5, 기존 시간 / 2 내림))` |
| `LOW_ENERGY` | 시작 준비만 수행 | `시작할 준비만 하기: {기존 제목}` | 2분 |
| `UNCLEAR` | 완료 기준 명확화 | `완료 기준 한 줄 쓰기: {기존 제목}` | 5분 |
| `NO_TIME` | 필요한 자원만 열기 | `필요한 것 열어 두기: {기존 제목}` | 2분 |
| `OTHER` | 더 작은 다음 한 가지 선택 | `더 작은 한 가지 정하기: {기존 제목}` | `min(5, 기존 시간)` |

생성 결과가 100자를 넘으면 기존 제목 부분만 잘라 전체 길이를 맞춘다. 사용자가 편집한 수락 값에도 일반 action 검증을 똑같이 적용한다.

## 6. HTTP API 계약

공통 prefix는 `/api/v1`이다. JSON 필드는 `camelCase`, 시각은 UTC ISO-8601, 성공 응답은 자원과 현재 `nextRequiredAction`을 함께 반환한다.

### 세션과 읽기

| method/path | 요청 | 성공 | 핵심 실패 |
| --- | --- | --- | --- |
| `POST /session` | `{ timezone }` | cookie 없음은 201과 `{ csrfToken, workspaceExpiresAt }`; 기존 유효 token은 200 재사용·touch·cookie 갱신 | 400 `INVALID_TIMEZONE`; 401 `WORKSPACE_ACCESS_UNAVAILABLE` |
| `GET /bootstrap` | 없음 | 200 `{ workspace, activeQuest, currentAction, pendingAdaptation, recentAttempts, nextRequiredAction, csrfToken, workspaceExpiresAt }`와 touch·cookie 갱신 | 401 `SESSION_REQUIRED`, `WORKSPACE_ACCESS_UNAVAILABLE` |
| `GET /history?cursor=&size=` | size 1~50 | 200 cursor page, attempt와 successor 요약 | 400 `INVALID_CURSOR` |

### 쓰기

| method/path | 요청 | 성공 | 핵심 실패 |
| --- | --- | --- | --- |
| `POST /quests` | `{ title, firstAction: { title, estimatedMinutes } }` | 201 quest와 READY action | 409 `ACTIVE_QUEST_EXISTS` |
| `POST /quests/{questId}/actions` | `{ title, estimatedMinutes }` | 201 READY action | 409 `READY_ACTION_EXISTS`, `QUEST_NOT_ACTIVE` |
| `POST /actions/{actionId}/attempts` | `{ outcome, blockerCode?, note? }` | 201 attempt; BLOCKED면 suggestion 포함 | 409 `ACTION_ALREADY_RESOLVED` |
| `POST /attempts/{attemptId}/adaptation` | `{ title, estimatedMinutes }` | 201 successor READY action | 409 `ADAPTATION_EXISTS`, `ATTEMPT_NOT_BLOCKED` |
| `POST /quests/{questId}/complete` | `{ version }` | 200 COMPLETED quest | 409 `QUEST_HAS_PENDING_ACTION`, `STALE_STATE` |
| `POST /quests/{questId}/archive` | `{ version }` | 200 ARCHIVED quest | 409 `QUEST_NOT_ACTIVE`, `STALE_STATE` |
| `DELETE /workspace` | 확인 header 포함 | 204와 session cookie 만료 | 400 `DELETE_CONFIRMATION_REQUIRED` |

`POST /session`은 아직 CSRF가 없으므로 허용된 `Origin`만 엄격히 검사한다. 다만 비어 있지 않은 cookie가 있으면 유효 token인지 확인하며, 미인식 token을 신규 session으로 바꾸지 않는다. 그 외 모든 쓰기는 session cookie, `X-CSRF-Token`, `Origin` 검사를 요구한다. 자원 생성/결과 기록 endpoint는 UUID 형식의 `Idempotency-Key`도 요구한다. 클라이언트가 `workspaceId`를 보내거나 URL에 넣는 API는 만들지 않는다.

### 결과 표현

- `nextRequiredAction`: `CREATE_QUEST | DO_READY_ACTION | ADAPT_BLOCKED_ACTION | CREATE_NEXT_ACTION_OR_COMPLETE | START_NEW_QUEST`
- `workspaceExpiresAt`은 qualifying activity가 반영된 서버 기준 예상 만료 시각이다. cleanup이 batch로 실행되므로 실제 삭제 시각을 보장하지 않는다.
- attempt의 `outcome=BLOCKED`일 때만 `suggestion: { strategyCode, guidance, title, estimatedMinutes }`가 존재한다.
- 이력 항목은 `{ attempt, action, successorAction? }` 구조로 반환해 원인과 재시작 연결을 한 번에 그릴 수 있게 한다.
- 존재하지 않거나 다른 workspace의 자원은 모두 404 `RESOURCE_NOT_FOUND`로 응답해 존재 여부를 노출하지 않는다.

### 오류 표현

오류는 `application/problem+json`으로 반환한다.

```json
{
  "type": "https://restart-quest.example/problems/validation",
  "title": "입력값을 확인해 주세요.",
  "status": 400,
  "code": "VALIDATION_FAILED",
  "detail": "요청을 처리할 수 없습니다.",
  "fieldErrors": [{ "field": "firstAction.title", "reason": "REQUIRED" }],
  "traceId": "public-correlation-id"
}
```

`detail`에 입력 원문, SQL, stack trace, cookie, token을 포함하지 않는다. 예기치 않은 오류는 일반 문구와 correlation id만 반환한다.

`WORKSPACE_ACCESS_UNAVAILABLE`은 401과 generic `detail`만 사용한다. cookie가 만료됐는지, cleanup에서 삭제됐는지, 알 수 없는 token인지 구분하는 필드와 과거 workspace 식별자를 응답하지 않는다. 응답은 해당 `rq_session` cookie를 즉시 만료한다.

## 7. 개인정보와 안전 기준

- session token은 충분한 난수로 생성하고 DB에는 원문이 아닌 hash만 저장한다.
- 운영 cookie는 `HttpOnly`, `Secure`, `SameSite=Lax`, 제한된 path와 `Max-Age=90일`을 사용하며 qualifying activity마다 sliding 갱신한다.
- 동일 origin reverse proxy를 사용하며 운영 CORS wildcard를 허용하지 않는다.
- 상태 변경은 CSRF token과 허용된 Origin을 모두 검증한다.
- 사용자별 모든 query에 workspace 조건을 넣고 다른 workspace ID에 대해 404를 반환하는 통합 테스트를 둔다.
- note는 plain text로 취급하고 렌더링 시 escape한다. HTML 입력을 실행하거나 링크로 자동 변환하지 않는다.
- 로그에는 내부 자원 ID와 correlation id만 남기고 사용자 입력과 인증 자료를 남기지 않는다.
- 전체 삭제는 `X-Confirm-Delete: delete-my-data`를 요구하고 한 transaction에서 workspace 종속 데이터를 삭제한 뒤 cookie를 만료한다.
- live 자동 삭제 뒤에도 애플리케이션과 격리된 backup에는 최대 30일 추가 잔존할 수 있다. backup은 30일 rolling 상한을 지키며 서비스에 복원하기 전에 같은 90일 cleanup을 실행한다. 이미 삭제된 live data의 자동 복원은 rollback으로 약속하지 않는다.
- “무기력”, “불안” 같은 입력으로 진단하거나 위험도를 계산하지 않는다. 제품 한계를 데이터 관리 화면에 짧게 표시한다.

## 8. 화면과 시각 기준

### 화면 구성

1. `시작`: 제품 가치 한 문장, 첫 저장 전에 보이는 익명 저장·90일 미사용 삭제·backup 제한, 목표/첫 행동 form
2. `지금`: active quest는 작은 상단 맥락으로, current action은 페이지의 주 제목으로 표시
3. `막힘 기록`: 원인 선택 radio group, 선택 메모, 저장
4. `다시 설계`: 전략 설명, 편집 가능한 제목/시간, 수락
5. `다음 선택`: 행동 완료 피드백, 다음 행동 생성 또는 목표 완료
6. `기록`: 시간 역순 attempt 목록과 successor 연결
7. `데이터 관리`: 익명 세션·복구 불가·90일 미사용 삭제·최대 30일 backup 제한, 전체 삭제
8. `작업 공간 접근 불가`: generic 만료/접근 불가 안내, 명시적인 새 작업 공간 시작

modal 안에 긴 form을 넣지 않는다. 모바일에서는 각 단계가 독립 route 또는 전체 폭 sheet가 되고 브라우저 뒤로 가기와 새로고침 후 bootstrap 복구가 동작해야 한다.

`목표 보관`은 지금 화면의 보조 메뉴에 두되 삭제처럼 보이게 하거나 주요 CTA와 경쟁시키지 않는다. 확인 단계에서 진행 중 행동이 취소되고 기록은 유지된다는 결과를 명시한다.

### 가독성과 접근성

- 본문 최대 읽기 폭 720px, 기본 font 16px 이상, line-height 1.5 이상
- 주요 CTA 높이 44px 이상, 키보드 focus가 보이고 논리적 tab 순서를 유지
- 색만으로 DONE/BLOCKED를 구분하지 않고 텍스트와 아이콘을 함께 사용
- 일반 텍스트/배경 명암은 WCAG AA를 만족
- 저장 중 버튼을 비활성화하고 같은 위치에 상태를 알리되 layout shift를 최소화
- toast만으로 오류를 알리지 않고 form/페이지 안에 지속되는 오류 문구 제공
- skeleton보다 짧은 loading 문구를 우선하고 300ms 미만 응답에는 불필요한 깜빡임을 피함
- 빈 상태는 설명 한 문장과 가능한 다음 행동 하나만 제공
- 카드 안에 카드를 중첩하지 않고 구분선, 제목 계층, 여백으로 관계를 표현

### 검증 viewport

- 375x667: 가로 스크롤, 잘린 CTA, 키보드 focus 가림이 없어야 한다.
- 768x1024: form과 본문 폭이 지나치게 늘어나지 않아야 한다.
- 1280x800: 다음 행동과 주요 CTA가 첫 화면에서 보여야 한다.
- 200% zoom: 텍스트 겹침과 기능 손실 없이 핵심 흐름을 완료할 수 있어야 한다.

## 9. 구현 slice와 역할 경계

아래 package ID는 AgentFlow `designBacklog`와 동일하다. 의존성은 계약 또는 실행 검증에 필요한 경우만 둔다.

```text
mvp-backend-core ─────────────────────┐
                                     ├─> mvp-frontend-flow ─┐
mvp-frontend-ui -> mvp-frontend-state ┘                      ├─> mvp-release
mvp-backend-core ─────────────────────────────────────────────┘
```

`mvp-frontend-state`는 실행 가능한 client test 골격을 재사용하기 위해 UI package 뒤에 오고, `mvp-frontend-flow`는 실제 API 통합 검증 때문에 backend와 state를 모두 기다린다. `mvp-release`는 완성된 양쪽 production artifact가 필요하다. 이 외의 관행적 순서 의존성은 두지 않는다.

### `mvp-backend-core` — backend

- 의존 package: 없음
- 담당 사용자 흐름: session 생성부터 목표/행동/attempt/adaptation/이력/삭제까지의 서버 상태 전이
- Spring Boot 프로젝트, migration, 세션/CSRF, 도메인 불변조건, API, 문제 응답, idempotency, health check를 구현한다.
- V1을 수정하지 않는 forward migration, DB UTC 기반 `last_activity_at`, strict 90일 cleanup과 경합 선형화, 90일 sliding cookie, `workspaceExpiresAt`, `WORKSPACE_ACCESS_UNAVAILABLE` 계약을 구현한다.
- 서비스/저장소 단위 테스트와 PostgreSQL 통합 테스트에서 양성, 다른 workspace, 중복/동시 요청을 검증한다.
- frontend 파일과 배포 파일은 수정하지 않는다.
- 다음 진입 조건: 전체 backend test와 migration 검증이 통과하고 API 응답이 6장의 계약과 일치한다.

### `mvp-frontend-ui` — frontend-ui

- 의존 package: 없음
- 담당 사용자 흐름: 모든 화면 상태의 읽기 순서, 입력/CTA, 반응형·접근성 표현
- React/TypeScript/Vite 실행 골격과 위 화면의 presentational component, 반응형 tokens, 접근성 단위 테스트를 구현한다.
- 첫 목표 저장 전과 데이터 관리 화면의 전체 보존 문구, generic 접근 불가 화면과 명시적 새 시작 CTA를 키보드·screen reader로 검증 가능하게 표현한다.
- API를 가짜 성공으로 하드코딩하지 않고 명시적 props와 callback으로 모든 loading/error/empty 상태를 표현한다.
- API/state 경로와 backend 파일은 수정하지 않는다.
- 다음 진입 조건: lint/typecheck/unit test/build가 통과하고 필수 viewport에서 모든 상태를 독립 렌더링할 수 있다.

`mvp-backend-core`와 `mvp-frontend-ui`는 서로 독립적이며 병렬 구현한다.

### `mvp-frontend-state` — frontend-state

- 의존 package: `mvp-frontend-ui`
- 담당 사용자 흐름: 새 session/bootstrap, write 중복 방지, 오류와 409 상태 복구
- UI 골격 위에 session bootstrap, typed API client, CSRF/idempotency, server-state 전이를 구현한다.
- `workspaceExpiresAt`을 typed contract로 소비하고 `WORKSPACE_ACCESS_UNAVAILABLE`에서는 session을 자동 재생성하지 않는다. 명시 삭제·자동 만료·새 시작에서 snapshot, retained submission, retry state와 이전 workspace의 sessionStorage를 지운다.
- 수명 연장을 위한 background polling이나 숨김 탭 qualifying request를 만들지 않는다.
- mock HTTP 테스트로 성공, cookie 없는 `SESSION_REQUIRED`의 신규 session 생성, `WORKSPACE_ACCESS_UNAVAILABLE` 비자동 재생성, 409 refetch, 네트워크 재시도를 검증한다.
- feature 화면 조립과 backend 파일은 수정하지 않는다.
- 다음 진입 조건: mock contract test에서 `nextRequiredAction`의 모든 값과 오류 경계가 재현된다.

### `mvp-frontend-flow` — frontend

- 의존 package: `mvp-backend-core`, `mvp-frontend-state`
- 담당 사용자 흐름: 첫 세션 대표 흐름과 완료 후 다음 선택, 기록, 삭제를 실제 route로 연결
- UI와 state를 실제 route로 결합하고 첫 세션 대표 흐름, reload 복구, 이력, 삭제를 완성한다.
- cookie 없음과 non-empty 미인식 cookie를 구분하고, 접근 불가 안내에서 이전 상태가 노출되지 않은 채 사용자의 명시적 선택으로만 새 workspace를 시작한다.
- 실제 backend와의 contract smoke 및 Playwright 핵심 흐름을 추가한다.
- 정본 계약 변경이 필요하면 임의 호환 코드를 넣지 않고 설계 변경으로 되돌린다.
- 다음 진입 조건: 실제 backend를 대상으로 대표 흐름과 reload/오류 복구 smoke가 통과한다.

### `mvp-release` — backend-infra

- 의존 package: `mvp-backend-core`, `mvp-frontend-flow`
- 담당 사용자 흐름: production과 같은 실행 환경에서 첫 방문부터 데이터 삭제까지의 전체 흐름
- backend/frontend production build, PostgreSQL, same-origin proxy를 compose로 연결한다.
- secret 값을 저장하지 않고 필수 환경 변수의 set 여부, migration, health, 백업/복구, rollback을 runbook에 기록한다.
- cleanup을 매일 UTC 03:00에 실행하고 scheduler 중지를 rollback으로 제공한다. 최초 실제 삭제 전 dry-run 집계, 격리 DB backup 복원 연습, 복원본의 만료 데이터 재삭제를 완료한다.
- 통합 head에서 clean build와 핵심 smoke를 실행한다.
- 제외 범위: 클라우드 계정 생성, DNS/TLS 변경, 운영 서버 수정, CI/repository-control 변경
- 완료 조건: 11장의 릴리스 판정을 같은 통합 revision에서 모두 충족한다.

#### cleanup·backup 운영 계약

- 기본 schedule은 매일 UTC 03:00이다. scheduler가 중복 기동돼도 전역 잠금으로 실제 cleanup은 하나만 수행하며, rollback은 scheduler를 중지해 추가 삭제를 막는 것이다. 이미 삭제된 live workspace를 자동 복원하지 않는다.
- 최초 실제 삭제 전에 같은 설정으로 dry-run 후보 수와 batch 예상량을 기록한다. 그 뒤 접근 제한된 격리 DB에 backup을 복원해 migration과 cleanup을 실행하고, 90일을 초과한 데이터가 재삭제되는지 확인한다. production DB를 rehearsal 대상으로 사용하지 않는다.
- runbook은 schedule, batch 500, 실행당 최대 20 batch, 처리·경합 스킵·오류 수, 소요 시간, 남은 backlog, 마지막 성공 시각과 scheduler 중지/재개 절차를 기록한다.
- alert는 cleanup 오류가 한 건이라도 있거나 마지막 성공 뒤 26시간을 초과하면 발생한다. backlog는 관측하되 한도를 넘겨 무제한 batch를 실행하지 않는다.
- cleanup 로그와 metric label에는 workspace/session 식별자, 목표·행동·메모 같은 사용자 입력을 남기지 않는다.
- backup은 애플리케이션 live DB와 격리하고 생성 시각부터 최대 30일 rolling 상한으로 만료한다. 복원본을 서비스하기 전 동일한 90일 cleanup을 실행하고 결과를 확인한다.

### 파일 소유권과 충돌 금지 범위

| package | 수정 소유 범위 | 수정하지 않는 범위 |
| --- | --- | --- |
| `mvp-backend-core` | `backend/src/main`, `backend/src/test`, backend Gradle wrapper/build 설정 | `frontend`, `compose.yaml`, 배포 문서 |
| `mvp-frontend-ui` | `frontend/src/ui`, `frontend/src/styles`, 초기 `App`/`main`, frontend build/test 골격 | `frontend/src/api`, `frontend/src/state`, 실제 route 조립 |
| `mvp-frontend-state` | `frontend/src/api`, `frontend/src/state`, mock HTTP fixture | UI 표현과 실제 route, backend |
| `mvp-frontend-flow` | `frontend/src/app`, 최종 `App`/`main`, E2E와 dev proxy 설정 | backend와 배포 설정, 정본 계약의 임의 변경 |
| `mvp-release` | Dockerfile, `compose.yaml`, `deploy`, release runbook | 도메인/API/화면 기능 코드, 저장소 제어·CI |

의존 package의 파일이 필요하다는 이유만으로 소유 범위를 넓히지 않는다. 계약 불일치가 발견되면 소비자 쪽 변환으로 숨기지 말고 이 정본과 생산자·소비자 테스트를 함께 갱신할 별도 조정을 요청한다.

## 10. 패키지별 QA 기준

| package | 독립 완료 증거 | 통합 전 확인하지 않는 범위 |
| --- | --- | --- |
| `mvp-backend-core` | Gradle 전체 테스트, forward migration, API/격리/idempotency, TTL/cookie/cleanup 경합·cascade 통합 테스트 | 브라우저 레이아웃 |
| `mvp-frontend-ui` | lint/typecheck/unit test/build, 보존·접근 불가 문구의 접근성, 4개 viewport와 200% zoom 검토 | 실제 API 성공 |
| `mvp-frontend-state` | mock server 기반 state/오류/재시도, stale-cookie 비자동 재생성, 이전 workspace 상태 제거 테스트 | production DB와 proxy |
| `mvp-frontend-flow` | 실제 backend contract smoke, cookie 없음/미인식·명시 삭제·만료 전환과 Playwright 대표 흐름 | production container/rollback |
| `mvp-release` | compose config, production build, health, migration, 통합 smoke, cleanup dry-run/schedule/metric/alert, 격리 backup 복원·재삭제와 rollback rehearsal | 후순위 기능 |

각 package PR 통과는 제품 완료가 아니다. 마지막 통합 head에서 아래 릴리스 시나리오를 다시 검증한다.

## 11. 릴리스 완료 조건

### 대표 흐름

1. 깨끗한 브라우저에서 session과 목표/10분 첫 행동을 만든다.
2. `TOO_BIG`으로 막힘을 기록하면 5분 이하 제안을 받는다.
3. 제안 제목을 수정해 수락하고 새 READY 행동이 원래 attempt와 연결됐는지 확인한다.
4. 새 행동을 완료하고 다음 행동 생성/목표 완료 선택 화면을 확인한다.
5. 새로고침 뒤 상태가 유지되고 기록에 BLOCKED -> successor -> DONE 연결이 보이는지 확인한다.
6. 데이터를 삭제하고 이전 자원 URL/API가 404이며 새 session에서 기록이 보이지 않는지 확인한다.

### 회귀와 실패 경계

- 같은 create/attempt/adaptation 요청을 같은 idempotency key로 두 번 보내도 자원은 하나다.
- 같은 key에 다른 payload를 보내면 409이고 최초 결과는 변하지 않는다.
- 다른 workspace cookie로 자원 UUID를 알아도 읽기/변경이 모두 404다.
- READY action에 동시 DONE/BLOCKED 요청을 보내면 하나만 성공하고 불변조건이 유지된다.
- READY 또는 미수락 adaptation이 있는 목표를 보관하면 활성 목표와 READY 행동이 남지 않고 과거 attempt는 유지된다.
- validation, offline, 401, 409, 5xx 뒤 입력을 잃지 않고 재시도하거나 bootstrap으로 복구한다.
- 375x667, 768x1024, 1280x800과 200% zoom에서 대표 흐름을 완료한다.
- 로그와 오류 응답에 cookie, token, 사용자 입력 원문이 없다.
- 운영 설정에 secret 기본값이 없고 health 실패 시 배포 성공으로 판단하지 않는다.

### 90일 보존 회귀표

| 분류 | 입력/경계 | 기대 결과 |
| --- | --- | --- |
| migration | V1 기존 workspace에 forward migration 적용 | migration DB 시각으로 `last_activity_at`을 채우고 그 시각부터 90일 유예; V1 checksum 불변 |
| cutoff | 89일, 정확히 cutoff, 90일 초과 | 앞의 두 행은 보존하고 `last_activity_at < cutoff`인 행만 삭제 |
| activity | 새 workspace, 유효 token `POST /session`, 인증된 bootstrap/history, 보안 검사 통과 mutation | DB 시각 touch, 90일 cookie 갱신, 일치하는 `workspaceExpiresAt`; business validation/409도 touch |
| non-activity | health/probe, OPTIONS, 인증·Origin·CSRF 실패, cleanup, background/hidden polling 없음 | `last_activity_at`과 cookie 만료를 연장하지 않음 |
| deletion | `DELETE /workspace` | touch 없이 종속 데이터와 idempotency record를 한 transaction으로 삭제하고 cookie 만료 |
| activity wins | activity가 workspace lock/commit 후 cleanup 재검사 | 갱신된 행 보존 |
| cleanup wins | cleanup 삭제 commit 뒤 같은 token 요청 | 부활 없이 generic `WORKSPACE_ACCESS_UNAVAILABLE` |
| schedulers | 둘 이상의 scheduler 동시 실행 | 전역 잠금 소유자 하나만 실행; 다른 실행은 안전하게 skip |
| batching | 후보가 10,000개를 초과 | batch 500, 최대 20 batch까지만 처리하고 backlog 기록 |
| replay | 중단 뒤 cleanup 재실행 | 이미 삭제된 행에 실패하지 않고 남은 후보만 처리 |
| cascade | 만료 workspace에 quest/action/attempt/idempotency 존재 | 전체 cascade 후 과거 자원 접근은 404이며 식별자·입력이 로그에 없음 |
| browser | cookie 없음 | 신규 방문으로 시작하되 과거 cookie-loss 감지를 약속하지 않음 |
| stale cookie | non-empty 미인식 cookie | cookie 만료, generic 안내, 자동 신규 workspace 없음, 사용자가 명시적으로 새 시작 가능 |
| local state | 명시 삭제, 자동 만료, 미인식 cookie 뒤 새 시작 | controller/retry/retained submission과 `restart-quest.completed-title` 제거, 이전 제목·입력 미노출 |
| accessibility | 접근 불가 안내와 새 시작 | keyboard와 screen reader로 확인·실행 가능 |
| backup | 격리된 backup 복원 | 서비스 전 migration 및 동일 90일 cleanup으로 만료 데이터를 재삭제; 최대 30일 상한 확인 |

### 릴리스 판정

다음이 모두 같은 통합 revision에서 확인되어야 첫 릴리스 후보가 된다.

- backend/frontend clean build와 전체 자동 테스트 통과
- PostgreSQL migration 적용과 rollback 절차 검토
- production compose 해석 성공, backend health 및 web route 응답 성공
- 대표 흐름과 회귀/격리 시나리오 통과
- 90일 보존 회귀표, cleanup scheduler/dry-run/경합/batch 상한, 격리 backup 복원 후 만료 데이터 재삭제 통과
- 고심각도 접근성 오류 없음
- 실행 방법, 환경 변수 이름, health check, 백업, rollback이 runbook과 일치
- QA PASS와 Reviewer APPROVE가 개별 worker head가 아니라 최종 통합 head에도 존재

## 12. 후순위 진입 조건

계정/동기화, 알림, 여러 목표, AI 제안, 구직 정보 연동은 대표 흐름의 실제 사용자 검증과 first-release 운영 안정성 확인 뒤 별도 task로 평가한다. 특히 AI는 결정론적 규칙 대비 재시작 완료율 개선, 비용, 개인정보 경계를 먼저 정의하기 전에는 추가하지 않는다.
