package com.restartquest.backend.presentation;

import com.restartquest.backend.application.ClockProvider;
import com.restartquest.backend.application.CompleteQuestService;
import com.restartquest.backend.application.FailQuestService;
import com.restartquest.backend.application.GenerateDailyQuestService;
import com.restartquest.backend.application.GetDashboardService;
import com.restartquest.backend.application.IdGenerator;
import com.restartquest.backend.application.RedesignQuestService;
import com.restartquest.backend.application.RestartQuestStore;
import com.restartquest.backend.application.SubmitOnboardingService;
import com.restartquest.backend.domain.FailureReason;
import com.restartquest.backend.domain.OnboardingProfile;
import com.restartquest.backend.infrastructure.InMemoryRestartQuestStore;
import com.restartquest.backend.infrastructure.MockQuestAiClient;
import com.restartquest.backend.infrastructure.SequentialIdGenerator;
import com.restartquest.backend.presentation.dto.DashboardResponse;
import com.restartquest.backend.presentation.dto.OnboardingProfileRequest;
import com.restartquest.backend.presentation.dto.OnboardingProfileResponse;
import com.restartquest.backend.presentation.dto.QuestFailureRequest;
import com.restartquest.backend.presentation.dto.QuestRedesignResponse;
import com.restartquest.backend.presentation.dto.QuestResponse;
import com.restartquest.backend.presentation.dto.TodayQuestsResponse;
import java.time.Clock;
import java.util.Objects;

public final class RestartQuestApi {
    private final RestartQuestStore store;
    private final SubmitOnboardingService submitOnboardingService;
    private final GenerateDailyQuestService generateDailyQuestService;
    private final CompleteQuestService completeQuestService;
    private final FailQuestService failQuestService;
    private final RedesignQuestService redesignQuestService;
    private final GetDashboardService getDashboardService;

    public RestartQuestApi(
            RestartQuestStore store,
            SubmitOnboardingService submitOnboardingService,
            GenerateDailyQuestService generateDailyQuestService,
            CompleteQuestService completeQuestService,
            FailQuestService failQuestService,
            RedesignQuestService redesignQuestService,
            GetDashboardService getDashboardService
    ) {
        this.store = Objects.requireNonNull(store, "store");
        this.submitOnboardingService = Objects.requireNonNull(submitOnboardingService, "submitOnboardingService");
        this.generateDailyQuestService = Objects.requireNonNull(generateDailyQuestService, "generateDailyQuestService");
        this.completeQuestService = Objects.requireNonNull(completeQuestService, "completeQuestService");
        this.failQuestService = Objects.requireNonNull(failQuestService, "failQuestService");
        this.redesignQuestService = Objects.requireNonNull(redesignQuestService, "redesignQuestService");
        this.getDashboardService = Objects.requireNonNull(getDashboardService, "getDashboardService");
    }

    public static RestartQuestApi createDefault(Clock clock) {
        RestartQuestStore store = new InMemoryRestartQuestStore();
        IdGenerator idGenerator = new SequentialIdGenerator();
        ClockProvider clockProvider = new ClockProvider(clock);
        MockQuestAiClient questAiClient = new MockQuestAiClient();
        return new RestartQuestApi(
                store,
                new SubmitOnboardingService(store, idGenerator, clockProvider),
                new GenerateDailyQuestService(store, questAiClient, idGenerator, clockProvider),
                new CompleteQuestService(store, clockProvider),
                new FailQuestService(store, idGenerator, clockProvider),
                new RedesignQuestService(store, questAiClient, idGenerator, clockProvider),
                new GetDashboardService(store, clockProvider)
        );
    }

    public OnboardingProfileResponse postOnboarding(OnboardingProfileRequest request) {
        return OnboardingProfileResponse.from(submitOnboardingService.submit(request.toCommand()));
    }

    public OnboardingProfileResponse getOnboardingMe() {
        OnboardingProfile profile = store.findProfile()
                .orElseThrow(() -> new IllegalStateException("onboarding profile is not set"));
        return OnboardingProfileResponse.from(profile);
    }

    public TodayQuestsResponse postGenerateQuests() {
        return TodayQuestsResponse.from(generateDailyQuestService.generateToday());
    }

    public TodayQuestsResponse getTodayQuests() {
        return TodayQuestsResponse.from(store.findQuestsByDate(getDashboardService.getToday().questDate()));
    }

    public QuestResponse patchCompleteQuest(String questId) {
        return QuestResponse.from(completeQuestService.complete(questId));
    }

    public QuestResponse patchFailQuest(String questId, QuestFailureRequest request) {
        return QuestResponse.from(failQuestService.fail(
                questId,
                FailureReason.parse(request.failureReason()),
                request.note()
        ).quest());
    }

    public QuestRedesignResponse postRedesignQuest(String questId, QuestFailureRequest request) {
        return QuestRedesignResponse.from(redesignQuestService.redesign(
                questId,
                FailureReason.parse(request.failureReason()),
                request.note()
        ));
    }

    public DashboardResponse getDashboard() {
        return DashboardResponse.from(getDashboardService.getToday());
    }
}
