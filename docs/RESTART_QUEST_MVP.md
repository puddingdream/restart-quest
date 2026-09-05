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
- 90일 미사용 workspace 정리와 익명 session 접근 불가 전환
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
2. 첫 목표 저장 버튼보다 앞에서 다음 제한을 상시 알린다: “이 브라우저에서만 접근할 수 있어요. 브라우저 데이터를 지우거나 잃으면 복구하거나 즉시 삭제할 수 없고, 90일 동안 사용하지 않으면 다음 정리 배치에서 삭제돼요. 격리된 backup에는 최대 30일 더 남을 수 있어요.”
3. 목표 제목, 오늘 할 가장 작은 행동, 예상 시간(2~30분)을 입력한다.
4. 생성 성공 뒤 기본 화면에서 READY 행동을 보여 준다.

이 안내는 보조 설명이나 일회성 toast로 숨기지 않고 키보드와 screen reader로 저장 전에 확인할 수 있어야 한다. 중복 클릭이나 네트워크 재시도로 목표가 두 개 생기면 안 된다. 필드 오류는 해당 입력 가까이에 표시하고 입력값을 보존한다.

### 기본 화면 상태

- `NO_QUEST`: 목표 만들기 CTA를 보여 준다.
- `READY`: 목표 맥락, 행동 제목, 예상 시간, `완료했어요`, `막혔어요`를 순서대로 보여 준다.
- `PENDING_ADAPTATION`: 막힘 원인과 재설계 제안을 다시 열 수 있는 CTA를 보여 준다.
- `NEEDS_NEXT_ACTION`: 완료 피드백 뒤 `다음 행동 만들기`와 `목표 완료`를 보여 준다.
- `QUEST_COMPLETED`: 완료 요약과 새 목표 만들기를 보여 준다.
- `WORKSPACE_ACCESS_UNAVAILABLE`: 이전 workspace를 복구할 수 있다고 표현하지 않고, generic 만료/접근 불가 안내와 사용자가 명시적으로 새 workspace를 시작하는 CTA를 보여 준다.
- `ERROR`: 사용자의 마지막 입력을 보존하고 재시도 또는 안전한 기본 화면 이동을 제공한다.

클라이언트가 상태를 임의 추론하지 않고 bootstrap 응답의 명시적 `nextRequiredAction`을 렌더링한다.

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

### 접근 불가와 새 workspace 전환

1. 비어 있지 않은 session cookie가 서버에서 인식되지 않으면 이전 데이터의 존재나 삭제 원인을 밝히지 않는 `WORKSPACE_ACCESS_UNAVAILABLE` 상태로 전환한다.
2. 이 상태에서는 자동으로 새 workspace를 만들지 않는다. controller snapshot, retained submission과 `sessionStorage`의 `restart-quest.completed-title` 등 이전 workspace에 속한 브라우저 상태를 먼저 제거한다.
3. 사용자가 generic 안내를 확인하고 `새로 시작하기`를 명시적으로 선택한 뒤에만 새 workspace를 만든다. 안내와 CTA는 키보드 및 screen reader로 사용할 수 있어야 한다.
4. cookie가 전혀 없는 요청은 신규 방문으로 처리한다. 이미 cookie를 잃은 브라우저를 신규 방문과 구별할 수 없으므로 cookie-loss를 감지하거나 이전 데이터를 복구·즉시 삭제할 수 있다고 약속하지 않는다.
5. 자동 background polling, 숨김 탭 요청 또는 prefetch로 활동 endpoint를 호출해 사용자의 명시적 사용 없이 보존 기한을 연장하지 않는다.

## 5. 도메인 계약

### 엔터티

- `Workspace`: 익명 사용자 경계, IANA timezone, session token hash, 생성/갱신 시각과 별도 `lastActivityAt`
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

### workspace 활동과 90일 수명주기

