package com.restartquest.backend.presentation.dto;

import com.restartquest.backend.application.DashboardSummary;
import java.time.LocalDate;
import java.util.List;

public record DashboardResponse(
        LocalDate questDate,
        int originalQuestCount,
        int doneCount,
        int failureCount,
        int redesignedQuestCount,
        int progressPercent,
        DashboardSummary.QuestSnapshot nextAction,
        List<DashboardSummary.RedesignHistory> recentRedesigns
) {
    public DashboardResponse {
        recentRedesigns = List.copyOf(recentRedesigns);
    }

    public static DashboardResponse from(DashboardSummary summary) {
        return new DashboardResponse(
                summary.questDate(),
                summary.originalQuestCount(),
                summary.doneCount(),
                summary.failureCount(),
                summary.redesignedQuestCount(),
                summary.progressPercent(),
                summary.nextAction(),
                summary.recentRedesigns()
        );
    }
}
