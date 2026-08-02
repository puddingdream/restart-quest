package com.restartquest.presentation.quest.dto;

import com.restartquest.application.quest.RedesignQuestResult;
import com.restartquest.domain.quest.QuestJourneyStatus;
import java.util.List;
import java.util.UUID;

public record FailureRedesignResponse(
        UUID journeyId,
        QuestJourneyStatus status,
        QuestResponse currentQuest,
        List<QuestResponse> history,
        QuestRedesignResponse redesign
) {

    public static FailureRedesignResponse from(RedesignQuestResult result) {
        QuestJourneyResponse journey = QuestJourneyResponse.from(result.journey());
        return new FailureRedesignResponse(
                journey.journeyId(),
                journey.status(),
                journey.currentQuest(),
                journey.history(),
                QuestRedesignResponse.from(result.redesign())
        );
    }
}
