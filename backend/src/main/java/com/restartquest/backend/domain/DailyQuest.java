package com.restartquest.backend.domain;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Objects;

public record DailyQuest(
        String id,
        String parentQuestId,
        String title,
        String description,
        QuestCategory category,
        QuestDifficulty difficulty,
        int estimatedMinutes,
        String completionCriteria,
        QuestStatus status,
        int sortOrder,
        LocalDate questDate,
        LocalDateTime createdAt,
        LocalDateTime completedAt
) {
    public DailyQuest {
        TextRules.requireText(id, "id");
        TextRules.requireText(title, "title");
        TextRules.requireText(description, "description");
        TextRules.requireText(completionCriteria, "completionCriteria");
        TextRules.rejectEvaluationLanguage(title + " " + description + " " + completionCriteria);
        Objects.requireNonNull(category, "category");
        Objects.requireNonNull(difficulty, "difficulty");
        Objects.requireNonNull(status, "status");
        Objects.requireNonNull(questDate, "questDate");
        Objects.requireNonNull(createdAt, "createdAt");
        if (estimatedMinutes < 5 || estimatedMinutes > 30) {
            throw new IllegalArgumentException("estimatedMinutes must be between 5 and 30");
        }
        if (sortOrder < 1) {
            throw new IllegalArgumentException("sortOrder must be positive");
        }
        if (status == QuestStatus.DONE && completedAt == null) {
            throw new IllegalArgumentException("completedAt is required for DONE quest");
        }
    }

    public boolean isOriginalQuest() {
        return parentQuestId == null;
    }

    public DailyQuest complete(LocalDateTime completedAt) {
        Objects.requireNonNull(completedAt, "completedAt");
        ensureTodo();
        return new DailyQuest(
                id,
                parentQuestId,
                title,
                description,
                category,
                difficulty,
                estimatedMinutes,
                completionCriteria,
                QuestStatus.DONE,
                sortOrder,
                questDate,
                createdAt,
                completedAt
        );
    }

    public DailyQuest fail() {
        ensureTodo();
        return withStatus(QuestStatus.FAILED, null);
    }

    public DailyQuest markRedesigned() {
        if (status != QuestStatus.FAILED) {
            throw new IllegalStateException("only FAILED quest can be marked REDESIGNED");
        }
        return withStatus(QuestStatus.REDESIGNED, null);
    }

    public boolean isEasierThan(DailyQuest original) {
        Objects.requireNonNull(original, "original");
        boolean lowerDifficulty = difficulty.isEasierThan(original.difficulty());
        boolean tinyFloor = difficulty == QuestDifficulty.TINY && original.difficulty() == QuestDifficulty.TINY;
        return estimatedMinutes < original.estimatedMinutes() && (lowerDifficulty || tinyFloor);
    }

    private DailyQuest withStatus(QuestStatus newStatus, LocalDateTime newCompletedAt) {
        return new DailyQuest(
                id,
                parentQuestId,
                title,
                description,
                category,
                difficulty,
                estimatedMinutes,
                completionCriteria,
                newStatus,
                sortOrder,
                questDate,
                createdAt,
                newCompletedAt
        );
    }

    private void ensureTodo() {
        if (status != QuestStatus.TODO) {
            throw new IllegalStateException("only TODO quest can be changed");
        }
    }
}
