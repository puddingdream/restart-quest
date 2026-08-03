package com.restartquest.domain.quest;

import java.util.List;

public record QuestSeed(
        String title,
        String description,
        String completionCriteria,
        List<String> steps,
        QuestCategory category,
        QuestDifficulty difficulty,
        int estimatedMinutes,
        boolean generatedByAi
) {
}
