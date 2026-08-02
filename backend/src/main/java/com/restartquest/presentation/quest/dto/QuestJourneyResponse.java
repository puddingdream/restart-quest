package com.restartquest.presentation.quest.dto;

import com.restartquest.domain.quest.QuestJourney;
import com.restartquest.domain.quest.QuestJourneyStatus;
import java.util.List;
import java.util.UUID;

public record QuestJourneyResponse(
        UUID journeyId,
        QuestJourneyStatus status,
        QuestResponse currentQuest,
        List<QuestResponse> history
) {

    public static QuestJourneyResponse from(QuestJourney journey) {
        List<QuestResponse> history = journey.getQuests().stream()
                .filter(quest -> !quest.getId().equals(journey.getCurrentQuestId()))
                .map(QuestResponse::from)
                .toList();
        return new QuestJourneyResponse(
                journey.getId(),
                journey.getStatus(),
                QuestResponse.from(journey.getCurrentQuest()),
                history
        );
    }
}
