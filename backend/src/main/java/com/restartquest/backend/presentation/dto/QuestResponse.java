package com.restartquest.backend.presentation.dto;

import com.restartquest.backend.domain.Quest;
import java.time.LocalDateTime;

public record QuestResponse(
        String id,
        String dailyQuestSetId,
        String parentQuestId,
        String title,
        String description,
        String category,
        String difficulty,
        int estimatedMinutes,
        String completionCriteria,
        String status,
        String source,
        int sortOrder,
        LocalDateTime createdAt,
        LocalDateTime completedAt
) {
    public static QuestResponse from(Quest quest) {
        return new QuestResponse(
                quest.id(),
                quest.dailyQuestSetId(),
                quest.parentQuestId(),
                quest.title(),
                quest.description(),
                quest.category().name(),
                quest.difficulty().name(),
                quest.estimatedMinutes(),
                quest.completionCriteria(),
                quest.status().name(),
                quest.source().name(),
                quest.sortOrder(),
                quest.createdAt(),
                quest.completedAt()
        );
    }
}
