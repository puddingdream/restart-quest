package com.restartquest.backend.infrastructure;

import com.restartquest.backend.application.IdGenerator;
import com.restartquest.backend.domain.OnboardingProfile;
import com.restartquest.backend.domain.Quest;
import com.restartquest.backend.domain.QuestCategory;
import com.restartquest.backend.domain.QuestDifficulty;
import com.restartquest.backend.domain.QuestFailure;
import com.restartquest.backend.domain.QuestFailureReason;
import com.restartquest.backend.domain.QuestSource;
import com.restartquest.backend.domain.QuestStatus;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;

final class FallbackRedesignQuestFactory {
    private final IdGenerator idGenerator;

    FallbackRedesignQuestFactory(IdGenerator idGenerator) {
        this.idGenerator = Objects.requireNonNull(idGenerator, "idGenerator");
    }

    List<Quest> redesignQuest(
            Quest originalQuest,
            QuestFailure failure,
            OnboardingProfile profile,
            String dailyQuestSetId,
            LocalDateTime now
    ) {
        Objects.requireNonNull(originalQuest, "originalQuest");
        Objects.requireNonNull(failure, "failure");
        Objects.requireNonNull(profile, "profile");
        QuestDifficulty reducedDifficulty = reducedDifficulty(originalQuest.difficulty());

        return switch (failure.reason()) {
            case UNCLEAR_WHAT_TO_WRITE -> unclearWritingQuests(originalQuest, dailyQuestSetId, reducedDifficulty, now);
            case TOO_OVERWHELMING -> overwhelmingQuests(originalQuest, dailyQuestSetId, now);
            case NOT_ENOUGH_TIME, LOW_ENERGY -> List.of(redesignedQuest(originalQuest, dailyQuestSetId,
                    "Do a five minute version",
                    "Spend only five minutes on the first visible step of the original task.",
                    QuestCategory.ROUTINE, QuestDifficulty.TINY, 5,
                    "Five minutes are spent on the first step", 101, now));
            case MISSING_MATERIALS -> List.of(redesignedQuest(originalQuest, dailyQuestSetId,
                    "Find one missing material",
                    "Find or save one material needed before the original task can continue.",
                    QuestCategory.JOB_SEARCH, reducedDifficulty, 10,
                    "One needed material is saved", 101, now));
            case LOW_CONFIDENCE -> List.of(redesignedQuest(originalQuest, dailyQuestSetId,
                    "Check one existing strength",
                    "Name one experience, skill, or tool you have already used.",
                    QuestCategory.ROUTINE, QuestDifficulty.TINY, 5,
                    "One existing strength is named", 101, now));
            case NOT_RELEVANT -> List.of(redesignedQuest(originalQuest, dailyQuestSetId,
                    "Narrow one search condition",
                    "Choose one job, region, or interest condition before generating another task.",
                    QuestCategory.JOB_SEARCH, reducedDifficulty, 10,
                    "One search condition is narrowed", 101, now));
        };
    }

    private List<Quest> unclearWritingQuests(
            Quest originalQuest,
            String dailyQuestSetId,
            QuestDifficulty reducedDifficulty,
            LocalDateTime now
    ) {
        return List.of(
                redesignedQuest(originalQuest, dailyQuestSetId,
                        "Collect two examples before writing",
                        "Find two example phrases related to the original task.",
                        originalQuest.category(), reducedDifficulty, 5,
                        "Two examples are collected", 101, now),
                redesignedQuest(originalQuest, dailyQuestSetId,
                        "List three keywords only",
                        "Do not write a full sentence. List three keywords you could use later.",
                        originalQuest.category(), reducedDifficulty, 5,
                        "Three keywords are listed", 102, now),
                redesignedQuest(originalQuest, dailyQuestSetId,
                        "Write one first sentence",
                        "Use one keyword and write only the first sentence.",
                        originalQuest.category(), reducedDifficulty, 5,
                        "One first sentence is written", 103, now)
        );
    }

    private List<Quest> overwhelmingQuests(Quest originalQuest, String dailyQuestSetId, LocalDateTime now) {
        return List.of(
                redesignedQuest(originalQuest, dailyQuestSetId,
                        "Open and read the task only",
                        "Read the original task once without producing output.",
                        QuestCategory.ROUTINE, QuestDifficulty.TINY, 5,
                        "The task has been opened and read", 101, now),
                redesignedQuest(originalQuest, dailyQuestSetId,
                        "Choose the smallest next step",
                        "Pick one part of the original task to do later.",
                        QuestCategory.ROUTINE, QuestDifficulty.TINY, 5,
                        "One next step is chosen", 102, now)
        );
    }

    private Quest redesignedQuest(
            Quest originalQuest,
            String dailyQuestSetId,
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
                originalQuest.userId(),
                originalQuest.id(),
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

    private QuestDifficulty reducedDifficulty(QuestDifficulty difficulty) {
        return switch (difficulty) {
            case TINY, EASY -> QuestDifficulty.TINY;
            case NORMAL -> QuestDifficulty.EASY;
        };
    }
}
