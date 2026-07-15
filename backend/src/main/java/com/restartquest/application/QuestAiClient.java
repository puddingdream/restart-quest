package com.restartquest.application;

import com.restartquest.domain.DailyQuest;
import com.restartquest.domain.FailureReason;
import com.restartquest.domain.OnboardingProfile;
import java.util.List;

public interface QuestAiClient {
    List<DailyQuest> generateDailyQuests(OnboardingProfile profile);

    List<DailyQuest> redesignQuest(DailyQuest originalQuest, FailureReason failureReason);
}
