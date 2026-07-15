package com.restartquest.backend.application;

import com.restartquest.backend.domain.DailyQuest;
import java.util.Objects;

public final class CompleteQuestService {
    private final RestartQuestStore store;
    private final ClockProvider clockProvider;

    public CompleteQuestService(RestartQuestStore store, ClockProvider clockProvider) {
        this.store = Objects.requireNonNull(store, "store");
        this.clockProvider = Objects.requireNonNull(clockProvider, "clockProvider");
    }

    public DailyQuest complete(String questId) {
        DailyQuest quest = store.findQuest(questId)
                .orElseThrow(() -> new IllegalArgumentException("quest not found: " + questId));
        DailyQuest completed = quest.complete(clockProvider.now());
        store.saveQuest(completed);
        return completed;
    }
}
