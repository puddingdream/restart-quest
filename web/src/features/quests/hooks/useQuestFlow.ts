import { useState } from "react";
import { OnboardingProfile } from "../../onboarding/types";
import { generateDailyQuests, redesignQuest as redesignQuestMock } from "../services/mockQuestService";
import {
  DailyQuest,
  FailureSubmission,
  RedesignHistoryItem,
} from "../types";

export function useQuestFlow() {
  const [profile, setProfile] = useState<OnboardingProfile | null>(null);
  const [quests, setQuests] = useState<DailyQuest[]>([]);
  const [redesignedQuests, setRedesignedQuests] = useState<DailyQuest[]>([]);
  const [redesignHistory, setRedesignHistory] = useState<RedesignHistoryItem[]>([]);

  function saveProfile(nextProfile: OnboardingProfile) {
    setProfile(nextProfile);
    setQuests([]);
    setRedesignedQuests([]);
    setRedesignHistory([]);
  }

  function generateQuests() {
    if (!profile) {
      return;
    }

    const response = generateDailyQuests(profile);
    setQuests(
      response.quests.map((quest, index) => ({
        ...quest,
        id: `quest-${index + 1}`,
        status: "TODO",
      })),
    );
    setRedesignedQuests([]);
    setRedesignHistory([]);
  }

  function completeQuest(questId: string) {
    setQuests((current) =>
      current.map((quest) =>
        quest.id === questId && quest.status === "TODO"
          ? { ...quest, status: "DONE" }
          : quest,
      ),
    );
    setRedesignedQuests((current) =>
      current.map((quest) =>
        quest.id === questId && quest.status === "TODO"
          ? { ...quest, status: "DONE" }
          : quest,
      ),
    );
  }

  function redesignQuest(questId: string, submission: FailureSubmission) {
    const originalQuest = quests.find((quest) => quest.id === questId);
    if (!originalQuest) {
      return;
    }

    const failedQuest: DailyQuest = {
      ...originalQuest,
      status: "REDESIGNED",
      failureReason: submission.reason,
      failureNote: submission.note.trim(),
    };
    const response = redesignQuestMock(failedQuest, submission.reason);
    const nextRedesignedQuests = response.quests.map((quest, index) => ({
      ...quest,
      id: `${response.originalQuestId}-redesign-${index + 1}`,
      sourceQuestId: response.originalQuestId,
      status: "TODO" as const,
    }));

    setQuests((current) =>
      current.map((quest) => (quest.id === questId ? failedQuest : quest)),
    );
    setRedesignedQuests((current) => [
      ...current.filter((quest) => quest.sourceQuestId !== questId),
      ...nextRedesignedQuests,
    ]);
    setRedesignHistory((current) => [
      {
        originalQuestId: questId,
        originalTitle: originalQuest.title,
        reason: submission.reason,
        redesignedTitles: nextRedesignedQuests.map((quest) => quest.title),
        createdAt: new Date().toISOString(),
      },
      ...current.filter((item) => item.originalQuestId !== questId),
    ]);
  }

  return {
    completeQuest,
    generateQuests,
    profile,
    quests,
    redesignHistory,
    redesignedQuests,
    redesignQuest,
    saveProfile,
  };
}