- live workspace의 활동 정본은 `last_activity_at`이다. 일반 도메인 변경 시각인 `updated_at`을 TTL 계산이나 기존 행 backfill에 재사용하지 않는다.
- backend는 기존 `V1` migration을 수정하지 않고 forward migration으로 `last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now()`와 cleanup 조회 index를 추가한다. 기존 행의 값은 migration 적용 시각으로 채워 90일 유예를 시작한다.
- 활동 시각과 만료 시각은 애플리케이션 host 시각이 아니라 PostgreSQL UTC 시각으로 계산한다. `workspaceExpiresAt`은 서버가 계산한 `last_activity_at + 90일`의 UTC ISO-8601 값이다.
- qualifying activity는 새 workspace 생성, 유효 token을 재사용한 `POST /session`, 유효 cookie로 인증된 `GET /bootstrap`, `GET /history`, workspace mutation이다.
- mutation은 Origin·CSRF 검사를 통과한 뒤 DB 시각으로 활동을 갱신한다. 이 touch는 뒤의 business transaction이 validation 또는 동시성 `409`로 rollback되어도 남도록 별도 transaction에서 commit해 실제 사용으로 센다. `DELETE /workspace`는 갱신하지 않고 삭제 transaction으로 끝낸다.
- health check, `OPTIONS`/CORS preflight, 인증·Origin·CSRF 실패, cleanup, 운영 probe는 활동이 아니다.
- qualifying activity마다 `rq_session`을 `Max-Age=90일`로 다시 설정한다. session과 bootstrap 응답은 `workspaceExpiresAt`을 제공해 cookie, API, DB 수명주기가 같은 기준을 가리키게 한다.
- live 삭제 기준은 job 시작 시 DB UTC 시각으로 한 번 고정한 `cutoff = now() - 90일`이다. `last_activity_at < cutoff`인 행만 다음 cleanup batch의 대상이고 정확히 cutoff와 같은 행은 삭제하지 않는다.

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
| `POST /session` | `{ timezone }` | 201, 90일 private cookie와 `{ csrfToken, workspaceExpiresAt }`; 기존 유효 세션이면 활동·cookie를 갱신하고 200 재사용 | 400 `INVALID_TIMEZONE`; 401 `WORKSPACE_ACCESS_UNAVAILABLE` |
| `GET /bootstrap` | 없음 | 200 `{ workspace, activeQuest, currentAction, pendingAdaptation, recentAttempts, nextRequiredAction, csrfToken, workspaceExpiresAt }` | 401 `SESSION_REQUIRED`, `WORKSPACE_ACCESS_UNAVAILABLE` |
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

`POST /session`은 아직 session/CSRF가 없으므로 허용된 `Origin`만 엄격히 검사한다. 단, 비어 있지 않은 cookie가 있으면 먼저 기존 workspace를 확인하며 미인식 cookie를 신규 방문으로 바꾸지 않는다. 그 외 모든 쓰기는 session cookie, `X-CSRF-Token`, `Origin` 검사를 요구한다. 자원 생성/결과 기록 endpoint는 UUID 형식의 `Idempotency-Key`도 요구한다. 클라이언트가 `workspaceId`를 보내거나 URL에 넣는 API는 만들지 않는다.

qualifying activity의 정상 응답과 security 검사를 통과한 business validation/409 응답은 `rq_session` 갱신을 포함한다. 비어 있지 않은 미인식 cookie에는 401 `WORKSPACE_ACCESS_UNAVAILABLE`과 `Max-Age=0` cookie를 반환하고 새 workspace를 만들지 않는다. cookie가 아예 없을 때의 401 `SESSION_REQUIRED`만 신규 방문 session 생성으로 이어질 수 있다.

### 결과 표현

- `nextRequiredAction`: `CREATE_QUEST | DO_READY_ACTION | ADAPT_BLOCKED_ACTION | CREATE_NEXT_ACTION_OR_COMPLETE | START_NEW_QUEST`
- attempt의 `outcome=BLOCKED`일 때만 `suggestion: { strategyCode, guidance, title, estimatedMinutes }`가 존재한다.
- 이력 항목은 `{ attempt, action, successorAction? }` 구조로 반환해 원인과 재시작 연결을 한 번에 그릴 수 있게 한다.
- session/bootstrap의 `workspaceExpiresAt`은 마지막 qualifying activity 기준 삭제 eligibility 시각이며, cleanup batch 실행 시각이나 backup 삭제 시각을 뜻하지 않는다.
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

