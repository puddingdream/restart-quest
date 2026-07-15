package com.restartquest.backend.presentation.dto;

import com.restartquest.backend.application.RedesignQuestService.RedesignOutcome;
import com.restartquest.backend.domain.FailureReason;
import java.util.List;

public record QuestRedesignResponse(
        QuestResponse originalQuest,
        FailureReason failureReason,
        String strategySummary,
        List<QuestResponse> redesignedQuests
) {
    public QuestRedesignResponse {
        redesignedQuests = List.copyOf(redesignedQuests);
    }

    public static QuestRedesignResponse from(RedesignOutcome outcome) {
        return new QuestRedesignResponse(
                QuestResponse.from(outcome.originalQuest()),
                outcome.failure().reason(),
                outcome.redesign().strategySummary(),
                outcome.redesignedQuests().stream().map(QuestResponse::from).toList()
        );
    }
}
