package com.restartquest.application;

import com.restartquest.domain.DailyQuest;
import com.restartquest.domain.OnboardingProfile;
import java.util.List;

public final class GenerateDailyQuestService {
    private final RestartQuestStore store;
    private final QuestAiClient questAiClient;

    public GenerateDailyQuestService(RestartQuestStore store, QuestAiClient questAiClient) {
        this.store = store;
        this.questAiClient = questAiClient;
    }

    public List<DailyQuest> generateForToday() {
        OnboardingProfile profile = store.findProfile()
                .orElseThrow(() -> new IllegalStateException("Onboarding profile is required first"));
        List<DailyQuest> quests = questAiClient.generateDailyQuests(profile);
        QuestOutputValidator.validateGeneratedQuests(quests);
        return store.replaceTodayQuests(quests);
    }
}
