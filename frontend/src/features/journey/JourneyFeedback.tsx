import { Button } from '../../components/Button'
import { Feedback } from '../../components/Feedback'
import type { MutationState } from '../../state/journeyStore'

export function JourneyFeedback({
  mutation,
  onRetry,
}: {
  mutation: MutationState
  onRetry: () => void
}) {
  if (mutation.status === 'retryable') {
    return (
      <Feedback tone="error" title="요청을 마치지 못했어요">
        <p>{mutation.message} 같은 요청으로 다시 이어갈 수 있어요.</p>
        <Button variant="secondary" onClick={onRetry}>같은 요청 다시 시도</Button>
      </Feedback>
    )
  }

  if (mutation.status === 'stale') {
    return (
      <Feedback title="최신 행동을 불러왔어요">
        <p>{mutation.message}</p>
      </Feedback>
    )
  }

  if (mutation.status === 'error') {
    return (
      <Feedback tone="error" title="요청을 확인해 주세요">
        <p>{mutation.message}</p>
      </Feedback>
    )
  }

  if (mutation.status === 'success') {
    const isComplete = mutation.command.kind === 'complete'
    const isReframe = mutation.command.kind === 'reframe'

    if (!isComplete && !isReframe) return null

    return (
      <Feedback tone="success" title={isComplete ? '작은 행동을 완료했어요' : '더 쉬운 행동을 준비했어요'}>
        <p>{isComplete ? '완료 기록을 남기고 다음 행동을 연결했어요.' : '지금 여력에 맞는 다음 행동을 확인해 보세요.'}</p>
      </Feedback>
    )
  }

  return null
}
