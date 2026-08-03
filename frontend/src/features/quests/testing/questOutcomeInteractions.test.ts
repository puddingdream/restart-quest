import assert from 'node:assert/strict'
import test from 'node:test'
import { ApiError } from '../../../shared/api/ApiError'
import {
  questOutcomeMockApi,
  queueMockQuestOutcomeAiError,
} from '../api/questOutcomeMockApi'
import {
  QUEST_OUTCOME_QUERY_KEYS,
  refreshQuestOutcomeQueries,
  registerQuestOutcomeQueryRefresher,
} from '../questOutcomeQueryRefresh'
import type { DailyQuestResponse, RedesignQuestRequest } from '../types'
import {
  createOutcomeSession,
  installOutcomeTestWindow,
  readStoredPlan,
} from './questOutcomeTestSupport.test'

export function registerQuestOutcomeInteractionTests(
  plan: DailyQuestResponse,
): void {
  installOutcomeTestWindow()

  test('feature mock 완료는 같은 여정만 갱신하고 중복 요청을 거절한다', async () => {
    const { accessToken, storedPlan } = await createOutcomeSession(
      'complete-outcome@example.com',
      plan,
    )
    const questId = storedPlan.journeys[0].currentQuest.id
    const results = await Promise.allSettled([
      questOutcomeMockApi.complete(questId, accessToken),
      questOutcomeMockApi.complete(questId, accessToken),
    ])

    assert.equal(
      results.filter(({ status }) => status === 'fulfilled').length,
      1,
    )
    const rejected = results.find(({ status }) => status === 'rejected')
    assert.ok(rejected?.status === 'rejected')
    assert.ok(rejected.reason instanceof ApiError)
    assert.equal(rejected.reason.code, 'QUEST_ALREADY_RESOLVED')
    assert.equal(readStoredPlan().journeys[0].status, 'COMPLETED')
    assert.equal(readStoredPlan().journeys[0].currentQuest.status, 'DONE')
  })

  test('feature mock 재설계는 currentQuest와 기록을 교체하고 입력을 검증한다', async () => {
    const { accessToken, storedPlan } = await createOutcomeSession(
      'redesign-outcome@example.com',
      plan,
    )
    const original = storedPlan.journeys[1].currentQuest
    const response = await questOutcomeMockApi.redesign(
      original.id,
      {
        reasonCode: 'TASK_TOO_LARGE',
        reasonNote: '  첫 단계부터 시작하고 싶어요.  ',
      },
      accessToken,
    )

    assert.notEqual(response.journey.currentQuest.id, original.id)
    assert.equal(response.journey.history[0].status, 'REDESIGNED')
    assert.equal(response.journey.history.length, 1)
    assert.equal(response.redesign.reasonNote, '첫 단계부터 시작하고 싶어요.')
    assert.equal(
      readStoredPlan().journeys[1].currentQuest.id,
      response.journey.currentQuest.id,
    )

    const nextQuestId = storedPlan.journeys[2].currentQuest.id
    await assert.rejects(
      questOutcomeMockApi.redesign(
        nextQuestId,
        {
          reasonCode: 'UNKNOWN',
          reasonNote: '가'.repeat(301),
        } as unknown as RedesignQuestRequest,
        accessToken,
      ),
      (error: unknown) =>
        error instanceof ApiError &&
        error.code === 'VALIDATION_ERROR' &&
        error.fieldErrors.some(({ field }) => field === 'reasonCode') &&
        error.fieldErrors.some(({ field }) => field === 'reasonNote'),
    )
  })

  test('feature mock 재설계 오류는 계획을 유지하고 같은 입력으로 재시도된다', async () => {
    const { accessToken, storedPlan } = await createOutcomeSession(
      'retry-outcome@example.com',
      plan,
    )
    const original = storedPlan.journeys[2].currentQuest
    const input = {
      reasonCode: 'LOW_ENERGY' as const,
      reasonNote: '첫 단계면 시작할 수 있어요.',
    }
    queueMockQuestOutcomeAiError('AI_PROVIDER_TIMEOUT')

    await assert.rejects(
      questOutcomeMockApi.redesign(original.id, input, accessToken),
      (error: unknown) =>
        error instanceof ApiError && error.code === 'AI_PROVIDER_TIMEOUT',
    )
    assert.equal(readStoredPlan().journeys[2].currentQuest.id, original.id)

    const retried = await questOutcomeMockApi.redesign(
      original.id,
      input,
      accessToken,
    )
    assert.equal(retried.redesign.reasonCode, input.reasonCode)
    assert.equal(retried.redesign.reasonNote, input.reasonNote)
  })

  test('완료·재설계 결과는 today와 dashboard query를 함께 갱신한다', async () => {
    const refreshed: string[] = []
    const unregisterToday = registerQuestOutcomeQueryRefresher(
      QUEST_OUTCOME_QUERY_KEYS.today,
      () => {
        refreshed.push('today')
      },
    )
    const unregisterDashboard = registerQuestOutcomeQueryRefresher(
      QUEST_OUTCOME_QUERY_KEYS.dashboard,
      async () => {
        refreshed.push('dashboard')
      },
    )

    await refreshQuestOutcomeQueries()
    unregisterToday()
    unregisterDashboard()

    assert.deepEqual(refreshed.sort(), ['dashboard', 'today'])
  })

  test('query 하나의 갱신 실패가 다른 query 갱신을 막지 않는다', async () => {
    let dashboardRefreshCount = 0
    const unregisterToday = registerQuestOutcomeQueryRefresher(
      QUEST_OUTCOME_QUERY_KEYS.today,
      () => {
        throw new Error('today refresh error')
      },
    )
    const unregisterDashboard = registerQuestOutcomeQueryRefresher(
      QUEST_OUTCOME_QUERY_KEYS.dashboard,
      () => {
        dashboardRefreshCount += 1
      },
    )

    await refreshQuestOutcomeQueries()
    unregisterToday()
    unregisterDashboard()

    assert.equal(dashboardRefreshCount, 1)
  })
}