`WORKSPACE_ACCESS_UNAVAILABLE`은 만료, 명시 삭제, 운영 정리 또는 유효하지 않은 token 중 어느 원인인지 구분하지 않는 generic problem code다. 응답은 과거 workspace나 데이터 존재 여부를 노출하지 않으며 frontend는 이를 재시도 가능한 일반 401과 분리한다.

## 7. 개인정보와 안전 기준

- session token은 충분한 난수로 생성하고 DB에는 원문이 아닌 hash만 저장한다.
- 운영 cookie는 `HttpOnly`, `Secure`, `SameSite=Lax`, 제한된 path와 90일 `Max-Age`를 사용하고 qualifying activity마다 갱신한다.
- 동일 origin reverse proxy를 사용하며 운영 CORS wildcard를 허용하지 않는다.
- 상태 변경은 CSRF token과 허용된 Origin을 모두 검증한다.
- 사용자별 모든 query에 workspace 조건을 넣고 다른 workspace ID에 대해 404를 반환하는 통합 테스트를 둔다.
- note는 plain text로 취급하고 렌더링 시 escape한다. HTML 입력을 실행하거나 링크로 자동 변환하지 않는다.
- 로그에는 내부 자원 ID와 correlation id만 남기고 사용자 입력과 인증 자료를 남기지 않는다.
- 전체 삭제는 `X-Confirm-Delete: delete-my-data`를 요구하고 한 transaction에서 workspace 종속 데이터를 삭제한 뒤 cookie를 만료한다. live DB 삭제와 별개로 격리 backup에는 최대 30일 잔존할 수 있음을 삭제 확인 전에도 고지한다.
- “무기력”, “불안” 같은 입력으로 진단하거나 위험도를 계산하지 않는다. 제품 한계를 데이터 관리 화면에 짧게 표시한다.

### cleanup과 backup 운영 계약

- cleanup은 PostgreSQL을 공유하는 모든 scheduler 사이의 전역 단일 실행 잠금을 얻은 한 job만 수행한다. 잠금을 얻지 못한 job은 중복 삭제를 시작하지 않고 skip으로 기록한다.
- job 시작 시 DB UTC cutoff를 한 번 계산한다. 각 transaction은 `last_activity_at < cutoff` 후보를 `FOR UPDATE SKIP LOCKED`로 최대 500개 잠그고, 삭제 직전 같은 조건을 다시 확인한 뒤 workspace와 quest/action/attempt/idempotency를 cascade 삭제한다.
- 한 번의 job은 최대 20 batch, 즉 10,000 workspace까지만 처리한다. backlog가 남으면 다음 schedule에서 이어가며 반복 실행이 이미 삭제된 데이터를 오류로 만들지 않아야 한다.
- 활동 update가 workspace row lock을 먼저 얻고 commit하면 재검사에서 보존한다. cleanup이 먼저 lock하고 삭제하면 뒤의 요청은 `WORKSPACE_ACCESS_UNAVAILABLE`로 끝나며 삭제된 workspace나 종속 데이터를 부활시키지 않는다.
- 기본 schedule은 매일 UTC 03:00이다. 최초 실제 삭제 전 dry-run 집계와 격리 DB backup 복원 연습을 하고, 복원본을 서비스하기 전 같은 90일 cleanup을 실행해 만료 데이터를 다시 삭제한다.
- runbook은 schedule, batch 크기 500, 최대 20 batch, 처리·skip·오류 수, 소요 시간, backlog, 마지막 성공 시각을 기록한다. 오류가 있거나 마지막 성공 후 26시간을 초과하면 alert한다. 로그에는 workspace/session 식별자나 사용자 입력을 남기지 않는다.
- backup은 애플리케이션과 격리된 30일 rolling 상한으로 관리한다. rollback은 scheduler 중지와 코드/설정 복구까지이며 이미 live DB에서 삭제된 데이터를 자동 복원한다고 약속하지 않는다.

