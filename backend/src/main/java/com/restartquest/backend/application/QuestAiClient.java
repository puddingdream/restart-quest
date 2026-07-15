package com.restartquest.backend.application;

import com.restartquest.backend.domain.DailyQuest;
import com.restartquest.backend.domain.FailureReason;
import com.restartquest.backend.domain.OnboardingProfile;
import java.time.LocalDate;

public interface QuestAiClient {
    QuestPlan generateDailyQuests(OnboardingProfile profile, LocalDate questDate);

    QuestPlan redesignQuest(
            DailyQuest originalQuest,
            FailureReason failureReason,
            OnboardingProfile profile,
            LocalDate questDate
    );
}
