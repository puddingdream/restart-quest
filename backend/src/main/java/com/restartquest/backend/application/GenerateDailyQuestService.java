package com.restartquest.backend.application;

import com.restartquest.backend.domain.DailyQuest;
import com.restartquest.backend.domain.OnboardingProfile;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

public final class GenerateDailyQuestService {
    private final RestartQuestStore store;
    private final QuestAiClient questAiClient;
    private final IdGenerator idGenerator;
    private final ClockProvider clockProvider;

    public GenerateDailyQuestService(
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

    public List<DailyQuest> generateToday() {
        OnboardingProfile profile = store.findProfile()
                .orElseThrow(() -> new IllegalStateException("onboarding profile is required before quest generation"));
        LocalDate questDate = clockProvider.today();
        LocalDateTime now = clockProvider.now();
        QuestPlan plan = questAiClient.generateDailyQuests(profile, questDate);
        if (plan.quests().size() != 3) {
            throw new IllegalStateException("daily quest mock must return exactly 3 quests");
        }

        List<DailyQuest> quests = new ArrayList<>();
        int sortOrder = 1;
        for (QuestDraft draft : plan.quests()) {
            quests.add(draft.toQuest(
                    idGenerator.nextId("quest"),
                    null,
                    questDate,
                    sortOrder,
                    now
            ));
            sortOrder++;
        }
        store.replaceQuestsForDate(questDate, quests);
        return quests;
    }
}
