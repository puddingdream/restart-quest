package com.restartquest.backend.application;

import com.restartquest.backend.domain.OnboardingProfile;
import com.restartquest.backend.domain.Quest;
import com.restartquest.backend.domain.QuestFailure;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public interface QuestPlanner {
    List<Quest> planDailyQuests(OnboardingProfile profile, String dailyQuestSetId, LocalDate questDate, LocalDateTime now);

    List<Quest> redesignQuest(
            Quest originalQuest,
            QuestFailure failure,
            OnboardingProfile profile,
            String dailyQuestSetId,
            LocalDateTime now
    );
}
