import {
  DailyQuest,
  RedesignHistoryItem,
} from "../quests/types";

export type DashboardSummary = {
  totalOriginalQuests: number;
  completedOriginalQuests: number;
  completedRedesignedQuests: number;
  redesignedOriginalQuests: number;
  progressPercent: number;
  nextAction: DailyQuest | null;
  redesignHistory: RedesignHistoryItem[];
};

export function buildDashboardSummary(
  quests: DailyQuest[],
  redesignedQuests: DailyQuest[],
  redesignHistory: RedesignHistoryItem[],
): DashboardSummary {
  const completedOriginalQuests = quests.filter((quest) => quest.status === "DONE").length;
  const completedRedesignedQuests = redesignedQuests.filter(
    (quest) => quest.status === "DONE",
  ).length;
  const redesignedOriginalQuests = quests.filter(
    (quest) => quest.status === "REDESIGNED",
  ).length;
  const nextAction =
    redesignedQuests.find((quest) => quest.status === "TODO") ??
    quests.find((quest) => quest.status === "TODO") ??
    null;
  const progressPercent =
    quests.length === 0 ? 0 : Math.round((completedOriginalQuests / quests.length) * 100);

  return {
    completedOriginalQuests,
    completedRedesignedQuests,
    nextAction,
    progressPercent,
    redesignedOriginalQuests,
    redesignHistory,
    totalOriginalQuests: quests.length,
  };
}
