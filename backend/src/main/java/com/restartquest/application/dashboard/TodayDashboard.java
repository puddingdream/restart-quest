package com.restartquest.application.dashboard;

import com.restartquest.domain.quest.QuestCategory;
import com.restartquest.domain.quest.QuestDifficulty;
import com.restartquest.domain.quest.QuestRedesignReasonCode;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record TodayDashboard(
        LocalDate date,
        int totalJourneys,
        int completedJourneys,
        int activeJourneys,
        int redesignCount,
        int progressPercent,
        NextQuest nextQuest,
        List<RecentRedesign> recentRedesigns
) {

    public TodayDashboard {
        recentRedesigns = List.copyOf(recentRedesigns);
    }

    public record NextQuest(
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

        public NextQuest {
            steps = List.copyOf(steps);
        }
    }

    public record RecentRedesign(
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
    }
}
