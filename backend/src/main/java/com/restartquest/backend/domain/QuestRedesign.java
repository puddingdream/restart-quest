package com.restartquest.backend.domain;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;

public record QuestRedesign(
        String id,
        String originalQuestId,
        String failureId,
        List<String> redesignedQuestIds,
        String strategySummary,
        LocalDateTime createdAt
) {
    public QuestRedesign {
        requireText(id, "id");
        requireText(originalQuestId, "originalQuestId");
        requireText(failureId, "failureId");
        requireText(strategySummary, "strategySummary");
        Objects.requireNonNull(createdAt, "createdAt");
        redesignedQuestIds = List.copyOf(Objects.requireNonNull(redesignedQuestIds, "redesignedQuestIds"));
        if (redesignedQuestIds.isEmpty()) {
            throw new IllegalArgumentException("redesignedQuestIds must not be empty");
        }
    }

    private static void requireText(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(fieldName + " is required");
        }
    }
}
