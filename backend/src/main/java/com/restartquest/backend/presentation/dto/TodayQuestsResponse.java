package com.restartquest.backend.presentation.dto;

import com.restartquest.backend.domain.DailyQuest;
import java.util.List;

public record TodayQuestsResponse(List<QuestResponse> quests) {
    public TodayQuestsResponse {
        quests = List.copyOf(quests);
    }

    public static TodayQuestsResponse from(List<DailyQuest> quests) {
        return new TodayQuestsResponse(quests.stream().map(QuestResponse::from).toList());
    }
}
