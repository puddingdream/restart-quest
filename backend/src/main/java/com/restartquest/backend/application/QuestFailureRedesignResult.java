package com.restartquest.backend.application;

import com.restartquest.backend.domain.DailyQuestSet;
import com.restartquest.backend.domain.Quest;
import com.restartquest.backend.domain.QuestFailure;
import com.restartquest.backend.domain.QuestRedesign;
import java.util.List;

public record QuestFailureRedesignResult(
        DailyQuestSet questSet,
        Quest failedQuest,
        QuestFailure failure,
        QuestRedesign redesign,
        List<Quest> redesignedQuests
) {
    public QuestFailureRedesignResult {
        redesignedQuests = List.copyOf(redesignedQuests);
    }
}
