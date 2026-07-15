package com.restartquest.application;

import com.restartquest.domain.DailyQuest;
import com.restartquest.domain.OnboardingProfile;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public final class InMemoryRestartQuestStore implements RestartQuestStore {
    private OnboardingProfile profile;
    private final List<DailyQuest> todayQuests = new ArrayList<>();

    @Override
    public synchronized OnboardingProfile saveProfile(OnboardingProfile profile) {
        this.profile = profile;
        return profile;
    }

    @Override
    public synchronized Optional<OnboardingProfile> findProfile() {
        return Optional.ofNullable(profile);
    }

    @Override
    public synchronized List<DailyQuest> replaceTodayQuests(List<DailyQuest> quests) {
        todayQuests.clear();
        todayQuests.addAll(quests);
        return List.copyOf(todayQuests);
    }

    @Override
    public synchronized List<DailyQuest> findTodayQuests() {
        return List.copyOf(todayQuests);
    }

    @Override
    public synchronized Optional<DailyQuest> findQuest(String questId) {
        return todayQuests.stream()
                .filter(quest -> quest.id().equals(questId))
                .findFirst();
    }

    @Override
    public synchronized DailyQuest saveQuest(DailyQuest quest) {
        for (int index = 0; index < todayQuests.size(); index++) {
            if (todayQuests.get(index).id().equals(quest.id())) {
                todayQuests.set(index, quest);
                return quest;
            }
        }
        todayQuests.add(quest);
        return quest;
    }

    @Override
    public synchronized List<DailyQuest> replaceRedesignedQuests(
            String parentQuestId,
            List<DailyQuest> redesignedQuests
    ) {
        todayQuests.removeIf(quest -> parentQuestId.equals(quest.parentQuestId()));
        todayQuests.addAll(redesignedQuests);
        return List.copyOf(redesignedQuests);
    }
}
