package com.restartquest.backend.application;

import com.restartquest.backend.domain.DailyQuest;
import com.restartquest.backend.domain.FailureReason;
import com.restartquest.backend.domain.OnboardingProfile;
import com.restartquest.backend.domain.QuestFailureRecord;
import com.restartquest.backend.domain.QuestRedesignRecord;
import com.restartquest.backend.domain.QuestStatus;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

public final class RedesignQuestService {
    private final RestartQuestStore store;
    private final QuestAiClient questAiClient;
    private final IdGenerator idGenerator;
    private final ClockProvider clockProvider;

    public RedesignQuestService(
            RestartQuestStore store,
            QuestAiClient questAiClient,
            IdGenerator idGenerator,
            ClockProvider clockProvider
    ) {
        this.store = Objects.requireNonNull(store, "store");
        this.questAiClient = Objects.requireNonNull(questAiClient, "questAiClient");
        this.idGenerator = Objects.requireNonNull(idGenerator, "idGenerator");
        this.clockProvider = Objects.requireNonNull(clockProvider, "clockProvider");
    }

    public RedesignOutcome redesign(String questId, FailureReason reason, String note) {
        Objects.requireNonNull(reason, "reason");
        OnboardingProfile profile = store.findProfile()
                .orElseThrow(() -> new IllegalStateException("onboarding profile is required before quest redesign"));
        DailyQuest original = store.findQuest(questId)
                .orElseThrow(() -> new IllegalArgumentException("quest not found: " + questId));
        if (original.status() == QuestStatus.DONE || original.status() == QuestStatus.REDESIGNED) {
            throw new IllegalStateException("only TODO or FAILED quest can be redesigned");
        }

        LocalDate questDate = clockProvider.today();
        LocalDateTime now = clockProvider.now();
        DailyQuest failed = original.status() == QuestStatus.TODO ? original.fail() : original;
        QuestFailureRecord failure = store.findLatestFailureForQuest(questId)
                .filter(item -> item.reason() == reason)
                .orElseGet(() -> {
                    QuestFailureRecord created = new QuestFailureRecord(
                            idGenerator.nextId("failure"),
                            questId,
                            reason,
                            note,
                            now
                    );
                    store.saveFailure(created);
                    return created;
                });

        QuestPlan plan = questAiClient.redesignQuest(failed, reason, profile, questDate);
        if (plan.quests().isEmpty() || plan.quests().size() > 3) {
            throw new IllegalStateException("redesign mock must return 1 to 3 quests");
        }

        List<DailyQuest> redesignedQuests = new ArrayList<>();
        int sortOrder = failed.sortOrder() * 10 + 1;
        for (QuestDraft draft : plan.quests()) {
            DailyQuest redesigned = draft.toQuest(
                    idGenerator.nextId("quest"),
                    failed.id(),
                    questDate,
                    sortOrder,
                    now
            );
            if (!redesigned.isEasierThan(failed)) {
                throw new IllegalStateException("redesigned quest must be easier and shorter than the original quest");
            }
            redesignedQuests.add(redesigned);
            sortOrder++;
        }

        DailyQuest redesignedOriginal = failed.markRedesigned();
        QuestRedesignRecord redesign = new QuestRedesignRecord(
                idGenerator.nextId("redesign"),
                failed.id(),
                failure.id(),
                redesignedQuests.stream().map(DailyQuest::id).toList(),
                reason.redesignStrategy(),
                now
        );
        store.saveQuest(redesignedOriginal);
        store.saveQuests(redesignedQuests);
        store.saveRedesign(redesign);
        return new RedesignOutcome(redesignedOriginal, failure, redesign, redesignedQuests);
    }

    public record RedesignOutcome(
            DailyQuest originalQuest,
            QuestFailureRecord failure,
            QuestRedesignRecord redesign,
            List<DailyQuest> redesignedQuests
    ) {
        public RedesignOutcome {
            redesignedQuests = List.copyOf(redesignedQuests);
        }
    }
}
