package com.restartquest.application.dashboard;

import com.restartquest.application.port.QuestPlanStore;
import com.restartquest.domain.quest.DailyQuestPlan;
import com.restartquest.domain.quest.Quest;
import com.restartquest.domain.quest.QuestJourney;
import com.restartquest.domain.quest.QuestJourneyStatus;
import com.restartquest.domain.quest.QuestRedesign;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DashboardQueryService {

    private static final ZoneId SERVICE_ZONE = ZoneId.of("Asia/Seoul");

    private final QuestPlanStore questPlanStore;

    public DashboardQueryService(QuestPlanStore questPlanStore) {
        this.questPlanStore = questPlanStore;
    }

    @Transactional(readOnly = true)
    public TodayDashboard getToday(UUID userId) {
        LocalDate today = LocalDate.now(SERVICE_ZONE);
        return questPlanStore.findByDateForUser(userId, today)
                .map(plan -> summarize(today, plan))
                .orElseGet(() -> empty(today));
    }

    private static TodayDashboard summarize(LocalDate date, DailyQuestPlan plan) {
        List<QuestJourney> journeys = plan.getJourneys();
        int totalJourneys = journeys.size();
        int completedJourneys = (int) journeys.stream()
                .filter(journey -> journey.getStatus() == QuestJourneyStatus.COMPLETED)
                .count();
        int activeJourneys = (int) journeys.stream()
                .filter(journey -> journey.getStatus() == QuestJourneyStatus.ACTIVE)
                .count();
        List<TodayDashboard.RecentRedesign> recentRedesigns = journeys.stream()
                .flatMap(journey -> journey.getRedesigns().stream()
                        .map(redesign -> toRecentRedesign(journey, redesign)))
                .sorted(Comparator.comparing(TodayDashboard.RecentRedesign::createdAt)
                        .reversed()
                        .thenComparing(redesign -> redesign.redesignId().toString()))
                .toList();

        TodayDashboard.NextQuest nextQuest = journeys.stream()
                .filter(journey -> journey.getStatus() == QuestJourneyStatus.ACTIVE)
                .min(Comparator.comparingInt(QuestJourney::getInitialSlot))
                .map(DashboardQueryService::toNextQuest)
                .orElse(null);

        int progressPercent = totalJourneys == 0
                ? 0
                : (int) Math.round(completedJourneys * 100.0 / totalJourneys);
        return new TodayDashboard(
                date,
                totalJourneys,
                completedJourneys,
                activeJourneys,
                recentRedesigns.size(),
                progressPercent,
                nextQuest,
                recentRedesigns
        );
    }

    private static TodayDashboard empty(LocalDate date) {
        return new TodayDashboard(date, 0, 0, 0, 0, 0, null, List.of());
    }

    private static TodayDashboard.NextQuest toNextQuest(QuestJourney journey) {
        Quest quest = journey.getCurrentQuest();
        return new TodayDashboard.NextQuest(
                journey.getId(),
                quest.getId(),
                quest.getRevision(),
                quest.getTitle(),
                quest.getDescription(),
                quest.getCompletionCriteria(),
                quest.getSteps(),
                quest.getCategory(),
                quest.getDifficulty(),
                quest.getEstimatedMinutes()
        );
    }

    private static TodayDashboard.RecentRedesign toRecentRedesign(
            QuestJourney journey,
            QuestRedesign redesign
    ) {
        Quest originalQuest = findQuest(journey, redesign.getOriginalQuestId());
        Quest replacementQuest = findQuest(journey, redesign.getReplacementQuestId());
        return new TodayDashboard.RecentRedesign(
                redesign.getId(),
                journey.getId(),
                originalQuest.getId(),
                originalQuest.getTitle(),
                replacementQuest.getId(),
                replacementQuest.getTitle(),
                redesign.getReasonCode(),
                redesign.getReasonNote(),
                redesign.getCreatedAt()
        );
    }

    private static Quest findQuest(QuestJourney journey, UUID questId) {
        return journey.getQuests().stream()
                .filter(quest -> quest.getId().equals(questId))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("재설계 이력의 퀘스트를 찾을 수 없습니다."));
    }
}
