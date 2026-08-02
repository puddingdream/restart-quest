package com.restartquest.presentation.quest.dto;

import com.restartquest.domain.quest.Quest;
import com.restartquest.domain.quest.QuestCategory;
import com.restartquest.domain.quest.QuestDifficulty;
import com.restartquest.domain.quest.QuestStatus;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record QuestResponse(
        UUID questId,
        UUID parentQuestId,
        int revision,
        String title,
        String description,
        String completionCriteria,
        List<String> steps,
        QuestCategory category,
        QuestDifficulty difficulty,
        int estimatedMinutes,
        QuestStatus status,
        boolean generatedByAi,
        OffsetDateTime createdAt,
        OffsetDateTime completedAt
) {

    public static QuestResponse from(Quest quest) {
        return new QuestResponse(
                quest.getId(),
                quest.getParentQuestId(),
                quest.getRevision(),
                quest.getTitle(),
                quest.getDescription(),
                quest.getCompletionCriteria(),
                quest.getSteps(),
                quest.getCategory(),
                quest.getDifficulty(),
                quest.getEstimatedMinutes(),
                quest.getStatus(),
                quest.isGeneratedByAi(),
                quest.getCreatedAt(),
                quest.getCompletedAt()
        );
    }
}
