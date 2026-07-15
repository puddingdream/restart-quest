package com.restartquest.backend.domain;

import java.time.LocalDateTime;
import java.util.Objects;

public record QuestFailureRecord(
        String id,
        String questId,
        FailureReason reason,
        String note,
        LocalDateTime createdAt
) {
    public QuestFailureRecord {
        TextRules.requireText(id, "id");
        TextRules.requireText(questId, "questId");
        Objects.requireNonNull(reason, "reason");
        Objects.requireNonNull(createdAt, "createdAt");
    }
}
