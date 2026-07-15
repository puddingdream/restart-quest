package com.restartquest.application;

import com.restartquest.domain.DailyQuest;
import com.restartquest.domain.QuestStatus;
import java.util.Comparator;
import java.util.List;

public final class GetDashboardService {
    private final RestartQuestStore store;

    public GetDashboardService(RestartQuestStore store) {
        this.store = store;
    }

    public DashboardSummary getTodaySummary() {
        List<DailyQuest> quests = store.findTodayQuests();
        List<DailyQuest> originalQuests = quests.stream()
                .filter(DailyQuest::isOriginal)
                .toList();
        List<DailyQuest> redesignedQuests = quests.stream()
                .filter(quest -> !quest.isOriginal())
                .toList();

        int doneCount = (int) originalQuests.stream()
                .filter(quest -> quest.status() == QuestStatus.DONE)
                .count();
        int failedCount = (int) originalQuests.stream()
                .filter(quest -> quest.failureReason() != null)
                .count();
        double completionRate = originalQuests.isEmpty() ? 0.0 : (double) doneCount / originalQuests.size();

        DailyQuest nextAction = redesignedQuests.stream()
                .filter(quest -> quest.status() == QuestStatus.TODO)
                .findFirst()
                .or(() -> originalQuests.stream().filter(quest -> quest.status() == QuestStatus.TODO).findFirst())
                .orElse(null);

        List<RedesignHistoryItem> redesignHistory = originalQuests.stream()
                .filter(quest -> quest.status() == QuestStatus.REDESIGNED)
                .sorted(Comparator.comparing(DailyQuest::id))
                .map(quest -> new RedesignHistoryItem(
                        quest.id(),
                        quest.title(),
                        quest.failureReason(),
                        redesignedQuests.stream()
                                .filter(redesign -> quest.id().equals(redesign.parentQuestId()))
                                .toList()
                ))
                .toList();

        return new DashboardSummary(
                originalQuests.size(),
                doneCount,
                failedCount,
                redesignedQuests.size(),
                completionRate,
                nextAction,
                redesignHistory
        );
    }
}
