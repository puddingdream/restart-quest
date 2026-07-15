package com.restartquest.backend.application;

import com.restartquest.backend.domain.DailyQuest;
import com.restartquest.backend.domain.QuestCategory;
import com.restartquest.backend.domain.QuestDifficulty;
import com.restartquest.backend.domain.QuestStatus;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Objects;

public record QuestDraft(
        String title,
        String description,
        QuestCategory category,
        QuestDifficulty difficulty,
        int estimatedMinutes,
        String completionCriteria
) {
    public QuestDraft {
        Objects.requireNonNull(category, "category");
        Objects.requireNonNull(difficulty, "difficulty");
    }

    public DailyQuest toQuest(
            String id,
            String parentQuestId,
            LocalDate questDate,
            int sortOrder,
            LocalDateTime createdAt
    ) {
        return new DailyQuest(
                id,
                parentQuestId,
                title,
                description,
                category,
                difficulty,
                estimatedMinutes,
                completionCriteria,
                QuestStatus.TODO,
                sortOrder,
                questDate,
                createdAt,
                null
        );
    }
}
