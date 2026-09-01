import { afterEach, describe, expect, it, vi } from 'vitest'
import type { JourneySnapshot } from './contracts'
import {
  ApiContractError,
  QuestApiClient,
} from './client'

const JOURNEY_ID = '11111111-1111-4111-8111-111111111111'
const QUEST_ID = '22222222-2222-4222-8222-222222222222'

const snapshot: JourneySnapshot = {
  journeyId: JOURNEY_ID,
  goalType: 'JOB_SEARCH',
  energyLevel: 'LOW',
  availableMinutes: 5,
  version: 1,
  currentQuest: {
    id: QUEST_ID,
    catalogKey: 'job-search-open-tab-v1',
    title: '채용 사이트 탭 열기',
    instruction: '사이트를 열면 오늘 행동은 끝입니다.',
    estimatedMinutes: 2,
    difficultyLevel: 1,
  },
  progress: { completedCount: 0, reframedCount: 0 },
  recentAttempts: [],
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('QuestApiClient', () => {
  it.each([
    [200, false],
    [201, true],
  ])('세션 %i 응답을 구분하고 cookie credentials만 사용한다', async (status, created) => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(status, { expiresAt: '2026-09-30T00:00:00Z' }),
    )
    const localStorageWrite = vi.spyOn(Storage.prototype, 'setItem')
    const client = new QuestApiClient({ fetchImpl: fetchMock })

    await expect(client.startSession()).resolves.toEqual({
      created,
      expiresAt: '2026-09-30T00:00:00Z',
    })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/session',
      expect.objectContaining({ credentials: 'include', method: 'POST' }),
    )
    expect(localStorageWrite).not.toHaveBeenCalled()
  })

  it('JourneySnapshot과 TransitionResult를 runtime에서 검증한다', async () => {
    const transition = {
      transition: {
        type: 'COMPLETED',
        previousAttemptId: QUEST_ID,
        reason: null,
      },
      snapshot: { ...snapshot, version: 2 },
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, snapshot))
      .mockResolvedValueOnce(jsonResponse(200, transition))
    const client = new QuestApiClient({ fetchImpl: fetchMock })

    await expect(client.getJourney()).resolves.toEqual(snapshot)
    await expect(
      client.completeQuest(QUEST_ID, '33333333-3333-4333-8333-333333333333', 1),
    ).resolves.toEqual(transition)
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({ credentials: 'include' }),
    )
  })

  it('계약에 맞지 않는 성공 응답을 상태로 전달하지 않는다', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { ...snapshot, version: '1' }),
    )
    const client = new QuestApiClient({ fetchImpl: fetchMock })

    await expect(client.getJourney()).rejects.toBeInstanceOf(ApiContractError)
  })

  it.each([
    [401, 'SESSION_REQUIRED', null],
    [404, 'JOURNEY_NOT_FOUND', null],
    [400, 'VALIDATION_ERROR', { availableMinutes: 'must be one of 5, 15, 30' }],
  ])('HTTP %i 오류 payload를 runtime 검증해 전달한다', async (status, code, fieldErrors) => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(status, {
        code,
        message: '요청을 처리할 수 없습니다.',
        fieldErrors,
        snapshot: null,
      }),
    )
    const client = new QuestApiClient({ fetchImpl: fetchMock })

    const request = client.getJourney()
    await expect(request).rejects.toMatchObject({
      status,
      payload: expect.objectContaining({ code, fieldErrors }),
    })
  })

  it('timeout을 retry 가능한 네트워크 오류로 분류한다', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('aborted', 'AbortError'))
        })
      }),
    )
    const client = new QuestApiClient({ fetchImpl: fetchMock, timeoutMs: 25 })

    const request = client.getJourney()
    const rejection = expect(request).rejects.toMatchObject({
      kind: 'timeout',
    })
    await vi.advanceTimersByTimeAsync(25)
    await rejection
  })
})
