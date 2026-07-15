import type { DailyQuest, RedesignRecord } from "../../quests/types";

export interface DashboardSummary {
  generatedTotal: number;
  doneCount: number;
  openCount: number;
  redesignedCount: number;
  progressPercent: number;
  nextAction: DailyQuest | null;
  redesignRecords: RedesignRecord[];
}

export function createDashboardSummary(
  quests: DailyQuest[],
  redesignRecords: RedesignRecord[],
): DashboardSummary {
  const generated = quests.filter((quest) => quest.origin === "GENERATED");
  const doneCount = generated.filter((quest) => quest.status === "DONE").length;
  const redesignedCount = generated.filter((quest) => quest.status === "REDESIGNED").length;
  const openCount = generated.filter((quest) => quest.status === "TODO").length;
  const nextAction =
    quests.find((quest) => quest.origin === "REDESIGNED" && quest.status === "TODO") ??
    generated.find((quest) => quest.status === "TODO") ??
    null;

  return {
    generatedTotal: generated.length,
    doneCount,
    openCount,
    redesignedCount,
    progressPercent: generated.length === 0 ? 0 : Math.round((doneCount / generated.length) * 100),
    nextAction,
    redesignRecords,
  };
}
