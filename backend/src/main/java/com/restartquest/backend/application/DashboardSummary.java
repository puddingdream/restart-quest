package com.restartquest.backend.application;

import com.restartquest.backend.domain.FailureReason;
import com.restartquest.backend.domain.QuestCategory;
import com.restartquest.backend.domain.QuestDifficulty;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record DashboardSummary(
        LocalDate questDate,
        int originalQuestCount,
        int doneCount,
        int failureCount,
        int redesignedQuestCount,
        int progressPercent,
        QuestSnapshot nextAction,
        List<RedesignHistory> recentRedesigns
) {
    public DashboardSummary {
        recentRedesigns = List.copyOf(recentRedesigns);
    }

    public record QuestSnapshot(
            String id,
            String parentQuestId,
            String title,
            String description,
            QuestCategory category,
            QuestDifficulty difficulty,
            int estimatedMinutes,
            String completionCriteria
    ) {
    }

    public record RedesignHistory(
            String originalQuestId,
            String originalTitle,
            FailureReason failureReason,
            String strategySummary,
            List<QuestSnapshot> redesignedQuests,
            LocalDateTime createdAt
    ) {
        public RedesignHistory {
            redesignedQuests = List.copyOf(redesignedQuests);
        }
    }
}
