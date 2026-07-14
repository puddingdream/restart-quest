package com.restartquest.backend.domain;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;

public record DashboardSnapshot(
        String userId,
        LocalDate date,
        int totalQuests,
        int doneQuests,
        int failedQuests,
        int redesignedQuests,
        String nextQuestId,
        List<RecentEvent> recentEvents
) {
    public DashboardSnapshot {
        requireText(userId, "userId");
        Objects.requireNonNull(date, "date");
        if (totalQuests < 0 || doneQuests < 0 || failedQuests < 0 || redesignedQuests < 0) {
            throw new IllegalArgumentException("dashboard counts must not be negative");
        }
        recentEvents = List.copyOf(Objects.requireNonNull(recentEvents, "recentEvents"));
    }

    public record RecentEvent(String type, String questId, String summary, LocalDateTime createdAt) {
        public RecentEvent {
            requireText(type, "type");
            requireText(questId, "questId");
            requireText(summary, "summary");
            Objects.requireNonNull(createdAt, "createdAt");
        }
    }

    private static void requireText(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(fieldName + " is required");
        }
    }
}
