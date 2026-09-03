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
const SECOND_COMMAND_ID = '55555555-5555-4555-8555-555555555555'

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

function transition(type: 'COMPLETED' | 'REFRAMED', version = 2): TransitionResult {
  return {
    transition:
      type === 'REFRAMED'
        ? { type, previousAttemptId: QUEST_ID, reason: 'TOO_BIG' }
        : { type, previousAttemptId: QUEST_ID, reason: null },
    snapshot: nextSnapshot(version),
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

function deferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
} {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((fulfill) => {
    resolve = fulfill
  })
  return { promise, resolve }
}

describe('JourneyStore bootstrap', () => {
  it('새 세션 생성, 여정 없음, 여정 복원을 서로 다른 상태로 보존한다', async () => {
    const createdApi = apiStub({
      startSession: vi.fn().mockResolvedValue({
        created: true,
        expiresAt: '2026-09-30T00:00:00Z',
      }),
    })
    const createdStore = new JourneyStore(createdApi)
    await createdStore.bootstrap()
    expect(createdStore.getState().bootstrap.status).toBe('session-created')
    expect(createdApi.getJourney).not.toHaveBeenCalled()

    const missingStore = new JourneyStore(
      apiStub({
        getJourney: vi.fn().mockRejectedValue(
          new QuestApiError(404, {
            code: 'JOURNEY_NOT_FOUND',
            message: '여정이 없습니다.',
            fieldErrors: null,
            snapshot: null,
          }),
        ),
      }),
    )
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

  it('새 bootstrap 뒤에 도착한 이전 응답을 무시한다', async () => {
    const firstSession = deferred<SessionStartResult>()
    const getJourney = vi.fn().mockResolvedValue(snapshot)
    const api = apiStub({
      startSession: vi
        .fn()
        .mockReturnValueOnce(firstSession.promise)
        .mockResolvedValueOnce({ created: true, expiresAt: '2026-09-30T00:00:00Z' }),
      getJourney,
    })
    const store = new JourneyStore(api)

    const earlier = store.bootstrap()
    await store.bootstrap()
    firstSession.resolve({ created: false, expiresAt: '2026-09-30T00:00:00Z' })
    await earlier

    expect(store.getState().bootstrap.status).toBe('session-created')
    expect(getJourney).not.toHaveBeenCalled()
  })
})

describe('JourneyStore mutation', () => {
  it('pending 중 중복 완료 클릭을 한 요청과 한 commandId로 합친다', async () => {
    const pending = deferred<TransitionResult>()
    const completeQuest = vi.fn().mockReturnValue(pending.promise)
    const commandIdFactory = vi.fn(() => COMMAND_ID)
    const store = new JourneyStore(apiStub({ completeQuest }), commandIdFactory)
    await store.bootstrap()

    const first = store.completeCurrentQuest()
    const duplicate = store.completeCurrentQuest()
    await Promise.resolve()

    expect(first).toBe(duplicate)
    expect(completeQuest).toHaveBeenCalledTimes(1)
    expect(commandIdFactory).toHaveBeenCalledTimes(1)
    pending.resolve(transition('COMPLETED'))
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

  it('성공 이후의 새 사용자 명령에만 새 commandId를 만든다', async () => {
    const completeQuest = vi
      .fn()
      .mockResolvedValueOnce(transition('COMPLETED', 2))
      .mockResolvedValueOnce(transition('COMPLETED', 3))
    const commandIdFactory = vi
      .fn()
      .mockReturnValueOnce(COMMAND_ID)
      .mockReturnValueOnce(SECOND_COMMAND_ID)
    const store = new JourneyStore(apiStub({ completeQuest }), commandIdFactory)
    await store.bootstrap()

    await store.completeCurrentQuest()
    await store.completeCurrentQuest()

    expect(commandIdFactory).toHaveBeenCalledTimes(2)
    expect(completeQuest.mock.calls[0]?.[1]).toBe(COMMAND_ID)
    expect(completeQuest.mock.calls[1]?.[1]).toBe(SECOND_COMMAND_ID)
  })

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

  it('400 validation, 404 및 401 오류를 폼과 라우팅 상태로 매핑한다', async () => {
    const validationStore = new JourneyStore(
      apiStub({
        createJourney: vi.fn().mockRejectedValue(
          new QuestApiError(400, {
            code: 'VALIDATION_ERROR',
            message: '요청 값을 확인해 주세요.',
            fieldErrors: { availableMinutes: '허용된 시간을 선택해 주세요.' },
            snapshot: null,
          }),
        ),
      }),
      () => COMMAND_ID,
    )
    await validationStore.createJourney({
      goalType: 'JOB_SEARCH',
      energyLevel: 'LOW',
      availableMinutes: 5,
    })
    expect(validationStore.getState().mutation).toEqual({
      status: 'error',
      code: 'VALIDATION_ERROR',
      message: '요청 값을 확인해 주세요.',
      fieldErrors: { availableMinutes: '허용된 시간을 선택해 주세요.' },
    })

    const missingStore = new JourneyStore(
      apiStub({
        createJourney: vi.fn().mockRejectedValue(
          new QuestApiError(404, {
            code: 'QUEST_NOT_FOUND',
            message: '행동을 찾을 수 없습니다.',
            fieldErrors: null,
            snapshot: null,
          }),
        ),
      }),
      () => COMMAND_ID,
    )
    await missingStore.createJourney({
      goalType: 'JOB_SEARCH',
      energyLevel: 'LOW',
      availableMinutes: 5,
    })
    expect(missingStore.getState().mutation).toMatchObject({
      status: 'error',
      code: 'QUEST_NOT_FOUND',
    })

    const expiredStore = new JourneyStore(
      apiStub({
        createJourney: vi.fn().mockRejectedValue(
          new QuestApiError(401, {
            code: 'SESSION_REQUIRED',
            message: '세션이 필요합니다.',
            fieldErrors: null,
            snapshot: null,
          }),
        ),
      }),
      () => COMMAND_ID,
    )
    await expiredStore.createJourney({
      goalType: 'JOB_SEARCH',
      energyLevel: 'LOW',
      availableMinutes: 5,
    })
    expect(expiredStore.getState()).toMatchObject({
      snapshot: null,
      mutation: { status: 'session-expired' },
    })
  })

  it('새 bootstrap 뒤에 도착한 mutation 응답을 상태에 반영하지 않는다', async () => {
    const pending = deferred<TransitionResult>()
    const startSession = vi
      .fn()
      .mockResolvedValueOnce({ created: false, expiresAt: '2026-09-30T00:00:00Z' })
      .mockResolvedValueOnce({ created: true, expiresAt: '2026-09-30T00:00:00Z' })
    const store = new JourneyStore(
      apiStub({ startSession, completeQuest: vi.fn().mockReturnValue(pending.promise) }),
      () => COMMAND_ID,
    )
    await store.bootstrap()

    const mutation = store.completeCurrentQuest()
    await Promise.resolve()
    await store.bootstrap()
    pending.resolve(transition('COMPLETED'))
    await mutation

    expect(store.getState()).toMatchObject({
      bootstrap: { status: 'session-created' },
      snapshot: null,
      mutation: { status: 'idle' },
    })
  })
})
