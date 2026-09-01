import { describe, expect, it, vi } from 'vitest'
import {
  QuestApiError,
  QuestNetworkError,
  type QuestApi,
  type SessionStartResult,
} from '../api/client'
import type { JourneySnapshot, TransitionResult } from '../api/contracts'
import { JourneyStore } from './journeyStore'

const JOURNEY_ID = '11111111-1111-4111-8111-111111111111'
const QUEST_ID = '22222222-2222-4222-8222-222222222222'
const NEXT_QUEST_ID = '33333333-3333-4333-8333-333333333333'
const COMMAND_ID = '44444444-4444-4444-8444-444444444444'

const snapshot: JourneySnapshot = {
  journeyId: JOURNEY_ID,
  goalType: 'RESUME',
  energyLevel: 'MEDIUM',
  availableMinutes: 15,
  version: 1,
  currentQuest: {
    id: QUEST_ID,
    catalogKey: 'resume-keywords-v1',
    title: '경험 키워드 3개 적기',
    instruction: '떠오르는 단어만 적으면 충분합니다.',
    estimatedMinutes: 5,
    difficultyLevel: 2,
  },
  progress: { completedCount: 0, reframedCount: 0 },
  recentAttempts: [],
}

function nextSnapshot(version = 2): JourneySnapshot {
  return {
    ...snapshot,
    version,
    currentQuest: { ...snapshot.currentQuest, id: NEXT_QUEST_ID },
  }
}

function transition(type: 'COMPLETED' | 'REFRAMED'): TransitionResult {
  return {
    transition:
      type === 'REFRAMED'
        ? { type, previousAttemptId: QUEST_ID, reason: 'TOO_BIG' }
        : { type, previousAttemptId: QUEST_ID, reason: null },
    snapshot: nextSnapshot(),
  }
}

function apiStub(overrides: Partial<QuestApi> = {}): QuestApi {
  return {
    startSession: vi.fn<() => Promise<SessionStartResult>>().mockResolvedValue({
      created: false,
      expiresAt: '2026-09-30T00:00:00Z',
    }),
    getJourney: vi.fn<() => Promise<JourneySnapshot>>().mockResolvedValue(snapshot),
    createJourney: vi.fn().mockResolvedValue(snapshot),
    completeQuest: vi.fn().mockResolvedValue(transition('COMPLETED')),
    reframeQuest: vi.fn().mockResolvedValue(transition('REFRAMED')),
    ...overrides,
  }
}

describe('JourneyStore bootstrap', () => {
  it('새 세션 생성을 여정 없음과 별도 상태로 보존한다', async () => {
    const api = apiStub({
      startSession: vi.fn().mockResolvedValue({
        created: true,
        expiresAt: '2026-09-30T00:00:00Z',
      }),
    })
    const store = new JourneyStore(api)

    await store.bootstrap()

    expect(store.getState().bootstrap.status).toBe('session-created')
    expect(api.getJourney).not.toHaveBeenCalled()
  })

  it('기존 세션의 여정 없음과 복원을 구분한다', async () => {
    const missingApi = apiStub({
      getJourney: vi.fn().mockRejectedValue(
        new QuestApiError(404, {
          code: 'JOURNEY_NOT_FOUND',
          message: '여정이 없습니다.',
          fieldErrors: null,
          snapshot: null,
        }),
      ),
    })
    const missingStore = new JourneyStore(missingApi)
    await missingStore.bootstrap()
    expect(missingStore.getState().bootstrap.status).toBe('journey-missing')

    const restoredStore = new JourneyStore(apiStub())
    await restoredStore.bootstrap()
    expect(restoredStore.getState()).toMatchObject({
      bootstrap: { status: 'journey-restored' },
      snapshot,
    })
  })

  it('401 세션 만료와 네트워크 오류를 서로 다른 복구 상태로 둔다', async () => {
    const expiredStore = new JourneyStore(
      apiStub({
        getJourney: vi.fn().mockRejectedValue(
          new QuestApiError(401, {
            code: 'SESSION_REQUIRED',
            message: '세션이 필요합니다.',
            fieldErrors: null,
            snapshot: null,
          }),
        ),
      }),
    )
    await expiredStore.bootstrap()
    expect(expiredStore.getState().bootstrap).toEqual({
      status: 'session-expired',
      message: '세션이 만료되어 새로 시작합니다.',
    })

    const networkStore = new JourneyStore(
      apiStub({ startSession: vi.fn().mockRejectedValue(new QuestNetworkError('network')) }),
    )
    await networkStore.bootstrap()
    expect(networkStore.getState().bootstrap.status).toBe('network-error')
  })
})

