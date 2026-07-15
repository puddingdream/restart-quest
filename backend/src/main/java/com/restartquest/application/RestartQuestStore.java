package com.restartquest.application;

import com.restartquest.domain.DailyQuest;
import com.restartquest.domain.OnboardingProfile;
import java.util.List;
import java.util.Optional;

public interface RestartQuestStore {
    OnboardingProfile saveProfile(OnboardingProfile profile);

    Optional<OnboardingProfile> findProfile();

    List<DailyQuest> replaceTodayQuests(List<DailyQuest> quests);

    List<DailyQuest> findTodayQuests();

    Optional<DailyQuest> findQuest(String questId);

    DailyQuest saveQuest(DailyQuest quest);

    List<DailyQuest> replaceRedesignedQuests(String parentQuestId, List<DailyQuest> redesignedQuests);
}
