package com.restartquest.backend.application;

import com.restartquest.backend.domain.DailyQuest;
import com.restartquest.backend.domain.OnboardingProfile;
import com.restartquest.backend.domain.QuestFailureRecord;
import com.restartquest.backend.domain.QuestRedesignRecord;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface RestartQuestStore {
    Optional<OnboardingProfile> findProfile();

    void saveProfile(OnboardingProfile profile);

    List<DailyQuest> findQuestsByDate(LocalDate questDate);

    Optional<DailyQuest> findQuest(String questId);

    void replaceQuestsForDate(LocalDate questDate, List<DailyQuest> quests);

    void saveQuest(DailyQuest quest);

    void saveQuests(List<DailyQuest> quests);

    List<QuestFailureRecord> findFailuresByDate(LocalDate questDate);

    Optional<QuestFailureRecord> findLatestFailureForQuest(String questId);

    void saveFailure(QuestFailureRecord failure);

    List<QuestRedesignRecord> findRedesignsByDate(LocalDate questDate);

    void saveRedesign(QuestRedesignRecord redesign);
}
