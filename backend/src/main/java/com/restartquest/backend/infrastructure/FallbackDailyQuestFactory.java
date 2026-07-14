package com.restartquest.backend.infrastructure;

import com.restartquest.backend.application.IdGenerator;
import com.restartquest.backend.domain.EnergyLevel;
import com.restartquest.backend.domain.OnboardingProfile;
import com.restartquest.backend.domain.Quest;
import com.restartquest.backend.domain.QuestCategory;
import com.restartquest.backend.domain.QuestDifficulty;
import com.restartquest.backend.domain.QuestSource;
import com.restartquest.backend.domain.QuestStatus;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;

final class FallbackDailyQuestFactory {
    private final IdGenerator idGenerator;

    FallbackDailyQuestFactory(IdGenerator idGenerator) {
        this.idGenerator = Objects.requireNonNull(idGenerator, "idGenerator");
    }

    List<Quest> planDailyQuests(OnboardingProfile profile, String dailyQuestSetId, LocalDate questDate, LocalDateTime now) {
        Objects.requireNonNull(profile, "profile");
        Objects.requireNonNull(questDate, "questDate");
        QuestDifficulty difficulty = difficultyFor(profile.defaultEnergyLevel());
        int minutes = minutesFor(profile.defaultEnergyLevel());

        return List.of(
                quest(dailyQuestSetId, profile.userId(), "Save two relevant job postings",
                        "Find two postings for " + profile.desiredJob() + " near " + profile.region() + " and save their links.",
                        QuestCategory.JOB_SEARCH, difficulty, minutes, "Two posting links are saved", 10, now),
                quest(dailyQuestSetId, profile.userId(), resumeTitle(profile), resumeDescription(profile),
                        QuestCategory.RESUME, difficulty, minutes, resumeCriteria(profile), 20, now),
                quest(dailyQuestSetId, profile.userId(), "Draft a short gap explanation",
                        "Write three plain sentences that explain what you are ready to do next.",
                        QuestCategory.INTERVIEW, difficulty, minutes, "Three sentences are drafted", 30, now)
        );
    }

    private Quest quest(
            String dailyQuestSetId,
            String userId,
            String title,
            String description,
            QuestCategory category,
            QuestDifficulty difficulty,
            int estimatedMinutes,
            String completionCriteria,
            int sortOrder,
            LocalDateTime now
    ) {
        return new Quest(
                idGenerator.nextId("quest"),
                dailyQuestSetId,
                userId,
                null,
                title,
                description,
                category,
                difficulty,
                estimatedMinutes,
                completionCriteria,
                QuestStatus.TODO,
                QuestSource.FALLBACK_RULE,
                sortOrder,
                now,
                null
        );
    }

    private QuestDifficulty difficultyFor(EnergyLevel energyLevel) {
        return switch (energyLevel) {
            case LOW -> QuestDifficulty.TINY;
            case MEDIUM -> QuestDifficulty.EASY;
            case HIGH -> QuestDifficulty.NORMAL;
        };
    }

    private int minutesFor(EnergyLevel energyLevel) {
        return switch (energyLevel) {
            case LOW -> 10;
            case MEDIUM -> 15;
            case HIGH -> 25;
        };
    }

    private String resumeTitle(OnboardingProfile profile) {
        return profile.hasResume() ? "Update one resume bullet" : "List three resume materials";
    }

    private String resumeDescription(OnboardingProfile profile) {
        if (profile.hasResume()) {
            return "Pick one bullet related to " + profile.desiredJob() + " and make it clearer.";
        }
        return "List three experiences, projects, or tools that could become resume material.";
    }

    private String resumeCriteria(OnboardingProfile profile) {
        return profile.hasResume() ? "One resume bullet is updated" : "Three resume materials are listed";
    }
}