## 8. 화면과 시각 기준

### 화면 구성

1. `시작`: 제품 가치 한 문장, 익명 저장 제한, 목표/첫 행동 form
2. `지금`: active quest는 작은 상단 맥락으로, current action은 페이지의 주 제목으로 표시
3. `막힘 기록`: 원인 선택 radio group, 선택 메모, 저장
4. `다시 설계`: 전략 설명, 편집 가능한 제목/시간, 수락
5. `다음 선택`: 행동 완료 피드백, 다음 행동 생성 또는 목표 완료
6. `기록`: 시간 역순 attempt 목록과 successor 연결
7. `데이터 관리`: 첫 목표 저장 전과 동일한 복구 불가·90일 미사용 삭제·최대 30일 backup 잔존 상시 안내, 전체 삭제
8. `접근 불가`: generic 만료/접근 불가 안내, 이전 브라우저 상태 제거, 명시적 새 workspace 시작

modal 안에 긴 form을 넣지 않는다. 모바일에서는 각 단계가 독립 route 또는 전체 폭 sheet가 되고 브라우저 뒤로 가기와 새로고침 후 bootstrap 복구가 동작해야 한다.

`목표 보관`은 지금 화면의 보조 메뉴에 두되 삭제처럼 보이게 하거나 주요 CTA와 경쟁시키지 않는다. 확인 단계에서 진행 중 행동이 취소되고 기록은 유지된다는 결과를 명시한다.

### 가독성과 접근성

- 본문 최대 읽기 폭 720px, 기본 font 16px 이상, line-height 1.5 이상
- 주요 CTA 높이 44px 이상, 키보드 focus가 보이고 논리적 tab 순서를 유지
- 색만으로 DONE/BLOCKED를 구분하지 않고 텍스트와 아이콘을 함께 사용
- 일반 텍스트/배경 명암은 WCAG AA를 만족
- 저장 중 버튼을 비활성화하고 같은 위치에 상태를 알리되 layout shift를 최소화
- toast만으로 오류를 알리지 않고 form/페이지 안에 지속되는 오류 문구 제공
- 보존·복구 불가 안내와 `새로 시작하기`를 키보드와 screen reader로 확인·실행 가능하게 하고 접근 불가 상태에 이전 목표/행동 제목을 렌더링하지 않음
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
- Spring Boot 프로젝트, forward migration, 세션/CSRF, 90일 활동 갱신, generic stale-cookie 처리, 도메인 불변조건, API, 문제 응답, idempotency, health check를 구현한다.
- 서비스/저장소 단위 테스트와 PostgreSQL 통합 테스트에서 양성, 다른 workspace, 중복/동시 요청, 활동/비활동 endpoint와 cleanup 경합을 검증한다.
- frontend 파일과 배포 파일은 수정하지 않는다.
- 다음 진입 조건: 전체 backend test와 migration 검증이 통과하고 API 응답이 6장의 계약과 일치한다.

### `mvp-frontend-ui` — frontend-ui

- 의존 package: 없음
- 담당 사용자 흐름: 모든 화면 상태의 읽기 순서, 입력/CTA, 반응형·접근성 표현
- React/TypeScript/Vite 실행 골격과 위 화면의 presentational component, 복구 불가·보존 안내, generic 접근 불가 화면, 반응형 tokens, 접근성 단위 테스트를 구현한다.
- API를 가짜 성공으로 하드코딩하지 않고 명시적 props와 callback으로 모든 loading/error/empty 상태를 표현한다.
- API/state 경로와 backend 파일은 수정하지 않는다.
- 다음 진입 조건: lint/typecheck/unit test/build가 통과하고 필수 viewport에서 모든 상태를 독립 렌더링할 수 있다.

`mvp-backend-core`와 `mvp-frontend-ui`는 서로 독립적이며 병렬 구현한다.

