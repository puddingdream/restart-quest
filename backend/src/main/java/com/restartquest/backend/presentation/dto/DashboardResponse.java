package com.restartquest.backend.presentation.dto;

import com.restartquest.backend.domain.DashboardSnapshot;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record DashboardResponse(
        String userId,
        LocalDate date,
        int totalQuests,
        int doneQuests,
        int failedQuests,
        int redesignedQuests,
        String nextQuestId,
        List<RecentEventResponse> recentEvents
) {
    public static DashboardResponse from(DashboardSnapshot snapshot) {
        return new DashboardResponse(
                snapshot.userId(),
                snapshot.date(),
                snapshot.totalQuests(),
                snapshot.doneQuests(),
                snapshot.failedQuests(),
                snapshot.redesignedQuests(),
                snapshot.nextQuestId(),
                snapshot.recentEvents().stream().map(RecentEventResponse::from).toList()
        );
    }

    public record RecentEventResponse(String type, String questId, String summary, LocalDateTime createdAt) {
        public static RecentEventResponse from(DashboardSnapshot.RecentEvent event) {
            return new RecentEventResponse(event.type(), event.questId(), event.summary(), event.createdAt());
        }
    }
}