describe('JourneyStore mutation', () => {
  it('pending 중 중복 완료 클릭을 한 요청과 한 commandId로 합친다', async () => {
    let resolveComplete!: (value: TransitionResult) => void
    const pending = new Promise<TransitionResult>((resolve) => {
      resolveComplete = resolve
    })
    const completeQuest = vi.fn().mockReturnValue(pending)
    const commandIdFactory = vi.fn(() => COMMAND_ID)
    const store = new JourneyStore(apiStub({ completeQuest }), commandIdFactory)
    await store.bootstrap()

    const first = store.completeCurrentQuest()
    const duplicate = store.completeCurrentQuest()

    expect(completeQuest).toHaveBeenCalledTimes(1)
    expect(commandIdFactory).toHaveBeenCalledTimes(1)
    resolveComplete(transition('COMPLETED'))
    await Promise.all([first, duplicate])
    expect(store.getState().snapshot?.version).toBe(2)
  })

  it.each(['complete', 'reframe'] as const)(
    'timeout 후 %s retry가 최초 commandId와 payload를 유지한다',
    async (kind) => {
      const timeout = new QuestNetworkError('timeout')
      const completeQuest = vi
        .fn()
        .mockRejectedValueOnce(timeout)
        .mockResolvedValueOnce(transition('COMPLETED'))
      const reframeQuest = vi
        .fn()
        .mockRejectedValueOnce(timeout)
        .mockResolvedValueOnce(transition('REFRAMED'))
      const commandIdFactory = vi.fn(() => COMMAND_ID)
      const store = new JourneyStore(
        apiStub({ completeQuest, reframeQuest }),
        commandIdFactory,
      )
      await store.bootstrap()

      if (kind === 'complete') await store.completeCurrentQuest()
      else await store.reframeCurrentQuest('TOO_BIG')

      expect(store.getState().mutation.status).toBe('retryable')
      if (kind === 'complete') await store.completeCurrentQuest()
      else await store.reframeCurrentQuest('TOO_BIG')
      expect(commandIdFactory).toHaveBeenCalledTimes(1)

      await store.retryMutation()
      const calls = kind === 'complete' ? completeQuest.mock.calls : reframeQuest.mock.calls
      expect(calls).toHaveLength(2)
      expect(calls[0]).toEqual(calls[1])
      expect(calls[0]).toContain(COMMAND_ID)
      expect(store.getState().mutation.status).toBe('success')
    },
  )

  it('STALE_JOURNEY의 최신 snapshot으로 교체하고 오류 command를 폐기한다', async () => {
    const latest = nextSnapshot(7)
    const completeQuest = vi.fn().mockRejectedValue(
      new QuestApiError(409, {
        code: 'STALE_JOURNEY',
        message: '여정이 변경되었습니다.',
        fieldErrors: null,
        snapshot: latest,
      }),
    )
    const store = new JourneyStore(apiStub({ completeQuest }), () => COMMAND_ID)
    await store.bootstrap()

    await store.completeCurrentQuest()

    expect(store.getState()).toMatchObject({
      snapshot: latest,
      mutation: {
        status: 'stale',
        message: '다른 요청이 먼저 반영되어 최신 상태를 불러왔어요.',
      },
    })
    await store.retryMutation()
    expect(completeQuest).toHaveBeenCalledTimes(1)
  })

  it('validation fieldErrors를 폼이 소비할 수 있는 상태로 매핑한다', async () => {
    const createJourney = vi.fn().mockRejectedValue(
      new QuestApiError(400, {
        code: 'VALIDATION_ERROR',
        message: '요청 값을 확인해 주세요.',
        fieldErrors: { availableMinutes: '허용된 시간을 선택해 주세요.' },
        snapshot: null,
      }),
    )
    const store = new JourneyStore(apiStub({ createJourney }), () => COMMAND_ID)

    await store.createJourney({
      goalType: 'JOB_SEARCH',
      energyLevel: 'LOW',
      availableMinutes: 5,
    })

    expect(store.getState().mutation).toEqual({
      status: 'error',
      code: 'VALIDATION_ERROR',
      message: '요청 값을 확인해 주세요.',
      fieldErrors: { availableMinutes: '허용된 시간을 선택해 주세요.' },
    })
  })
})
