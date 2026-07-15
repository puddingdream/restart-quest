package com.restartquest.application;

import com.restartquest.domain.DailyQuest;
import com.restartquest.domain.FailureReason;
import java.util.NoSuchElementException;

public final class FailQuestService {
    private final RestartQuestStore store;

    public FailQuestService(RestartQuestStore store) {
        this.store = store;
    }

    public DailyQuest fail(String questId, FailureReason reason, String note) {
        DailyQuest quest = store.findQuest(questId)
                .orElseThrow(() -> new NoSuchElementException("Quest not found: " + questId));
        quest.fail(reason, note);
        return store.saveQuest(quest);
    }
}