### `mvp-frontend-state` — frontend-state

- 의존 package: `mvp-frontend-ui`
- 담당 사용자 흐름: 새 session/bootstrap, write 중복 방지, typed expiry, stale-cookie 접근 불가, 오류와 409 상태 복구
- UI 골격 위에 session bootstrap, `workspaceExpiresAt`, typed API client, CSRF/idempotency, server-state 전이와 이전 workspace 브라우저 상태 제거를 구현한다.
- mock HTTP 테스트로 성공, validation, cookie 없는 `SESSION_REQUIRED`, `WORKSPACE_ACCESS_UNAVAILABLE`, 409 refetch, 네트워크 재시도를 검증한다. generic 접근 불가는 자동 session 재생성이나 retained submission 재사용으로 우회하지 않는다.
- feature 화면 조립과 backend 파일은 수정하지 않는다.
- 다음 진입 조건: mock contract test에서 `nextRequiredAction`의 모든 값과 오류 경계가 재현된다.

### `mvp-frontend-flow` — frontend

- 의존 package: `mvp-backend-core`, `mvp-frontend-state`
- 담당 사용자 흐름: 첫 세션 대표 흐름과 완료 후 다음 선택, 기록, 삭제를 실제 route로 연결
- UI와 state를 실제 route로 결합하고 첫 세션 대표 흐름, reload 복구, 이력, 삭제, 만료/미인식 cookie 뒤 명시적 새 workspace 시작을 완성한다.
- 실제 backend와의 contract smoke 및 Playwright 핵심 흐름을 추가한다. workspace 삭제·접근 불가 전환에서 controller snapshot, retained submission과 이전 workspace의 sessionStorage가 제거되는지 검증한다.
- 정본 계약 변경이 필요하면 임의 호환 코드를 넣지 않고 설계 변경으로 되돌린다.
- 다음 진입 조건: 실제 backend를 대상으로 대표 흐름과 reload/오류 복구 smoke가 통과한다.

### `mvp-release` — backend-infra

- 의존 package: `mvp-backend-core`, `mvp-frontend-flow`
- 담당 사용자 흐름: production과 같은 실행 환경에서 첫 방문부터 데이터 삭제까지의 전체 흐름
- backend/frontend production build, PostgreSQL, same-origin proxy와 UTC 03:00 cleanup scheduler를 compose로 연결한다.
- secret 값을 저장하지 않고 필수 환경 변수의 set 여부, migration, health, dry-run, cleanup 지표/alert, 격리 backup 복원·만료 데이터 재삭제, scheduler 중지 rollback을 runbook에 기록한다.
- 통합 head에서 clean build와 핵심 smoke를 실행한다.
- 제외 범위: 클라우드 계정 생성, DNS/TLS 변경, 운영 서버 수정, CI/repository-control 변경
- 완료 조건: 11장의 릴리스 판정을 같은 통합 revision에서 모두 충족한다.

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
| `mvp-backend-core` | Gradle 전체 테스트, migration 검증, API/격리/idempotency 통합 테스트 | 브라우저 레이아웃 |
| `mvp-frontend-ui` | lint/typecheck/unit test/build, 4개 viewport와 200% zoom 검토 | 실제 API 성공 |
| `mvp-frontend-state` | mock server 기반 state/오류/재시도 테스트 | production DB와 proxy |
| `mvp-frontend-flow` | 실제 backend contract smoke와 Playwright 대표 흐름 | production container/rollback |
| `mvp-release` | compose config, production build, health, migration, 통합 smoke, rollback rehearsal | 후순위 기능 |

각 package PR 통과는 제품 완료가 아니다. 마지막 통합 head에서 아래 릴리스 시나리오를 다시 검증한다.

### 90일 수명주기 회귀표

