package com.restartquest.application;

import com.restartquest.domain.DailyQuest;
import com.restartquest.domain.EnergyLevel;
import com.restartquest.domain.FailureReason;
import com.restartquest.domain.OnboardingProfile;
import com.restartquest.domain.QuestStatus;
import com.restartquest.infrastructure.MockQuestAiClient;
import java.util.List;

public final class CoreFlowTest {
    private CoreFlowTest() {
    }

    public static void main(String[] args) {
        InMemoryRestartQuestStore store = new InMemoryRestartQuestStore();
        MockQuestAiClient questAiClient = new MockQuestAiClient();

        OnboardingService onboardingService = new OnboardingService(store);
        GenerateDailyQuestService generateService = new GenerateDailyQuestService(store, questAiClient);
        CompleteQuestService completeService = new CompleteQuestService(store);
        FailQuestService failService = new FailQuestService(store);
        RedesignQuestService redesignService = new RedesignQuestService(store, questAiClient);
        GetDashboardService dashboardService = new GetDashboardService(store);

        onboardingService.save(new OnboardingProfile(
                "demo-user",
                "Seoul",
                "Backend Developer",
                "Remote",
                8,
                true,
                false,
                List.of("Java", "Spring"),
                EnergyLevel.LOW
        ));

        List<DailyQuest> generatedQuests = generateService.generateForToday();
        assertEquals(3, generatedQuests.size(), "three daily quests are generated");
        assertTrue(
                generatedQuests.get(0).title().contains("Backend Developer"),
                "generated quest reflects onboarding desiredJob"
        );

        DailyQuest completedQuest = completeService.complete(generatedQuests.get(0).id());
        assertEquals(QuestStatus.DONE, completedQuest.status(), "quest is completed");

        DailyQuest failedQuest = failService.fail(
                generatedQuests.get(1).id(),
                FailureReason.NOT_SURE_WHAT_TO_WRITE,
                "Need a smaller start"
        );
        assertEquals(QuestStatus.FAILED, failedQuest.status(), "quest is failed before redesign");

        RedesignResult redesignResult = redesignService.redesign(
                failedQuest.id(),
                FailureReason.NOT_SURE_WHAT_TO_WRITE
        );
        assertEquals(QuestStatus.REDESIGNED, redesignResult.originalQuest().status(), "original quest is marked redesigned");
        assertEquals(3, redesignResult.redesignedQuests().size(), "redesign returns three smaller quests");
        for (DailyQuest redesignedQuest : redesignResult.redesignedQuests()) {
            assertEquals(failedQuest.id(), redesignedQuest.parentQuestId(), "redesigned quest is linked");
            assertTrue(
                    redesignedQuest.difficulty().isEasierThan(failedQuest.difficulty()),
                    "redesigned difficulty is lower"
            );
            assertTrue(
                    redesignedQuest.estimatedMinutes() < failedQuest.estimatedMinutes(),
                    "redesigned estimated minutes are lower"
            );
        }

        DashboardSummary dashboard = dashboardService.getTodaySummary();
        assertEquals(3, dashboard.totalOriginalQuests(), "dashboard original quest count");
        assertEquals(1, dashboard.doneCount(), "dashboard done count");
        assertEquals(1, dashboard.failedCount(), "dashboard failed/redesigned original count");
        assertEquals(3, dashboard.redesignedCount(), "dashboard redesigned count");
        assertEquals(redesignResult.redesignedQuests().get(0).id(), dashboard.nextAction().id(), "next action is redesigned");
        assertEquals(1, dashboard.redesignHistory().size(), "dashboard redesign history");

        assertThrows(
                IllegalArgumentException.class,
                () -> DailyQuest.original(
                        "bad",
                        "Bad quest",
                        "Invalid estimated minutes",
                        generatedQuests.get(0).category(),
                        generatedQuests.get(0).difficulty(),
                        31,
                        "Never valid"
                ),
                "estimatedMinutes upper bound is validated"
        );

        System.out.println("CoreFlowTest passed");
    }

    private static void assertEquals(Object expected, Object actual, String message) {
        if (!expected.equals(actual)) {
            throw new AssertionError(message + " expected <" + expected + "> but was <" + actual + ">");
        }
    }

    private static void assertTrue(boolean condition, String message) {
        if (!condition) {
            throw new AssertionError(message);
        }
    }

    private static void assertThrows(Class<? extends Throwable> expectedType, Runnable action, String message) {
        try {
            action.run();
        } catch (Throwable throwable) {
            if (expectedType.isInstance(throwable)) {
                return;
            }
            throw new AssertionError(message + " threw " + throwable.getClass().getSimpleName(), throwable);
        }
        throw new AssertionError(message + " did not throw");
    }
}
