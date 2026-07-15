package com.restartquest.backend.infrastructure;

import com.restartquest.backend.application.RestartQuestStore;
import com.restartquest.backend.domain.DailyQuest;
import com.restartquest.backend.domain.OnboardingProfile;
import com.restartquest.backend.domain.QuestFailureRecord;
import com.restartquest.backend.domain.QuestRedesignRecord;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public final class InMemoryRestartQuestStore implements RestartQuestStore {
    private OnboardingProfile profile;
    private final Map<String, DailyQuest> quests = new LinkedHashMap<>();
    private final Map<String, QuestFailureRecord> failures = new LinkedHashMap<>();
    private final Map<String, QuestRedesignRecord> redesigns = new LinkedHashMap<>();

    @Override
    public Optional<OnboardingProfile> findProfile() {
        return Optional.ofNullable(profile);
    }

    @Override
    public void saveProfile(OnboardingProfile profile) {
        this.profile = profile;
    }

    @Override
    public List<DailyQuest> findQuestsByDate(LocalDate questDate) {
        return quests.values().stream()
                .filter(quest -> quest.questDate().equals(questDate))
                .sorted(Comparator.comparingInt(DailyQuest::sortOrder).thenComparing(DailyQuest::createdAt))
                .toList();
    }

    @Override
    public Optional<DailyQuest> findQuest(String questId) {
        return Optional.ofNullable(quests.get(questId));
    }

    @Override
    public void replaceQuestsForDate(LocalDate questDate, List<DailyQuest> newQuests) {
        quests.values().removeIf(quest -> quest.questDate().equals(questDate));
        failures.values().removeIf(failure -> failure.createdAt().toLocalDate().equals(questDate));
        redesigns.values().removeIf(redesign -> redesign.createdAt().toLocalDate().equals(questDate));
        saveQuests(newQuests);
    }

    @Override
    public void saveQuest(DailyQuest quest) {
        quests.put(quest.id(), quest);
    }

    @Override
    public void saveQuests(List<DailyQuest> quests) {
        for (DailyQuest quest : quests) {
            saveQuest(quest);
        }
    }

    @Override
    public List<QuestFailureRecord> findFailuresByDate(LocalDate questDate) {
        return failures.values().stream()
                .filter(failure -> failure.createdAt().toLocalDate().equals(questDate))
                .sorted(Comparator.comparing(QuestFailureRecord::createdAt))
                .toList();
    }

    @Override
    public Optional<QuestFailureRecord> findLatestFailureForQuest(String questId) {
        List<QuestFailureRecord> matches = new ArrayList<>(failures.values().stream()
                .filter(failure -> failure.questId().equals(questId))
                .toList());
        matches.sort(Comparator.comparing(QuestFailureRecord::createdAt).reversed());
        return matches.stream().findFirst();
    }

    @Override
    public void saveFailure(QuestFailureRecord failure) {
        failures.put(failure.id(), failure);
    }

    @Override
    public List<QuestRedesignRecord> findRedesignsByDate(LocalDate questDate) {
        return redesigns.values().stream()
                .filter(redesign -> redesign.createdAt().toLocalDate().equals(questDate))
                .sorted(Comparator.comparing(QuestRedesignRecord::createdAt))
                .toList();
    }

    @Override
    public void saveRedesign(QuestRedesignRecord redesign) {
        redesigns.put(redesign.id(), redesign);
    }
}
