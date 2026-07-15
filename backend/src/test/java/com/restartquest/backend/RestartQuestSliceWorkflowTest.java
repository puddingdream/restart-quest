package com.restartquest.backend;

import com.restartquest.backend.application.ClockProvider;
import com.restartquest.backend.application.GenerateDailyQuestService;
import com.restartquest.backend.application.IdGenerator;
import com.restartquest.backend.application.QuestAiClient;
import com.restartquest.backend.application.QuestDraft;
import com.restartquest.backend.application.QuestPlan;
import com.restartquest.backend.application.RedesignQuestService;
import com.restartquest.backend.application.RestartQuestStore;
import com.restartquest.backend.application.SubmitOnboardingService;
import com.restartquest.backend.domain.DailyQuest;
import com.restartquest.backend.domain.FailureReason;
import com.restartquest.backend.domain.OnboardingProfile;
import com.restartquest.backend.domain.QuestCategory;
import com.restartquest.backend.domain.QuestDifficulty;
import com.restartquest.backend.domain.QuestStatus;
import com.restartquest.backend.infrastructure.InMemoryRestartQuestStore;
import com.restartquest.backend.infrastructure.SequentialIdGenerator;
import com.restartquest.backend.presentation.RestartQuestApi;
import com.restartquest.backend.presentation.dto.DashboardResponse;
import com.restartquest.backend.presentation.dto.OnboardingProfileRequest;
import com.restartquest.backend.presentation.dto.QuestFailureRequest;
import com.restartquest.backend.presentation.dto.QuestRedesignResponse;
import com.restartquest.backend.presentation.dto.QuestResponse;
import com.restartquest.backend.presentation.dto.TodayQuestsResponse;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;

public final class RestartQuestSliceWorkflowTest {
    private static final Clock FIXED_CLOCK = Clock.fixed(Instant.parse("2026-07-15T00:30:00Z"), ZoneOffset.UTC);

    public static void main(String[] args) {
        verifiesCoreReentryLoop();
        rejectsInvalidEnumAndQuestMinutes();
        rejectsRedesignThatIsNotEasier();
        System.out.println("RestartQuestSliceWorkflowTest passed");
    }

    private static void verifiesCoreReentryLoop() {
        RestartQuestApi api = RestartQuestApi.createDefault(FIXED_CLOCK);
        api.postOnboarding(new OnboardingProfileRequest(
                "Seoul",
                "Backend developer",
                "FULL_TIME",
                8,
                true,
                false,
                List.of("Java", "Spring"),
                "LOW"
        ));

        TodayQuestsResponse generated = api.postGenerateQuests();
        assertEquals(3, generated.quests().size(), "generated quest count");
        assertTrue(generated.quests().stream().allMatch(quest -> quest.status() == QuestStatus.TODO), "initial TODO status");
        assertTrue(generated.quests().get(0).title().contains("Backend developer"), "profile role reflected");
        assertTrue(generated.quests().stream().allMatch(quest -> quest.estimatedMinutes() >= 5 && quest.estimatedMinutes() <= 30), "minutes range");

        QuestResponse completed = api.patchCompleteQuest(generated.quests().get(0).id());
        assertEquals(QuestStatus.DONE, completed.status(), "complete status");

        QuestResponse failed = api.patchFailQuest(
                generated.quests().get(1).id(),
                new QuestFailureRequest("NOT_SURE_WHAT_TO_WRITE", "Need a smaller writing start.")
        );
        assertEquals(QuestStatus.FAILED, failed.status(), "failure status");

        QuestRedesignResponse redesign = api.postRedesignQuest(
                failed.id(),
                new QuestFailureRequest("NOT_SURE_WHAT_TO_WRITE", "Need a smaller writing start.")
        );
        assertEquals(QuestStatus.REDESIGNED, redesign.originalQuest().status(), "original redesign status");
        assertEquals(3, redesign.redesignedQuests().size(), "redesign count");
        assertTrue(redesign.redesignedQuests().stream().allMatch(quest -> failed.id().equals(quest.parentQuestId())), "redesign parent link");
        assertTrue(redesign.redesignedQuests().stream().allMatch(quest -> quest.difficulty().isEasierThan(failed.difficulty())), "redesign difficulty lower");
        assertTrue(redesign.redesignedQuests().stream().allMatch(quest -> quest.estimatedMinutes() < failed.estimatedMinutes()), "redesign minutes lower");

        DashboardResponse dashboard = api.getDashboard();
        assertEquals(3, dashboard.originalQuestCount(), "dashboard original count");
        assertEquals(1, dashboard.doneCount(), "dashboard done count");
        assertEquals(1, dashboard.failureCount(), "dashboard failure count");
        assertEquals(3, dashboard.redesignedQuestCount(), "dashboard redesigned count");
        assertEquals(33, dashboard.progressPercent(), "dashboard progress");
        assertNotNull(dashboard.nextAction(), "dashboard next action");
        assertEquals(failed.id(), dashboard.nextAction().parentQuestId(), "next action uses redesign");
        assertEquals(1, dashboard.recentRedesigns().size(), "dashboard redesign history");

        TodayQuestsResponse today = api.getTodayQuests();
        assertEquals(6, today.quests().size(), "today includes original and redesigned quests");
    }

