import assert from 'node:assert/strict'
import test from 'node:test'
import {
  QUEST_QUERY_KEYS,
  refreshQuestOutcomeQueries,
  registerQueryRefresher,
} from './queryRefresh'

test('퀘스트 결과 변경은 today와 dashboard query를 함께 갱신한다', async () => {
  const refreshed: string[] = []
  const unregisterToday = registerQueryRefresher(
    QUEST_QUERY_KEYS.today,
    () => {
      refreshed.push('today')
    },
  )
  const unregisterDashboard = registerQueryRefresher(
    QUEST_QUERY_KEYS.dashboard,
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
  const unregisterToday = registerQueryRefresher(QUEST_QUERY_KEYS.today, () => {
    throw new Error('today refresh error')
  })
  const unregisterDashboard = registerQueryRefresher(
    QUEST_QUERY_KEYS.dashboard,
    () => {
      dashboardRefreshCount += 1
    },
  )

  await refreshQuestOutcomeQueries()
  unregisterToday()
  unregisterDashboard()

  assert.equal(dashboardRefreshCount, 1)
})
