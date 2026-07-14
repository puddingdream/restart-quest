package com.restartquest.backend.domain;

import java.time.LocalDateTime;
import java.util.Locale;
import java.util.Objects;

public record Quest(
        String id,
        String dailyQuestSetId,
        String userId,
        String parentQuestId,
        String title,
        String description,
        QuestCategory category,
        QuestDifficulty difficulty,
        int estimatedMinutes,
        String completionCriteria,
        QuestStatus status,
        QuestSource source,
        int sortOrder,
        LocalDateTime createdAt,
        LocalDateTime completedAt
) {
    public Quest {
        requireText(id, "id");
        requireText(dailyQuestSetId, "dailyQuestSetId");
        requireText(userId, "userId");
        requireText(title, "title");
        requireText(description, "description");
        requireText(completionCriteria, "completionCriteria");
        Objects.requireNonNull(category, "category");
        Objects.requireNonNull(difficulty, "difficulty");
        Objects.requireNonNull(status, "status");
        Objects.requireNonNull(source, "source");
        Objects.requireNonNull(createdAt, "createdAt");
        if (estimatedMinutes < 5 || estimatedMinutes > 30) {
            throw new IllegalArgumentException("estimatedMinutes must be between 5 and 30");
        }
        if (sortOrder < 0) {
            throw new IllegalArgumentException("sortOrder must not be negative");
        }
        rejectEvaluationLanguage(title + " " + description + " " + completionCriteria);
    }

    public Quest complete(LocalDateTime completedAt) {
        Objects.requireNonNull(completedAt, "completedAt");
        ensureTodo();
        return new Quest(
                id,
                dailyQuestSetId,
                userId,
                parentQuestId,
                title,
                description,
                category,
                difficulty,
                estimatedMinutes,
                completionCriteria,
                QuestStatus.DONE,
                source,
                sortOrder,
                createdAt,
                completedAt
        );
    }

    public Quest fail() {
        ensureTodo();
        return new Quest(
                id,
                dailyQuestSetId,
                userId,
                parentQuestId,
                title,
                description,
                category,
                difficulty,
                estimatedMinutes,
                completionCriteria,
                QuestStatus.FAILED,
                source,
                sortOrder,
                createdAt,
                null
        );
    }

    private void ensureTodo() {
        if (status != QuestStatus.TODO) {
            throw new IllegalStateException("only TODO quest can be changed");
        }
    }

    private static void rejectEvaluationLanguage(String text) {
        String normalized = text.toLowerCase(Locale.ROOT);
        String[] forbidden = {
                "willpower score",
                "risk score",
                "diagnosis",
                "therapy",
                "surveillance"
        };
        for (String phrase : forbidden) {
            if (normalized.contains(phrase)) {
                throw new IllegalArgumentException("quest text contains forbidden evaluation language");
            }
        }
    }

    private static void requireText(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(fieldName + " is required");
        }
    }
}
