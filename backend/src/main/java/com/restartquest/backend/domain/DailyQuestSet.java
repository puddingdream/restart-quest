package com.restartquest.backend.domain;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;

public record DailyQuestSet(
        String id,
        String userId,
        LocalDate questDate,
        EnergyLevel energyLevel,
        DailyQuestSetStatus status,
        List<Quest> quests,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public DailyQuestSet {
        requireText(id, "id");
        requireText(userId, "userId");
        Objects.requireNonNull(questDate, "questDate");
        Objects.requireNonNull(energyLevel, "energyLevel");
        Objects.requireNonNull(status, "status");
        Objects.requireNonNull(createdAt, "createdAt");
        Objects.requireNonNull(updatedAt, "updatedAt");
        quests = List.copyOf(Objects.requireNonNull(quests, "quests"));
    }

    public Quest findQuest(String questId) {
        requireText(questId, "questId");
        return quests.stream()
                .filter(quest -> Objects.equals(quest.id(), questId))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("quest not found: " + questId));
    }

    public DailyQuestSet replaceQuest(Quest replacement, LocalDateTime updatedAt) {
        Objects.requireNonNull(replacement, "replacement");
        Objects.requireNonNull(updatedAt, "updatedAt");
        List<Quest> replaced = quests.stream()
                .map(quest -> Objects.equals(quest.id(), replacement.id()) ? replacement : quest)
                .toList();
        return withQuests(replaced, updatedAt);
    }

    public DailyQuestSet withQuests(List<Quest> quests, LocalDateTime updatedAt) {
        return new DailyQuestSet(id, userId, questDate, energyLevel, status, quests, createdAt, updatedAt);
    }

    private static void requireText(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(fieldName + " is required");
        }
    }
}
