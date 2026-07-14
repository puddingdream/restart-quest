package com.restartquest.backend.application;

import com.restartquest.backend.domain.DailyQuestSet;
import com.restartquest.backend.domain.DailyQuestSetStatus;
import com.restartquest.backend.domain.DashboardSnapshot;
import com.restartquest.backend.domain.OnboardingProfile;
import com.restartquest.backend.domain.Quest;
import com.restartquest.backend.domain.QuestFailure;
import com.restartquest.backend.domain.QuestFailureReason;
import com.restartquest.backend.domain.QuestRedesign;
import com.restartquest.backend.domain.QuestStatus;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

public final class DailyQuestOrchestrator {
    private final QuestPlanner questPlanner;
    private final IdGenerator idGenerator;

    public DailyQuestOrchestrator(QuestPlanner questPlanner, IdGenerator idGenerator) {
        this.questPlanner = Objects.requireNonNull(questPlanner, "questPlanner");
        this.idGenerator = Objects.requireNonNull(idGenerator, "idGenerator");
    }

    public DailyQuestSet generateToday(OnboardingProfile profile, LocalDate questDate, LocalDateTime now) {
        Objects.requireNonNull(profile, "profile");
        Objects.requireNonNull(questDate, "questDate");
        Objects.requireNonNull(now, "now");

        String questSetId = idGenerator.nextId("daily-quest-set");
        List<Quest> quests = questPlanner.planDailyQuests(profile, questSetId, questDate, now);
        if (quests.size() != 3) {
            throw new IllegalStateException("daily quest planner must return exactly 3 quests");
        }

        return new DailyQuestSet(
                questSetId,
                profile.userId(),
                questDate,
                profile.defaultEnergyLevel(),
                DailyQuestSetStatus.ACTIVE,
                quests,
                now,
                now
        );
    }

    public DailyQuestSet completeQuest(DailyQuestSet questSet, String questId, LocalDateTime now) {
        Quest target = questSet.findQuest(questId);
        return questSet.replaceQuest(target.complete(now), now);
    }

    public QuestFailureRedesignResult failAndRedesign(
            DailyQuestSet questSet,
            String questId,
            QuestFailureReason reason,
            String memo,
            OnboardingProfile profile,
            LocalDateTime now
    ) {
        Objects.requireNonNull(reason, "reason");
        Objects.requireNonNull(profile, "profile");
        Objects.requireNonNull(now, "now");

        Quest original = questSet.findQuest(questId);
        Quest failedQuest = original.fail();
        DailyQuestSet withFailure = questSet.replaceQuest(failedQuest, now);
        QuestFailure failure = new QuestFailure(idGenerator.nextId("quest-failure"), questId, questSet.userId(), reason, memo, now);

        List<Quest> redesignedQuests = questPlanner.redesignQuest(failedQuest, failure, profile, questSet.id(), now);
        if (redesignedQuests.isEmpty() || redesignedQuests.size() > 3) {
            throw new IllegalStateException("redesign planner must return 1 to 3 quests");
        }
        for (Quest redesignedQuest : redesignedQuests) {
            if (!Objects.equals(redesignedQuest.parentQuestId(), failedQuest.id())) {
                throw new IllegalStateException("redesigned quest must keep original quest as parent");
            }
            if (!redesignedQuest.difficulty().isNoHarderThan(failedQuest.difficulty())) {
                throw new IllegalStateException("redesigned quest must not be harder than original quest");
            }
        }

        List<Quest> merged = new ArrayList<>(withFailure.quests());
        merged.addAll(redesignedQuests);
        DailyQuestSet redesignedSet = withFailure.withQuests(merged, now);
        QuestRedesign redesign = new QuestRedesign(
                idGenerator.nextId("quest-redesign"),
                failedQuest.id(),
                failure.id(),
                redesignedQuests.stream().map(Quest::id).toList(),
                reason.defaultStrategySummary(),
                now
        );

        return new QuestFailureRedesignResult(redesignedSet, failedQuest, failure, redesign, redesignedQuests);
    }

    public DashboardSnapshot summarize(
            DailyQuestSet questSet,
            List<QuestFailure> failures,
            List<QuestRedesign> redesigns
    ) {
        Objects.requireNonNull(questSet, "questSet");
        List<QuestFailure> safeFailures = List.copyOf(Objects.requireNonNullElse(failures, List.of()));
        List<QuestRedesign> safeRedesigns = List.copyOf(Objects.requireNonNullElse(redesigns, List.of()));

        long done = questSet.quests().stream().filter(quest -> quest.status() == QuestStatus.DONE).count();
        long failed = questSet.quests().stream().filter(quest -> quest.status() == QuestStatus.FAILED).count();
        long redesigned = questSet.quests().stream().filter(quest -> quest.parentQuestId() != null).count();
        String nextQuestId = questSet.quests().stream()
                .filter(quest -> quest.status() == QuestStatus.TODO)
                .sorted(Comparator.comparingInt(Quest::sortOrder).thenComparing(Quest::createdAt))
                .map(Quest::id)
                .findFirst()
                .orElse(null);

        List<DashboardSnapshot.RecentEvent> events = new ArrayList<>();
        for (QuestFailure failure : safeFailures) {
            events.add(new DashboardSnapshot.RecentEvent("QUEST_FAILED", failure.questId(), failure.reason().name(), failure.createdAt()));
        }
        for (QuestRedesign redesign : safeRedesigns) {
            events.add(new DashboardSnapshot.RecentEvent("QUEST_REDESIGNED", redesign.originalQuestId(), redesign.strategySummary(), redesign.createdAt()));
        }
        events.sort(Comparator.comparing(DashboardSnapshot.RecentEvent::createdAt));

        return new DashboardSnapshot(
                questSet.userId(),
                questSet.questDate(),
                questSet.quests().size(),
                (int) done,
                (int) failed,
                (int) redesigned,
                nextQuestId,
                events
        );
    }
}
