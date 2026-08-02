package com.restartquest.presentation.dashboard.dto;

import com.restartquest.application.dashboard.TodayDashboard;
import com.restartquest.domain.quest.QuestCategory;
import com.restartquest.domain.quest.QuestDifficulty;
import com.restartquest.domain.quest.QuestRedesignReasonCode;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record TodayDashboardResponse(
        LocalDate date,
        int totalJourneys,
        int completedJourneys,
        int activeJourneys,
        int redesignCount,
        int progressPercent,
        NextQuestResponse nextQuest,
        List<RecentRedesignResponse> recentRedesigns
) {

    public static TodayDashboardResponse from(TodayDashboard dashboard) {
        NextQuestResponse nextQuest = dashboard.nextQuest() == null
                ? null
                : NextQuestResponse.from(dashboard.nextQuest());
        return new TodayDashboardResponse(
                dashboard.date(),
                dashboard.totalJourneys(),
                dashboard.completedJourneys(),
                dashboard.activeJourneys(),
                dashboard.redesignCount(),
                dashboard.progressPercent(),
                nextQuest,
                dashboard.recentRedesigns().stream()
                        .map(RecentRedesignResponse::from)
                        .toList()
        );
    }

    public record NextQuestResponse(
            UUID journeyId,
            UUID questId,
            int revision,
            String title,
            String description,
            String completionCriteria,
            List<String> steps,
            QuestCategory category,
            QuestDifficulty difficulty,
            int estimatedMinutes
    ) {

        private static NextQuestResponse from(TodayDashboard.NextQuest quest) {
            return new NextQuestResponse(
                    quest.journeyId(),
                    quest.questId(),
                    quest.revision(),
                    quest.title(),
                    quest.description(),
                    quest.completionCriteria(),
                    quest.steps(),
                    quest.category(),
                    quest.difficulty(),
                    quest.estimatedMinutes()
            );
        }
    }

    public record RecentRedesignResponse(
            UUID redesignId,
            UUID journeyId,
            UUID originalQuestId,
            String originalQuestTitle,
            UUID replacementQuestId,
            String replacementQuestTitle,
            QuestRedesignReasonCode reasonCode,
            String reasonNote,
            OffsetDateTime createdAt
    ) {

        private static RecentRedesignResponse from(TodayDashboard.RecentRedesign redesign) {
            return new RecentRedesignResponse(
                    redesign.redesignId(),
                    redesign.journeyId(),
                    redesign.originalQuestId(),
                    redesign.originalQuestTitle(),
                    redesign.replacementQuestId(),
                    redesign.replacementQuestTitle(),
                    redesign.reasonCode(),
                    redesign.reasonNote(),
                    redesign.createdAt()
            );
        }
    }
}
