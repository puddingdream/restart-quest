package com.restartquest.presentation.quest.dto;

import com.restartquest.application.quest.TodayQuestPlan;
import com.restartquest.domain.quest.EnergyLevel;
import java.time.LocalDate;
import java.util.List;

public record DailyQuestResponse(
        LocalDate date,
        EnergyLevel energyLevel,
        boolean generatedNow,
        List<QuestJourneyResponse> journeys
) {

    public static DailyQuestResponse from(TodayQuestPlan result) {
        if (!result.hasPlan()) {
            return new DailyQuestResponse(result.questDate(), null, false, List.of());
        }
        return new DailyQuestResponse(
                result.questDate(),
                result.plan().getEnergyLevel(),
                result.generatedNow(),
                result.plan().getJourneys().stream()
                        .map(QuestJourneyResponse::from)
                        .toList()
        );
    }
}
