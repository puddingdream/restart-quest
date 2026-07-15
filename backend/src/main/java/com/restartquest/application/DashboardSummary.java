package com.restartquest.application;

import com.restartquest.domain.DailyQuest;
import java.util.List;

public record DashboardSummary(
        int totalOriginalQuests,
        int doneCount,
        int failedCount,
        int redesignedCount,
        double completionRate,
        DailyQuest nextAction,
        List<RedesignHistoryItem> redesignHistory
) {
    public DashboardSummary {
        redesignHistory = List.copyOf(redesignHistory);
    }
}
