package com.restartquest.backend.application;

import com.restartquest.backend.domain.DailyQuest;
import com.restartquest.backend.domain.FailureReason;
import com.restartquest.backend.domain.QuestFailureRecord;
import java.util.Objects;

public final class FailQuestService {
    private final RestartQuestStore store;
    private final IdGenerator idGenerator;
    private final ClockProvider clockProvider;

    public FailQuestService(RestartQuestStore store, IdGenerator idGenerator, ClockProvider clockProvider) {
        this.store = Objects.requireNonNull(store, "store");
        this.idGenerator = Objects.requireNonNull(idGenerator, "idGenerator");
        this.clockProvider = Objects.requireNonNull(clockProvider, "clockProvider");
    }

    public FailureOutcome fail(String questId, FailureReason reason, String note) {
        Objects.requireNonNull(reason, "reason");
        DailyQuest quest = store.findQuest(questId)
                .orElseThrow(() -> new IllegalArgumentException("quest not found: " + questId));
        DailyQuest failed = quest.fail();
        QuestFailureRecord failure = new QuestFailureRecord(
                idGenerator.nextId("failure"),
                questId,
                reason,
                note,
                clockProvider.now()
        );
        store.saveQuest(failed);
        store.saveFailure(failure);
        return new FailureOutcome(failed, failure);
    }

    public record FailureOutcome(DailyQuest quest, QuestFailureRecord failure) {
    }
}
