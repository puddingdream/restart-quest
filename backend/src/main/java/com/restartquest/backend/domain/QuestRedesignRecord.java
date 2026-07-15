package com.restartquest.backend.domain;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;

public record QuestRedesignRecord(
        String id,
        String originalQuestId,
        String failureRecordId,
        List<String> redesignedQuestIds,
        String strategySummary,
        LocalDateTime createdAt
) {
    public QuestRedesignRecord {
        TextRules.requireText(id, "id");
        TextRules.requireText(originalQuestId, "originalQuestId");
        TextRules.requireText(failureRecordId, "failureRecordId");
        TextRules.requireText(strategySummary, "strategySummary");
        Objects.requireNonNull(createdAt, "createdAt");
        redesignedQuestIds = List.copyOf(redesignedQuestIds);
        if (redesignedQuestIds.isEmpty()) {
            throw new IllegalArgumentException("redesignedQuestIds must not be empty");
        }
    }
}
