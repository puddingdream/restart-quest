# Re:Start Quest

실패한 구직 행동을 더 작은 행동으로 다시 시작하도록 돕는 MVP입니다. [제품 브리프](docs/PROJECT_BRIEF.md)는 전체 목표를, [정본 설계](docs/DESIGN.md)는 현재 구현 slice와 계약을 설명합니다.

현재 통합된 slice는 시간과 에너지를 받아 퀘스트를 생성·저장하고, 완료 또는 실패 이유를 기록하며, 실패 이유에 맞춘 더 작은 행동과 부모·루트 이력을 보여 줍니다. 대시보드는 실제 저장 기록에서 상태별 수치, 연결 이력, 다음 행동을 읽어 같은 화면에 표시합니다.

## 준비

- Node.js 22 이상과 npm이 필요합니다.
- 브라우저 검증(`smoke`, `test:e2e`)에는 Chrome 또는 Chromium이 필요합니다. Windows의 기본 Chrome 설치 경로 또는 Linux의 `chromium` 명령을 사용하며, 다른 위치에 있다면 `CHROME_PATH`로 실행 파일 경로를 지정합니다.
- 유료 API 키나 외부 서비스는 필요하지 않습니다.

## 설치·빌드·실행

저장소 루트에서 다음 순서로 실행합니다. `npm ci`는 `client/package-lock.json`을 기준으로 클라이언트 의존성을 설치하고, 빌드는 서버가 기본으로 제공하는 `client/dist`를 만듭니다.

```sh
cd client
npm ci
npm run build
cd ..
npm start
```

서버는 기본적으로 `http://127.0.0.1:3000`에서 화면, `/api/quests`, 읽기 전용 `/api/dashboard`를 같은 origin으로 제공합니다. 저장소 루트에서 `npm start`를 실행해야 상대 경로 기본값인 `client/dist`와 `data/quests.json`이 맞습니다. 처음 실행할 때 `data/`는 서버가 생성하며 Git 추적 대상이 아닙니다. 빌드 전에 실행하면 정적 화면을 제공할 수 없습니다.

선택적 경로 설정은 다음과 같습니다. `QUEST_PUBLIC_DIR`는 이미 존재하는 정적 파일 디렉터리를, `QUEST_DATA_FILE`은 저장할 JSON 파일을 가리킵니다. 둘 다 생략하면 위 기본 경로를 사용합니다. 아래 경로는 비밀값을 포함하지 않는 로컬 예제입니다.

PowerShell:

```powershell
$env:QUEST_PUBLIC_DIR = 'client/dist'
$env:QUEST_DATA_FILE = 'data/local-quests.json'
npm start
```

POSIX 셸:

```sh
QUEST_PUBLIC_DIR=client/dist QUEST_DATA_FILE=data/local-quests.json npm start
```

## 검증

저장소 루트에서 서버 테스트를 실행합니다.

```sh
npm test
```

클라이언트 검증은 `client`에서 실행합니다. 브라우저 검증 명령은 테스트 서버를 직접 시작하므로 별도로 `npm start`를 실행하지 않습니다. 브라우저를 다른 위치에 설치했다면 검증 전에 `CHROME_PATH`를 설정합니다.

```sh
cd client
npm run lint
npm test
npm run smoke
npm run test:e2e
```

`npm run smoke`는 계약 fixture를 사용하는 임시 서버에서 생성·완료·실패 이유·재설계·대시보드 빈 상태와 수치·이력·다음 행동·읽기 오류·재시도, 400·409·503·통신 단절 안내와 데스크톱 1280px·모바일 390px 레이아웃을 확인합니다. 실제 저장 서버와의 연결을 증명하지 않습니다. `npm run test:e2e`는 빌드한 화면과 실제 저장 서버를 함께 실행해 생성·완료, 세 실패 이유별 기록·재설계·이력, 잘못된 입력과 중복·역방향 요청의 저장 불변, 실제 저장 실패 503·통신 단절, 새로고침·서버 재시작 후 기록 유지를 확인합니다. 대시보드는 격리된 저장 파일과 실제 `/api/quests`·`/api/quests/{id}/history` 응답을 기준으로 빈 상태, 상태별 수치, 루트별 순서 있는 이력, 다음 행동을 화면과 대조합니다. 읽기 실패 500은 브라우저 요청에 한 번 주입해 이전 수치 숨김과 GET 재시도를 확인하며, 실제 저장 서버가 500을 낸 것으로 해석하지 않습니다. 데스크톱 1280px·모바일 390px의 핵심 흐름도 같은 명령에서 확인합니다. 이 명령은 필요한 정적 파일을 실행 전에 직접 빌드하고 격리된 임시 저장 파일을 사용합니다. 스크린샷은 무시 대상인 `client/dist/verification/`에 저장합니다. 브라우저 실행 여부와 실제 통과 결과는 해당 환경의 QA 기록에서 확인해야 합니다.

## 범위와 제한

이번 slice의 저장 방식은 단일 서버 프로세스의 로컬 JSON 스냅샷입니다. 같은 파일에 여러 서버 프로세스가 쓰는 배포는 지원하지 않습니다. 전체 MVP 완료 판단에는 생성→기록→재설계→대시보드 흐름을 동일 통합 커밋에서 확인한 QA·리뷰 증거가 필요합니다.
