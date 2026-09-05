import axe from 'axe-core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AdaptationFormScreen, BlockerFormScreen } from '../ui/BlockedFlowScreens';
import { DataManagementScreen } from '../ui/DataManagementScreen';
import { HistoryScreen } from '../ui/HistoryScreen';
import {
  ErrorScreen,
  LoadingScreen,
  NextChoiceScreen,
  NoQuestScreen,
  PendingAdaptationScreen,
  QuestCompletedScreen,
  ReadyScreen,
  StartScreen,
} from '../ui/QuestScreens';

const noop = () => undefined;

async function expectNoAccessibilityViolations(container: HTMLElement) {
  const result = await axe.run(container);
  expect(result.violations).toEqual([]);
}

describe('독립 화면 상태', () => {
  it.each([
    ['NO_QUEST', <NoQuestScreen onCreate={noop} />, '진행 중인 목표가 없어요'],
    ['READY', <ReadyScreen quest={{ title: '목표' }} action={{ title: '작은 행동', estimatedMinutes: 10 }} onComplete={noop} onBlocked={noop} onArchive={noop} />, '작은 행동'],
    ['PENDING_ADAPTATION', <PendingAdaptationScreen onResume={noop} />, '막힌 행동을 더 작게 바꿀 수 있어요'],
    ['NEEDS_NEXT_ACTION', <NextChoiceScreen completedActionTitle="작은 행동" onCreateNext={noop} onCompleteQuest={noop} />, '한 걸음 진행했어요'],
    ['QUEST_COMPLETED', <QuestCompletedScreen questTitle="목표" onCreate={noop} />, '여기까지 해낸 과정을 남겼어요'],
    ['loading', <LoadingScreen />, '현재 행동을 불러오는 중이에요'],
    ['empty', <HistoryScreen state="empty" />, '아직 기록이 없어요'],
    ['error', <ErrorScreen message="입력을 유지한 채 다시 시도해 주세요." onRetry={noop} />, '화면을 불러오지 못했어요'],
  ])('%s 상태를 단독 렌더링한다', async (_state, component, heading) => {
    const { container } = render(component);
    expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
    await expectNoAccessibilityViolations(container);
  });

  it('색 외에 아이콘과 텍스트로 상태를 전달한다', () => {
    render(<ReadyScreen quest={{ title: '목표' }} action={{ title: '작은 행동', estimatedMinutes: 10 }} onComplete={noop} onBlocked={noop} onArchive={noop} />);
    expect(screen.getByLabelText('상태: 진행 가능')).toHaveTextContent('→');
    expect(screen.getByLabelText('상태: 진행 가능')).toHaveTextContent('진행 가능');
  });
});

describe('폼 접근성과 사용자 입력', () => {
  it('시작 화면의 label과 논리적인 키보드 순서를 제공한다', async () => {
    const user = userEvent.setup();
    const { container } = render(<StartScreen onSubmit={noop} />);

    await user.tab();
    expect(screen.getByLabelText('이루고 싶은 구직 목표')).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText('오늘 할 가장 작은 행동')).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText('예상 시간')).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: '작은 행동 시작하기' })).toHaveFocus();
    await expectNoAccessibilityViolations(container);
  });

  it('오류 문구를 form 안에 지속적으로 표시하고 입력값을 보존한다', () => {
    render(
      <StartScreen
        defaultValues={{ questTitle: '내 목표', actionTitle: '채용 페이지 열기', estimatedMinutes: 5 }}
        errorMessage="목표 제목을 확인해 주세요."
        onSubmit={noop}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('목표 제목을 확인해 주세요.');
    expect(screen.getByLabelText('이루고 싶은 구직 목표')).toHaveValue('내 목표');
    expect(screen.getByLabelText('오늘 할 가장 작은 행동')).toHaveValue('채용 페이지 열기');
  });

  it('막힘 기록과 다시 설계 form의 모든 입력에 label을 제공한다', async () => {
    const blocker = render(<BlockerFormScreen onSubmit={noop} onCancel={noop} />);
    expect(screen.getByRole('group', { name: '가장 가까운 이유 하나를 골라 주세요' })).toBeInTheDocument();
    expect(screen.getByLabelText(/덧붙일 메모/)).toBeInTheDocument();
    await expectNoAccessibilityViolations(blocker.container);
    blocker.unmount();

    const adaptation = render(
      <AdaptationFormScreen
        guidance="첫 단계만 분리했어요."
        defaultValues={{ title: '페이지 열기', estimatedMinutes: 5 }}
        onSubmit={noop}
        onCancel={noop}
      />,
    );
    expect(screen.getByLabelText('더 작은 다음 행동')).toBeInTheDocument();
    expect(screen.getByLabelText('예상 시간')).toBeInTheDocument();
    await expectNoAccessibilityViolations(adaptation.container);
  });

  it('저장 중 CTA를 비활성화하고 같은 위치에 상태를 알린다', () => {
    render(<BlockerFormScreen isSubmitting onSubmit={noop} onCancel={noop} />);
    expect(screen.getByRole('button', { name: '기록하는 중…' })).toBeDisabled();
  });
});

describe('CTA와 보조 화면', () => {
  it('모든 주요 CTA에 44px 이상의 최소 높이를 적용한다', () => {
    render(<NoQuestScreen onCreate={noop} />);
    const button = screen.getByRole('button', { name: '목표 만들기' });
    expect(getComputedStyle(button).minHeight).toBe('44px');
  });

  it('기록에서 BLOCKED와 successor 연결을 함께 읽을 수 있다', async () => {
    const { container } = render(
      <HistoryScreen
        state="ready"
        items={[{
          id: '1',
          outcome: 'BLOCKED',
          actionTitle: '회사 비교하기',
          createdAtLabel: '오늘',
          blockerLabel: '생각보다 너무 커요',
          successorTitle: '채용 페이지 하나 열기',
        }]}
      />,
    );
    expect(screen.getByLabelText('상태: 막힘')).toBeInTheDocument();
    expect(screen.getByText('다시 시작한 행동')).toBeInTheDocument();
    expect(screen.getByText('채용 페이지 하나 열기')).toBeInTheDocument();
    await expectNoAccessibilityViolations(container);
  });

  it('데이터 삭제 CTA는 별도 위험 문구와 함께 제공한다', async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();
    const { container } = render(<DataManagementScreen onDelete={onDelete} />);
    expect(screen.getByText(/영구적으로 삭제되며 되돌릴 수 없어요/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '내 데이터 모두 삭제하기' }));
    expect(onDelete).toHaveBeenCalledOnce();
    await expectNoAccessibilityViolations(container);
  });
});
