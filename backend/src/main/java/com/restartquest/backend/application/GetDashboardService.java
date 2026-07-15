package com.restartquest.backend.application;

import com.restartquest.backend.application.DashboardSummary.QuestSnapshot;
import com.restartquest.backend.application.DashboardSummary.RedesignHistory;
import com.restartquest.backend.domain.DailyQuest;
import com.restartquest.backend.domain.QuestFailureRecord;
import com.restartquest.backend.domain.QuestRedesignRecord;
import com.restartquest.backend.domain.QuestStatus;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

public final class GetDashboardService {
    private final RestartQuestStore store;
    private final ClockProvider clockProvider;

    public GetDashboardService(RestartQuestStore store, ClockProvider clockProvider) {
        this.store = Objects.requireNonNull(store, "store");
        this.clockProvider = Objects.requireNonNull(clockProvider, "clockProvider");
    }

    public DashboardSummary getToday() {
        LocalDate questDate = clockProvider.today();
        List<DailyQuest> quests = store.findQuestsByDate(questDate);
        List<DailyQuest> originals = quests.stream().filter(DailyQuest::isOriginalQuest).toList();
        List<DailyQuest> redesigns = quests.stream().filter(quest -> !quest.isOriginalQuest()).toList();
        List<QuestFailureRecord> failures = store.findFailuresByDate(questDate);
        List<QuestRedesignRecord> redesignRecords = store.findRedesignsByDate(questDate);

        int doneCount = (int) originals.stream().filter(quest -> quest.status() == QuestStatus.DONE).count();
        int progressPercent = originals.isEmpty() ? 0 : (doneCount * 100) / originals.size();

        return new DashboardSummary(
                questDate,
                originals.size(),
                doneCount,
                failures.size(),
                redesigns.size(),
                progressPercent,
                findNextAction(quests, redesignRecords),
                buildHistory(quests, failures, redesignRecords)
        );
    }

    private static QuestSnapshot findNextAction(List<DailyQuest> quests, List<QuestRedesignRecord> redesignRecords) {
        List<QuestRedesignRecord> newestFirst = redesignRecords.stream()
                .sorted(Comparator.comparing(QuestRedesignRecord::createdAt).reversed())
                .toList();
        for (QuestRedesignRecord redesign : newestFirst) {
            Set<String> redesignedIds = new HashSet<>(redesign.redesignedQuestIds());
            DailyQuest nextRedesigned = quests.stream()
                    .filter(quest -> redesignedIds.contains(quest.id()))
                    .filter(quest -> quest.status() == QuestStatus.TODO)
                    .sorted(Comparator.comparingInt(DailyQuest::sortOrder).thenComparing(DailyQuest::createdAt))
                    .findFirst()
                    .orElse(null);
            if (nextRedesigned != null) {
                return snapshot(nextRedesigned);
            }
        }

        return quests.stream()
                .filter(DailyQuest::isOriginalQuest)
                .filter(quest -> quest.status() == QuestStatus.TODO)
                .sorted(Comparator.comparingInt(DailyQuest::sortOrder).thenComparing(DailyQuest::createdAt))
                .findFirst()
                .map(GetDashboardService::snapshot)
                .orElse(null);
    }

    private static List<RedesignHistory> buildHistory(
            List<DailyQuest> quests,
            List<QuestFailureRecord> failures,
            List<QuestRedesignRecord> redesignRecords
    ) {
        List<RedesignHistory> history = new ArrayList<>();
        for (QuestRedesignRecord redesign : redesignRecords) {
            DailyQuest original = findQuest(quests, redesign.originalQuestId());
            QuestFailureRecord failure = failures.stream()
                    .filter(item -> item.id().equals(redesign.failureRecordId()))
                    .findFirst()
                    .orElse(null);
            if (original == null || failure == null) {
                continue;
            }
            Set<String> childIds = new HashSet<>(redesign.redesignedQuestIds());
            List<QuestSnapshot> children = quests.stream()
                    .filter(quest -> childIds.contains(quest.id()))
                    .sorted(Comparator.comparingInt(DailyQuest::sortOrder).thenComparing(DailyQuest::createdAt))
                    .map(GetDashboardService::snapshot)
                    .toList();
            history.add(new RedesignHistory(
                    original.id(),
                    original.title(),
                    failure.reason(),
                    redesign.strategySummary(),
                    children,
                    redesign.createdAt()
            ));
        }
        history.sort(Comparator.comparing(RedesignHistory::createdAt).reversed());
        return history;
    }

    private static DailyQuest findQuest(List<DailyQuest> quests, String questId) {
        return quests.stream()
                .filter(quest -> quest.id().equals(questId))
                .findFirst()
                .orElse(null);
    }

    private static QuestSnapshot snapshot(DailyQuest quest) {
        return new QuestSnapshot(
                quest.id(),
                quest.parentQuestId(),
                quest.title(),
                quest.description(),
                quest.category(),
                quest.difficulty(),
                quest.estimatedMinutes(),
                quest.completionCriteria()
        );
    }
}