| 경계 | 기대 결과 |
| --- | --- |
| forward migration 기존 행 | migration DB 시각으로 `last_activity_at`이 채워지고 90일 유예가 시작됨 |
| 마지막 활동 후 89일, 정확히 cutoff | cleanup 대상이 아니며 정확히 cutoff는 strict less-than 조건으로 보존됨 |
| cutoff보다 과거 | 다음 batch에서 전체 cascade 삭제되고 이전 자원은 404 |
| session/bootstrap/history/mutation | security 통과 시 DB 시각 activity, 90일 cookie가 갱신됨; session/bootstrap은 `workspaceExpiresAt` 제공 |
| business validation/409 | Origin·CSRF 통과 뒤 activity와 cookie가 갱신되며 본래 오류는 유지됨 |
| health/OPTIONS/auth·Origin·CSRF 실패/polling 금지 경로 | TTL을 연장하지 않음 |
| 활동 우선 경합 | touch commit 뒤 cleanup 재검사에서 보존 |
| cleanup 우선 경합 | 요청은 generic 접근 불가로 끝나고 삭제된 workspace는 부활하지 않음 |
| 다중 scheduler와 10,000개 초과 backlog | 전역 잠금 한 job만 실행, 500 x 최대 20 batch 후 다음 schedule에서 계속됨 |
| cookie 없음 | 신규 방문 흐름; 과거 cookie-loss 감지나 복구를 약속하지 않음 |
| 비어 있지 않은 미인식 cookie | cookie 삭제, 이전 브라우저 상태 제거, 자동 생성 없이 `WORKSPACE_ACCESS_UNAVAILABLE` |
| 명시 삭제·자동 만료 뒤 새 시작 | 이전 자원 404와 sessionStorage 제거 후 사용자의 명시 선택으로 새 workspace 생성 |
| backup 복원 | 서비스 전 동일 cleanup으로 90일 초과 데이터를 재삭제하고 30일 rolling 상한을 확인 |

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
- cookie 없는 401과 비어 있지 않은 미인식 cookie를 구분하고, 후자에서 이전 브라우저 상태를 제거한 뒤 명시적으로만 새 workspace를 시작한다.
- 89일, 정확히 90일, 90일 초과 경계와 qualifying/non-qualifying 요청, sliding cookie, `workspaceExpiresAt`을 검증한다.
- 활동 우선/cleanup 우선 경합, 다중 scheduler, batch 상한, 반복 실행, 전체 cascade와 이전 자원 404를 검증한다.
- 첫 목표 저장 전과 데이터 관리 화면의 복구 불가·90일·backup 고지를 keyboard와 screen reader로 확인한다.
- 375x667, 768x1024, 1280x800과 200% zoom에서 대표 흐름을 완료한다.
- 로그와 오류 응답에 cookie, token, 사용자 입력 원문이 없다.
- 운영 설정에 secret 기본값이 없고 health 실패 시 배포 성공으로 판단하지 않는다.

### 릴리스 판정

다음이 모두 같은 통합 revision에서 확인되어야 첫 릴리스 후보가 된다.

- backend/frontend clean build와 전체 자동 테스트 통과
- PostgreSQL migration 적용과 rollback 절차 검토
- production compose 해석 성공, backend health 및 web route 응답 성공
- 대표 흐름과 회귀/격리 시나리오 통과
- 고심각도 접근성 오류 없음
- 실행 방법, 환경 변수 이름, health check, 백업, rollback이 runbook과 일치
- UTC 03:00 cleanup schedule, dry-run, 처리·skip·오류·소요 시간·backlog·마지막 성공 지표, 오류/26시간 alert, 격리 backup의 30일 상한과 복원 후 재삭제가 runbook 및 rehearsal과 일치
- QA PASS와 Reviewer APPROVE가 개별 worker head가 아니라 최종 통합 head에도 존재

## 12. 후순위 진입 조건

계정/동기화, 알림, 여러 목표, AI 제안, 구직 정보 연동은 대표 흐름의 실제 사용자 검증과 first-release 운영 안정성 확인 뒤 별도 task로 평가한다. 특히 AI는 결정론적 규칙 대비 재시작 완료율 개선, 비용, 개인정보 경계를 먼저 정의하기 전에는 추가하지 않는다.
