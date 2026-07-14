package com.restartquest.backend.presentation.dto;

import com.restartquest.backend.domain.DailyQuestSet;
import java.time.LocalDate;
import java.util.List;

public record DailyQuestSetResponse(
        String id,
        String userId,
        LocalDate questDate,
        String energyLevel,
        String status,
        List<QuestResponse> quests
) {
    public static DailyQuestSetResponse from(DailyQuestSet questSet) {
        return new DailyQuestSetResponse(
                questSet.id(),
                questSet.userId(),
                questSet.questDate(),
                questSet.energyLevel().name(),
                questSet.status().name(),
                questSet.quests().stream().map(QuestResponse::from).toList()
        );
    }
}
