package com.restartquest.backend.infrastructure;

import com.restartquest.backend.application.IdGenerator;
import com.restartquest.backend.application.QuestPlanner;
import com.restartquest.backend.domain.OnboardingProfile;
import com.restartquest.backend.domain.Quest;
import com.restartquest.backend.domain.QuestFailure;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;

public final class FallbackQuestPlanner implements QuestPlanner {
    private final FallbackDailyQuestFactory dailyQuestFactory;
    private final FallbackRedesignQuestFactory redesignQuestFactory;

    public FallbackQuestPlanner(IdGenerator idGenerator) {
        Objects.requireNonNull(idGenerator, "idGenerator");
        this.dailyQuestFactory = new FallbackDailyQuestFactory(idGenerator);
        this.redesignQuestFactory = new FallbackRedesignQuestFactory(idGenerator);
    }

    @Override
    public List<Quest> planDailyQuests(
            OnboardingProfile profile,
            String dailyQuestSetId,
            LocalDate questDate,
            LocalDateTime now
    ) {
        return dailyQuestFactory.planDailyQuests(profile, dailyQuestSetId, questDate, now);
    }

    @Override
    public List<Quest> redesignQuest(
            Quest originalQuest,
            QuestFailure failure,
            OnboardingProfile profile,
            String dailyQuestSetId,
            LocalDateTime now
    ) {
        return redesignQuestFactory.redesignQuest(originalQuest, failure, profile, dailyQuestSetId, now);
    }
}
