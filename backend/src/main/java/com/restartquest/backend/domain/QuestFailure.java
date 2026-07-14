package com.restartquest.backend.domain;

import java.time.LocalDateTime;
import java.util.Objects;

public record QuestFailure(
        String id,
        String questId,
        String userId,
        QuestFailureReason reason,
        String memo,
        LocalDateTime createdAt
) {
    public QuestFailure {
        requireText(id, "id");
        requireText(questId, "questId");
        requireText(userId, "userId");
        Objects.requireNonNull(reason, "reason");
        Objects.requireNonNull(createdAt, "createdAt");
    }

    private static void requireText(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(fieldName + " is required");
        }
    }
}
