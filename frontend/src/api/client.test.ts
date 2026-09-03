import { afterEach, describe, expect, it, vi } from 'vitest'
import type { JourneySnapshot } from './contracts'
import { ApiContractError, QuestApiClient } from './client'

const JOURNEY_ID = '11111111-1111-4111-8111-111111111111'
const QUEST_ID = '22222222-2222-4222-8222-222222222222'
const COMMAND_ID = '33333333-3333-4333-8333-333333333333'

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
    const storageWrite = vi.spyOn(Storage.prototype, 'setItem')
    const client = new QuestApiClient({ fetchImpl: fetchMock })

    await expect(client.startSession()).resolves.toEqual({
      created,
      expiresAt: '2026-09-30T00:00:00Z',
    })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/session',
      expect.objectContaining({ credentials: 'include', method: 'POST' }),
    )
    expect(storageWrite).not.toHaveBeenCalled()
  })

  it('201 여정 생성 요청과 JourneySnapshot을 runtime에서 검증한다', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, snapshot))
    const client = new QuestApiClient({ fetchImpl: fetchMock })

    await expect(
      client.createJourney(
        { goalType: 'JOB_SEARCH', energyLevel: 'LOW', availableMinutes: 5 },
        COMMAND_ID,
      ),
    ).resolves.toEqual(snapshot)
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/journey',
      expect.objectContaining({
        credentials: 'include',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          goalType: 'JOB_SEARCH',
          energyLevel: 'LOW',
          availableMinutes: 5,
          commandId: COMMAND_ID,
        }),
      }),
    )
  })

  it('JourneySnapshot과 TransitionResult의 잘못된 성공 payload를 거부한다', async () => {
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
      .mockResolvedValueOnce(jsonResponse(200, { ...snapshot, version: '2' }))
      .mockResolvedValueOnce(
        jsonResponse(200, { ...transition, transition: { ...transition.transition, reason: 'TOO_BIG' } }),
      )
    const client = new QuestApiClient({ fetchImpl: fetchMock })

    await expect(client.getJourney()).resolves.toEqual(snapshot)
    await expect(client.completeQuest(QUEST_ID, COMMAND_ID, 1)).resolves.toEqual(transition)
    await expect(client.getJourney()).rejects.toBeInstanceOf(ApiContractError)
    await expect(client.completeQuest(QUEST_ID, COMMAND_ID, 1)).rejects.toBeInstanceOf(
      ApiContractError,
    )
  })

  it.each([
    [401, 'SESSION_REQUIRED', null],
    [404, 'JOURNEY_NOT_FOUND', null],
    [400, 'VALIDATION_ERROR', { availableMinutes: '허용된 시간을 선택해 주세요.' }],
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

    await expect(client.getJourney()).rejects.toMatchObject({
      status,
      payload: expect.objectContaining({ code, fieldErrors }),
    })
  })

  it('STALE_JOURNEY 오류는 검증된 최신 snapshot이 있어야 한다', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(409, {
          code: 'STALE_JOURNEY',
          message: '여정이 변경되었습니다.',
          fieldErrors: null,
          snapshot: { ...snapshot, version: 7 },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(409, {
          code: 'STALE_JOURNEY',
          message: '여정이 변경되었습니다.',
          fieldErrors: null,
          snapshot: null,
        }),
      )
    const client = new QuestApiClient({ fetchImpl: fetchMock })

    await expect(client.completeQuest(QUEST_ID, COMMAND_ID, 1)).rejects.toMatchObject({
      status: 409,
      payload: expect.objectContaining({
        code: 'STALE_JOURNEY',
        snapshot: expect.objectContaining({ version: 7 }),
      }),
    })
    await expect(client.completeQuest(QUEST_ID, COMMAND_ID, 1)).rejects.toBeInstanceOf(
      ApiContractError,
    )
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

    const result = client.getJourney().catch((error: unknown) => error)
    await vi.advanceTimersByTimeAsync(25)

    await expect(result).resolves.toMatchObject({ kind: 'timeout' })
  })
})
