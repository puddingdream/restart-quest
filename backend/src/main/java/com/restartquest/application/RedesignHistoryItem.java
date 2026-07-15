package com.restartquest.application;

import com.restartquest.domain.DailyQuest;
import com.restartquest.domain.FailureReason;
import java.util.List;

public record RedesignHistoryItem(
        String originalQuestId,
        String originalTitle,
        FailureReason failureReason,
        List<DailyQuest> redesignedQuests
) {
    public RedesignHistoryItem {
        redesignedQuests = List.copyOf(redesignedQuests);
    }
}
