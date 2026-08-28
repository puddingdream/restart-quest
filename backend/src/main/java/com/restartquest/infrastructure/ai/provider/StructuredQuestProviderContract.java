package com.restartquest.infrastructure.ai.provider;

import java.util.List;

public final class StructuredQuestProviderContract {

    private StructuredQuestProviderContract() {
    }

    public record PersonalizationPayload(
            String desiredJob,
            String region,
            String desiredWorkType,
            int careerGapMonths,
            boolean hasResume,
            String interviewExperience,
            String energyLevel
    ) {
    }

    public record QuestPayload(
            String title,
            String description,
            String completionCriteria,
            List<String> steps,
            String category,
            String difficulty,
            Integer estimatedMinutes
    ) {

        public QuestPayload {
            steps = steps == null ? null : List.copyOf(steps);
        }
    }

    public record GenerationRequest(PersonalizationPayload personalization) {
    }

    public record GenerationResponse(List<QuestPayload> quests) {

        public GenerationResponse {
            quests = quests == null ? null : List.copyOf(quests);
        }
    }

    public record RedesignRequest(
            PersonalizationPayload personalization,
            QuestPayload originalQuest,
            String reasonCode,
            String reasonNote
    ) {
    }

    public record RedesignResponse(QuestPayload replacementQuest) {
    }
}
