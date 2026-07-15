package com.restartquest.application;

import com.restartquest.domain.DailyQuest;
import java.util.NoSuchElementException;

public final class CompleteQuestService {
    private final RestartQuestStore store;

    public CompleteQuestService(RestartQuestStore store) {
        this.store = store;
    }

    public DailyQuest complete(String questId) {
        DailyQuest quest = store.findQuest(questId)
                .orElseThrow(() -> new NoSuchElementException("Quest not found: " + questId));
        quest.complete();
        return store.saveQuest(quest);
    }
}
