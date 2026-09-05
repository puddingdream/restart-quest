import { useState } from 'react';
import { AdaptationFormScreen, BlockerFormScreen } from './BlockedFlowScreens';
import { DataManagementScreen } from './DataManagementScreen';
import { HistoryScreen } from './HistoryScreen';
import { AppShell } from './primitives';
import {
  ErrorScreen,
  LoadingScreen,
  NextChoiceScreen,
  NoQuestScreen,
  PendingAdaptationScreen,
  QuestCompletedScreen,
  ReadyScreen,
  StartScreen,
  WorkspaceAccessUnavailableScreen,
} from './QuestScreens';

const previews = [
  '시작',
  'NO_QUEST',
  'READY',
  'PENDING_ADAPTATION',
  'NEEDS_NEXT_ACTION',
  'QUEST_COMPLETED',
  '막힘 기록',
  '다시 설계',
  '기록',
  '기록 없음',
  '데이터 관리',
  'loading',
  'error',
  '작업 공간 접근 불가',
] as const;

type Preview = (typeof previews)[number];

const noop = () => undefined;

export function UiPreview() {
  const [preview, setPreview] = useState<Preview>('READY');
  const currentPage = preview.startsWith('기록') ? '기록' : preview === '데이터 관리' ? '데이터 관리' : '지금';

  return (
    <AppShell currentPage={currentPage}>
      <aside className="preview-toolbar" aria-label="UI 상태 미리보기 도구">
        <label htmlFor="preview-select">검토할 화면</label>
        <select id="preview-select" value={preview} onChange={(event) => setPreview(event.target.value as Preview)}>
          {previews.map((item) => <option key={item}>{item}</option>)}
        </select>
      </aside>
      {preview === '시작' ? <StartScreen onSubmit={noop} /> : null}
      {preview === 'NO_QUEST' ? <NoQuestScreen onCreate={noop} /> : null}
      {preview === 'READY' ? (
        <ReadyScreen
          quest={{ title: '이번 주 지원할 회사 3곳 정하기' }}
          action={{ title: '관심 회사 채용 페이지 하나 열기', estimatedMinutes: 10 }}
          onComplete={noop}
          onBlocked={noop}
          onArchive={noop}
        />
      ) : null}
      {preview === 'PENDING_ADAPTATION' ? <PendingAdaptationScreen onResume={noop} /> : null}
      {preview === 'NEEDS_NEXT_ACTION' ? (
        <NextChoiceScreen completedActionTitle="관심 회사 채용 페이지 하나 열기" onCreateNext={noop} onCompleteQuest={noop} />
      ) : null}
      {preview === 'QUEST_COMPLETED' ? <QuestCompletedScreen questTitle="이번 주 지원할 회사 3곳 정하기" onCreate={noop} /> : null}
      {preview === '막힘 기록' ? <BlockerFormScreen onSubmit={noop} onCancel={noop} /> : null}
      {preview === '다시 설계' ? (
        <AdaptationFormScreen
          guidance="전체를 끝내려 하지 말고, 첫 단계만 분리했어요."
          defaultValues={{ title: '첫 단계만 하기: 관심 회사 채용 페이지 열기', estimatedMinutes: 5 }}
          onSubmit={noop}
          onCancel={noop}
        />
      ) : null}
      {preview === '기록' ? (
        <HistoryScreen
          state="ready"
          items={[
            {
              id: 'history-2',
              outcome: 'DONE',
              actionTitle: '관심 회사 채용 페이지 하나 열기',
              createdAtLabel: '오늘 오전 10:20',
            },
            {
              id: 'history-1',
              outcome: 'BLOCKED',
              actionTitle: '지원할 회사 세 곳 비교하기',
              createdAtLabel: '어제 오후 4:10',
              blockerLabel: '생각보다 너무 커요',
              successorTitle: '관심 회사 채용 페이지 하나 열기',
            },
          ]}
        />
      ) : null}
      {preview === '기록 없음' ? <HistoryScreen state="empty" /> : null}
      {preview === '데이터 관리' ? <DataManagementScreen onDelete={noop} /> : null}
      {preview === 'loading' ? <LoadingScreen /> : null}
      {preview === 'error' ? <ErrorScreen message="연결을 확인한 뒤 입력을 유지한 채 다시 시도해 주세요." onRetry={noop} /> : null}
      {preview === '작업 공간 접근 불가' ? <WorkspaceAccessUnavailableScreen onStartNewWorkspace={noop} /> : null}
    </AppShell>
  );
}
