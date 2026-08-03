export const QUEST_OUTCOME_QUERY_KEYS = {
  today: 'quests/today',
  dashboard: 'dashboard/today',
} as const

type QuestOutcomeQueryKey =
  (typeof QUEST_OUTCOME_QUERY_KEYS)[keyof typeof QUEST_OUTCOME_QUERY_KEYS]
type QueryRefresher = () => void | Promise<void>

const refreshers = new Map<QuestOutcomeQueryKey, Set<QueryRefresher>>()

export function registerQuestOutcomeQueryRefresher(
  queryKey: QuestOutcomeQueryKey,
  refresher: QueryRefresher,
): () => void {
  const queryRefreshers = refreshers.get(queryKey) ?? new Set<QueryRefresher>()
  queryRefreshers.add(refresher)
  refreshers.set(queryKey, queryRefreshers)

  return () => {
    queryRefreshers.delete(refresher)
    if (queryRefreshers.size === 0) refreshers.delete(queryKey)
  }
}

export async function refreshQuestOutcomeQueries(): Promise<void> {
  const callbacks = [
    ...(refreshers.get(QUEST_OUTCOME_QUERY_KEYS.today) ?? []),
    ...(refreshers.get(QUEST_OUTCOME_QUERY_KEYS.dashboard) ?? []),
  ]

  await Promise.allSettled(
    callbacks.map((callback) => Promise.resolve().then(callback)),
  )
}