    private static void rejectsInvalidEnumAndQuestMinutes() {
        assertThrows(IllegalArgumentException.class, () -> RestartQuestApi.createDefault(FIXED_CLOCK).postOnboarding(
                new OnboardingProfileRequest(
                        "Seoul",
                        "Backend developer",
                        "FULL_TIME",
                        1,
                        true,
                        true,
                        List.of(),
                        "TIRED"
                )
        ), "invalid energy enum");

        assertThrows(IllegalArgumentException.class, () -> new DailyQuest(
                "quest-bad",
                null,
                "Bad minutes",
                "This should be rejected.",
                QuestCategory.ROUTINE,
                QuestDifficulty.EASY,
                31,
                "Rejected by range validation",
                QuestStatus.TODO,
                1,
                LocalDate.of(2026, 7, 15),
                FIXED_CLOCK.instant().atZone(ZoneOffset.UTC).toLocalDateTime(),
                null
        ), "quest minute range");
    }

    private static void rejectsRedesignThatIsNotEasier() {
        RestartQuestStore store = new InMemoryRestartQuestStore();
        IdGenerator idGenerator = new SequentialIdGenerator();
        ClockProvider clockProvider = new ClockProvider(FIXED_CLOCK);
        SubmitOnboardingService submit = new SubmitOnboardingService(store, idGenerator, clockProvider);
        submit.submit(new com.restartquest.backend.application.OnboardingCommand(
                "Seoul",
                "Backend developer",
                "FULL_TIME",
                3,
                true,
                true,
                List.of("Java"),
                com.restartquest.backend.domain.EnergyLevel.LOW
        ));

        QuestAiClient badAi = new QuestAiClient() {
            @Override
            public QuestPlan generateDailyQuests(OnboardingProfile profile, LocalDate questDate) {
                return new QuestPlan(List.of(
                        new QuestDraft("Original one", "Original one description", QuestCategory.RESUME, QuestDifficulty.EASY, 10, "Done one"),
                        new QuestDraft("Original two", "Original two description", QuestCategory.JOB_SEARCH, QuestDifficulty.EASY, 10, "Done two"),
                        new QuestDraft("Original three", "Original three description", QuestCategory.INTERVIEW, QuestDifficulty.TINY, 8, "Done three")
                ));
            }

            @Override
            public QuestPlan redesignQuest(DailyQuest originalQuest, FailureReason failureReason, OnboardingProfile profile, LocalDate questDate) {
                return new QuestPlan(List.of(new QuestDraft(
                        "Not easier",
                        "This keeps the same size and must be rejected.",
                        originalQuest.category(),
                        originalQuest.difficulty(),
                        originalQuest.estimatedMinutes(),
                        "Should not be accepted"
                )));
            }
        };

        GenerateDailyQuestService generate = new GenerateDailyQuestService(store, badAi, idGenerator, clockProvider);
        DailyQuest target = generate.generateToday().get(0).fail();
        store.saveQuest(target);

        RedesignQuestService redesign = new RedesignQuestService(store, badAi, idGenerator, clockProvider);
        assertThrows(IllegalStateException.class, () -> redesign.redesign(
                target.id(),
                FailureReason.TOO_BIG,
                "Too large"
        ), "redesign lower difficulty policy");
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

    private static void assertNotNull(Object value, String label) {
        if (value == null) {
            throw new AssertionError(label + " must not be null");
        }
    }

    private static void assertThrows(Class<? extends Throwable> expectedType, Runnable action, String label) {
        try {
            action.run();
        } catch (Throwable actual) {
            if (expectedType.isInstance(actual)) {
                return;
            }
            throw new AssertionError(label + " expected exception <" + expectedType.getSimpleName() + "> but was <" + actual.getClass().getSimpleName() + ">");
        }
        throw new AssertionError(label + " expected exception <" + expectedType.getSimpleName() + ">");
    }
}
