package com.restartquest.backend;

import com.restartquest.backend.application.DailyQuestOrchestrator;
import com.restartquest.backend.application.IdGenerator;
import com.restartquest.backend.application.QuestFailureRedesignResult;
import com.restartquest.backend.domain.DailyQuestSet;
import com.restartquest.backend.domain.DashboardSnapshot;
import com.restartquest.backend.domain.EnergyLevel;
import com.restartquest.backend.domain.OnboardingProfile;
import com.restartquest.backend.domain.Quest;
import com.restartquest.backend.domain.QuestFailureReason;
import com.restartquest.backend.domain.QuestSource;
import com.restartquest.backend.domain.QuestStatus;
import com.restartquest.backend.infrastructure.FallbackQuestPlanner;
import com.restartquest.backend.presentation.dto.DailyQuestSetResponse;
import com.restartquest.backend.presentation.dto.DashboardResponse;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

public final class DailyQuestWorkflowTest {
    public static void main(String[] args) {
        IdGenerator idGenerator = new SequentialIdGenerator();
        DailyQuestOrchestrator orchestrator = new DailyQuestOrchestrator(
                new FallbackQuestPlanner(idGenerator),
                idGenerator
        );
        OnboardingProfile profile = new OnboardingProfile(
                "user-1",
                "Seoul",
                "Backend developer",
                "FULL_TIME",
                8,
                true,
                "LOW",
                List.of("Java", "Spring"),
                EnergyLevel.LOW
        );
        LocalDate questDate = LocalDate.of(2026, 7, 14);
        LocalDateTime startedAt = LocalDateTime.of(2026, 7, 14, 9, 0);

        DailyQuestSet generated = orchestrator.generateToday(profile, questDate, startedAt);
        assertEquals(3, generated.quests().size(), "daily quest count");
        assertTrue(generated.quests().stream().allMatch(quest -> quest.source() == QuestSource.FALLBACK_RULE), "fallback source");
        assertTrue(generated.quests().stream().allMatch(quest -> quest.status() == QuestStatus.TODO), "initial status");
        assertTrue(generated.quests().stream().allMatch(quest -> quest.estimatedMinutes() >= 5 && quest.estimatedMinutes() <= 30), "estimated minutes");

        Quest completedQuest = generated.quests().get(0);
        DailyQuestSet afterComplete = orchestrator.completeQuest(generated, completedQuest.id(), startedAt.plusMinutes(8));
        assertEquals(QuestStatus.DONE, afterComplete.findQuest(completedQuest.id()).status(), "completed quest status");

        Quest failedCandidate = afterComplete.quests().get(1);
        QuestFailureRedesignResult redesignResult = orchestrator.failAndRedesign(
                afterComplete,
                failedCandidate.id(),
                QuestFailureReason.UNCLEAR_WHAT_TO_WRITE,
                "Need examples before writing.",
                profile,
                startedAt.plusMinutes(12)
        );

        assertEquals(QuestStatus.FAILED, redesignResult.questSet().findQuest(failedCandidate.id()).status(), "failed quest status");
        assertEquals(3, redesignResult.redesignedQuests().size(), "unclear writing redesign count");
        assertTrue(redesignResult.redesignedQuests().stream()
                .allMatch(quest -> failedCandidate.id().equals(quest.parentQuestId())), "redesign parent link");
        assertTrue(redesignResult.redesignedQuests().stream()
                .allMatch(quest -> quest.difficulty().isNoHarderThan(failedCandidate.difficulty())), "redesign difficulty");

        DashboardSnapshot dashboard = orchestrator.summarize(
                redesignResult.questSet(),
                List.of(redesignResult.failure()),
                List.of(redesignResult.redesign())
        );
        assertEquals(6, dashboard.totalQuests(), "dashboard total");
        assertEquals(1, dashboard.doneQuests(), "dashboard done");
        assertEquals(1, dashboard.failedQuests(), "dashboard failed");
        assertEquals(3, dashboard.redesignedQuests(), "dashboard redesigned");
        assertNotBlank(dashboard.nextQuestId(), "dashboard next quest");
        assertEquals(2, dashboard.recentEvents().size(), "dashboard recent events");

        DailyQuestSetResponse questSetResponse = DailyQuestSetResponse.from(redesignResult.questSet());
        DashboardResponse dashboardResponse = DashboardResponse.from(dashboard);
        assertEquals(redesignResult.questSet().quests().size(), questSetResponse.quests().size(), "quest DTO size");
        assertEquals(dashboard.totalQuests(), dashboardResponse.totalQuests(), "dashboard DTO total");

        System.out.println("DailyQuestWorkflowTest passed");
    }

    private static void assertEquals(Object expected, Object actual, String label) {
        if (!expected.equals(actual)) {
            throw new AssertionError(label + " expected <" + expected + "> but was <" + actual + ">");
        }
    }

    private static void assertTrue(boolean condition, String label) {
        if (!condition) {
            throw new AssertionError(label + " expected true");
        }
    }

    private static void assertNotBlank(String value, String label) {
        if (value == null || value.isBlank()) {
            throw new AssertionError(label + " must not be blank");
        }
    }

    private static final class SequentialIdGenerator implements IdGenerator {
        private final AtomicInteger next = new AtomicInteger(1);

        @Override
        public String nextId(String prefix) {
            return prefix + "-" + next.getAndIncrement();
        }
    }
}
