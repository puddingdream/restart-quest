package com.restartquest.backend.presentation.dto;

import com.restartquest.backend.domain.DailyQuest;
import com.restartquest.backend.domain.QuestCategory;
import com.restartquest.backend.domain.QuestDifficulty;
import com.restartquest.backend.domain.QuestStatus;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record QuestResponse(
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
    public static QuestResponse from(DailyQuest quest) {
        return new QuestResponse(
                quest.id(),
                quest.parentQuestId(),
                quest.title(),
                quest.description(),
                quest.category(),
                quest.difficulty(),
                quest.estimatedMinutes(),
                quest.completionCriteria(),
                quest.status(),
                quest.sortOrder(),
                quest.questDate(),
                quest.createdAt(),
                quest.completedAt()
        );
    }
}
