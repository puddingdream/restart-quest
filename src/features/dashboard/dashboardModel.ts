import type { AppState, DashboardSummary, Quest } from "../../shared/types.js";
import { todayKey } from "../quests/questFlow.js";

export function buildDashboardSummary(state: AppState, now = new Date()): DashboardSummary {
  const questDate = todayKey(now);
  const todaysQuests = state.quests.filter((quest) => quest.questDate === questDate);
  const failedOriginalIds = new Set(state.failures.map((failure) => failure.questId));
  const activeTodos = todaysQuests
    .filter((quest) => quest.status === "TODO")
    .sort(bySmallestNextAction);

  return {
    totalQuests: todaysQuests.filter((quest) => !quest.parentQuestId).length,
    doneQuests: todaysQuests.filter((quest) => quest.status === "DONE").length,
    failedQuests: todaysQuests.filter((quest) => failedOriginalIds.has(quest.id)).length,
    redesignedQuests: todaysQuests.filter((quest) => Boolean(quest.parentQuestId)).length,
    nextQuest: activeTodos[0],
    recentFailures: state.failures
      .slice()
      .reverse()
      .map((failure) => ({
        failure,
        original: state.quests.find((quest) => quest.id === failure.questId),
        redesigned: failure.redesignedQuestIds
          .map((questId) => state.quests.find((quest) => quest.id === questId))
          .filter((quest): quest is Quest => Boolean(quest))
      }))
  };
}

function bySmallestNextAction(left: Quest, right: Quest): number {
  if (left.estimatedMinutes !== right.estimatedMinutes) {
    return left.estimatedMinutes - right.estimatedMinutes;
  }

  return left.sortOrder - right.sortOrder;
}
