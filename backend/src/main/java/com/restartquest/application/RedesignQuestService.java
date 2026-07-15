package com.restartquest.application;

import com.restartquest.domain.DailyQuest;
import com.restartquest.domain.FailureReason;
import java.util.List;
import java.util.NoSuchElementException;

public final class RedesignQuestService {
    private final RestartQuestStore store;
    private final QuestAiClient questAiClient;

    public RedesignQuestService(RestartQuestStore store, QuestAiClient questAiClient) {
        this.store = store;
        this.questAiClient = questAiClient;
    }

    public RedesignResult redesign(String questId, FailureReason reason) {
        DailyQuest originalQuest = store.findQuest(questId)
                .orElseThrow(() -> new NoSuchElementException("Quest not found: " + questId));
        originalQuest.markRedesigned(reason, originalQuest.failureNote());
        List<DailyQuest> redesignedQuests = questAiClient.redesignQuest(originalQuest, reason);
        QuestOutputValidator.validateRedesignedQuests(originalQuest, redesignedQuests);
        store.saveQuest(originalQuest);
        List<DailyQuest> savedRedesigns = store.replaceRedesignedQuests(originalQuest.id(), redesignedQuests);
        return new RedesignResult(originalQuest, savedRedesigns);
    }
}
