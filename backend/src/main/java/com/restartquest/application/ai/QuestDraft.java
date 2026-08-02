package com.restartquest.application.ai;

import com.restartquest.domain.quest.Quest;
import com.restartquest.domain.quest.QuestCategory;
import com.restartquest.domain.quest.QuestDifficulty;
import com.restartquest.domain.quest.QuestSeed;
import java.util.List;
import java.util.Objects;

public record QuestDraft(
        String title,
        String description,
        String completionCriteria,
        List<String> steps,
        QuestCategory category,
        QuestDifficulty difficulty,
        int estimatedMinutes
) {

    public QuestDraft {
        title = requiredText(title, 120, "title");
        description = requiredText(description, 600, "description");
        completionCriteria = requiredText(completionCriteria, 300, "completionCriteria");
        if (steps == null || steps.isEmpty() || steps.size() > 3) {
            throw new IllegalArgumentException("steps는 1개 이상 3개 이하여야 합니다.");
        }
        steps = steps.stream()
                .map(step -> requiredText(step, 160, "step"))
                .toList();
        Objects.requireNonNull(category, "category는 필수입니다.");
        Objects.requireNonNull(difficulty, "difficulty는 필수입니다.");
        if (estimatedMinutes <= 0) {
            throw new IllegalArgumentException("estimatedMinutes는 양수여야 합니다.");
        }
    }

    public static QuestDraft from(Quest quest) {
        Objects.requireNonNull(quest, "quest는 필수입니다.");
        return new QuestDraft(
                quest.getTitle(),
                quest.getDescription(),
                quest.getCompletionCriteria(),
                quest.getSteps(),
                quest.getCategory(),
                quest.getDifficulty(),
                quest.getEstimatedMinutes()
        );
    }

    public QuestSeed toAiGeneratedSeed() {
        return new QuestSeed(
                title,
                description,
                completionCriteria,
                steps,
                category,
                difficulty,
                estimatedMinutes,
                true
        );
    }

    private static String requiredText(String value, int maximumLength, String field) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(field + "은 필수입니다.");
        }
        String normalized = value.trim();
        if (normalized.length() > maximumLength) {
            throw new IllegalArgumentException(field + "가 허용 길이를 초과했습니다.");
        }
        return normalized;
    }
}
