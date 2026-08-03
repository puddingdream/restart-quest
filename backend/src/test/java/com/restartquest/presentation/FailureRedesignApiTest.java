package com.restartquest.presentation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.restartquest.application.ai.GeneratedQuestBatch;
import com.restartquest.application.ai.QuestAiException;
import com.restartquest.application.ai.QuestDraft;
import com.restartquest.application.ai.QuestGenerationRequest;
import com.restartquest.application.ai.QuestRedesignRequest;
import com.restartquest.application.ai.RedesignedQuest;
import com.restartquest.application.port.OnboardingProfileStore;
import com.restartquest.application.port.QuestAiClient;
import com.restartquest.application.port.QuestPlanStore;
import com.restartquest.application.port.UserStore;
import com.restartquest.domain.quest.DailyQuestPlan;
import com.restartquest.domain.quest.EnergyLevel;
import com.restartquest.domain.quest.QuestCategory;
import com.restartquest.domain.quest.QuestDifficulty;
import com.restartquest.domain.quest.QuestJourney;
import com.restartquest.domain.quest.QuestRedesignReasonCode;
import com.restartquest.domain.quest.QuestSeed;
import com.restartquest.domain.quest.QuestStatus;
import com.restartquest.domain.user.DesiredWorkType;
import com.restartquest.domain.user.InterviewExperience;
import com.restartquest.domain.user.OnboardingProfile;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@SpringBootTest
@AutoConfigureMockMvc
@Import(FailureRedesignApiTest.StubAiConfiguration.class)
class FailureRedesignApiTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private QuestPlanStore questPlanStore;

    @Autowired
    private OnboardingProfileStore onboardingProfileStore;

    @Autowired
    private UserStore userStore;

    @Autowired
    private StubQuestAiClient questAiClient;

    @BeforeEach
    void resetAiClient() {
        questAiClient.use(StubMode.SUCCESS);
    }

    @Test
    void redesignsCurrentQuestAndReturnsCanonicalJourneyWithRedesignRecord() throws Exception {
        SignedInUser user = signupAndOnboard("redesign-success@example.com");
        QuestJourney journey = savePlan(user.userId()).getJourneys().get(0);
        UUID originalQuestId = journey.getCurrentQuestId();

        MvcResult response = mockMvc.perform(post("/api/v1/quests/{questId}/failure-redesign", originalQuestId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(user.accessToken()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "reasonCode": "MATERIALS_MISSING",
                                  "reasonNote": "  준비 자료 위치를 못 찾았어요.  "
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.journeyId").value(journey.getId().toString()))
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.currentQuest.parentQuestId").value(originalQuestId.toString()))
                .andExpect(jsonPath("$.currentQuest.revision").value(1))
                .andExpect(jsonPath("$.currentQuest.category").value("JOB_SEARCH"))
                .andExpect(jsonPath("$.currentQuest.estimatedMinutes").value(5))
                .andExpect(jsonPath("$.currentQuest.steps.length()").value(1))
                .andExpect(jsonPath("$.currentQuest.status").value("TODO"))
                .andExpect(jsonPath("$.history.length()").value(1))
                .andExpect(jsonPath("$.history[0].questId").value(originalQuestId.toString()))
                .andExpect(jsonPath("$.history[0].status").value("REDESIGNED"))
                .andExpect(jsonPath("$.redesign.originalQuestId").value(originalQuestId.toString()))
                .andExpect(jsonPath("$.redesign.reasonCode").value("MATERIALS_MISSING"))
                .andExpect(jsonPath("$.redesign.reasonNote").value("준비 자료 위치를 못 찾았어요."))
                .andReturn();
        String responseBody = response.getResponse().getContentAsString();
        assertThat(JsonPath.<String>read(responseBody, "$.redesign.replacementQuestId"))
                .isEqualTo(JsonPath.read(responseBody, "$.currentQuest.questId"));

        QuestJourney reloaded = questPlanStore.findJourneyForUser(user.userId(), journey.getId()).orElseThrow();
        assertThat(reloaded.getQuests()).hasSize(2);
        assertThat(reloaded.getQuests().get(0).getStatus()).isEqualTo(QuestStatus.REDESIGNED);
        assertThat(reloaded.getCurrentQuest().getCategory()).isEqualTo(QuestCategory.JOB_SEARCH);
        assertThat(reloaded.getCurrentQuest().getEstimatedMinutes()).isEqualTo(5);
        assertThat(reloaded.getRedesigns()).singleElement().satisfies(redesign -> {
            assertThat(redesign.getOriginalQuestId()).isEqualTo(originalQuestId);
            assertThat(redesign.getReplacementQuestId()).isEqualTo(reloaded.getCurrentQuestId());
            assertThat(redesign.getReasonCode()).isEqualTo(QuestRedesignReasonCode.MATERIALS_MISSING);
            assertThat(redesign.getReasonNote()).isEqualTo("준비 자료 위치를 못 찾았어요.");
        });
    }

    @Test
    void acceptsEveryReasonCode() throws Exception {
        SignedInUser user = signupAndOnboard("all-reasons@example.com");
        QuestJourney journey = savePlan(user.userId()).getJourneys().get(0);
        UUID currentQuestId = journey.getCurrentQuestId();

        for (QuestRedesignReasonCode reasonCode : QuestRedesignReasonCode.values()) {
            MvcResult result = mockMvc.perform(post("/api/v1/quests/{questId}/failure-redesign", currentQuestId)
                            .header(HttpHeaders.AUTHORIZATION, bearer(user.accessToken()))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"reasonCode":"%s"}
                                    """.formatted(reasonCode.name())))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.redesign.reasonCode").value(reasonCode.name()))
                    .andReturn();
            currentQuestId = UUID.fromString(JsonPath.read(
                    result.getResponse().getContentAsString(),
                    "$.currentQuest.questId"
            ));
        }

        QuestJourney reloaded = questPlanStore.findJourneyForUser(user.userId(), journey.getId()).orElseThrow();
        assertThat(reloaded.getRedesigns()).hasSize(QuestRedesignReasonCode.values().length);
        assertThat(reloaded.getQuests()).hasSize(QuestRedesignReasonCode.values().length + 1);
        assertThat(reloaded.getCurrentQuest().getEstimatedMinutes()).isEqualTo(5);
    }

    @Test
    void validatesReasonCodeAndOptionalNoteLength() throws Exception {
        SignedInUser user = signupAndOnboard("redesign-validation@example.com");
        QuestJourney journey = savePlan(user.userId()).getJourneys().get(0);
        UUID questId = journey.getCurrentQuestId();

        mockMvc.perform(post("/api/v1/quests/not-a-uuid/failure-redesign")
                        .header(HttpHeaders.AUTHORIZATION, bearer(user.accessToken()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reasonCode\":\"LOW_ENERGY\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("questId"))
                .andExpect(jsonPath("$.fieldErrors[0].reason").isNotEmpty());

        mockMvc.perform(post("/api/v1/quests/{questId}/failure-redesign", questId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(user.accessToken()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("reasonCode"));

        mockMvc.perform(post("/api/v1/quests/{questId}/failure-redesign", questId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(user.accessToken()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"reasonCode":"UNKNOWN_REASON"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("reasonCode"));

        mockMvc.perform(post("/api/v1/quests/{questId}/failure-redesign", questId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(user.accessToken()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(reasonRequest("OTHER", "가".repeat(301))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors[0].field").value("reasonNote"));

        mockMvc.perform(post("/api/v1/quests/{questId}/failure-redesign", questId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(user.accessToken()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(reasonRequest("OTHER", "가".repeat(300))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.redesign.reasonNote").value("가".repeat(300)));
    }

    @Test
    void hidesOwnershipAndLeavesOtherUsersQuestUnchanged() throws Exception {
        SignedInUser owner = signupAndOnboard("redesign-owner@example.com");
        SignedInUser other = signupAndOnboard("redesign-other@example.com");
        QuestJourney journey = savePlan(owner.userId()).getJourneys().get(0);
        UUID questId = journey.getCurrentQuestId();

        mockMvc.perform(post("/api/v1/quests/{questId}/failure-redesign", questId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(other.accessToken()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"reasonCode":"LOW_ENERGY"}
                                """))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("QUEST_NOT_FOUND"));

        mockMvc.perform(post("/api/v1/quests/{questId}/failure-redesign", UUID.randomUUID())
                        .header(HttpHeaders.AUTHORIZATION, bearer(other.accessToken()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"reasonCode":"LOW_ENERGY"}
                                """))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("QUEST_NOT_FOUND"));

        assertUnchanged(owner.userId(), journey.getId(), questId);
    }

    @Test
    void mapsInvalidAndProviderErrorsWithoutPartialChanges() throws Exception {
        SignedInUser user = signupAndOnboard("redesign-ai-errors@example.com");
        QuestJourney journey = savePlan(user.userId()).getJourneys().get(0);
        UUID questId = journey.getCurrentQuestId();
        List<ExpectedError> errors = List.of(
                new ExpectedError(StubMode.INVALID_OUTPUT, 502, "AI_INVALID_RESPONSE"),
                new ExpectedError(StubMode.QUOTA, 429, "AI_QUOTA_EXCEEDED"),
                new ExpectedError(StubMode.UNAVAILABLE, 503, "AI_PROVIDER_UNAVAILABLE"),
                new ExpectedError(StubMode.TIMEOUT, 504, "AI_PROVIDER_TIMEOUT")
        );

        for (ExpectedError expected : errors) {
            questAiClient.use(expected.mode());
            mockMvc.perform(post("/api/v1/quests/{questId}/failure-redesign", questId)
                            .header(HttpHeaders.AUTHORIZATION, bearer(user.accessToken()))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"reasonCode":"START_POINT_UNCLEAR"}
                                    """))
                    .andExpect(status().is(expected.status()))
                    .andExpect(jsonPath("$.code").value(expected.code()));
            assertUnchanged(user.userId(), journey.getId(), questId);
        }

        questAiClient.use(StubMode.SUCCESS);
        mockMvc.perform(post("/api/v1/quests/{questId}/failure-redesign", questId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(user.accessToken()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"reasonCode":"START_POINT_UNCLEAR"}
                                """))
                .andExpect(status().isOk());
    }

    @Test
    void concurrentRedesignRequestsAllowOnlyOneSuccess() throws Exception {
        SignedInUser user = signupAndOnboard("redesign-concurrency@example.com");
        QuestJourney journey = savePlan(user.userId()).getJourneys().get(0);
        UUID questId = journey.getCurrentQuestId();
        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);

        try {
            List<Future<MvcResult>> futures = new ArrayList<>();
            for (int index = 0; index < 2; index++) {
                futures.add(executor.submit(() -> {
                    ready.countDown();
                    start.await(5, TimeUnit.SECONDS);
                    return mockMvc.perform(post("/api/v1/quests/{questId}/failure-redesign", questId)
                                    .header(HttpHeaders.AUTHORIZATION, bearer(user.accessToken()))
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content("""
                                            {"reasonCode":"TASK_TOO_LARGE"}
                                            """))
                            .andReturn();
                }));
            }
            assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
            start.countDown();

            List<Integer> statuses = new ArrayList<>();
            for (Future<MvcResult> future : futures) {
                statuses.add(future.get(10, TimeUnit.SECONDS).getResponse().getStatus());
            }
            assertThat(statuses).containsExactlyInAnyOrder(200, 409);
            assertThat(questAiClient.hadActiveTransactionDuringRedesign()).isFalse();
        } finally {
            start.countDown();
            executor.shutdownNow();
        }

        QuestJourney reloaded = questPlanStore.findJourneyForUser(user.userId(), journey.getId()).orElseThrow();
        assertThat(reloaded.getQuests()).hasSize(2);
        assertThat(reloaded.getRedesigns()).hasSize(1);
        assertThat(reloaded.getQuests().stream()
                .filter(quest -> quest.getStatus() == QuestStatus.TODO))
                .hasSize(1);
    }

    private SignedInUser signupAndOnboard(String email) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"password123!","name":"테스트 사용자"}
                                """.formatted(email)))
                .andExpect(status().isCreated())
                .andReturn();
        String token = JsonPath.read(result.getResponse().getContentAsString(), "$.accessToken");
        UUID userId = userStore.findByEmail(email).orElseThrow().getId();
        OnboardingProfile profile = OnboardingProfile.create(userId);
        profile.update(
                "백엔드 개발자",
                "서울",
                DesiredWorkType.FULL_TIME,
                12,
                true,
                InterviewExperience.LIMITED
        );
        onboardingProfileStore.save(profile);
        return new SignedInUser(userId, token);
    }

    private DailyQuestPlan savePlan(UUID userId) {
        return questPlanStore.saveForUser(userId, DailyQuestPlan.create(
                userId,
                LocalDate.of(2026, 8, 3),
                EnergyLevel.MEDIUM,
                List.of(
                        initialSeed("공고 제목 보기"),
                        initialSeed("이력서 열기"),
                        initialSeed("답변 키워드 보기")
                )
        ));
    }

    private void assertUnchanged(UUID userId, UUID journeyId, UUID questId) {
        QuestJourney reloaded = questPlanStore.findJourneyForUser(userId, journeyId).orElseThrow();
        assertThat(reloaded.getCurrentQuestId()).isEqualTo(questId);
        assertThat(reloaded.getCurrentQuest().getStatus()).isEqualTo(QuestStatus.TODO);
        assertThat(reloaded.getQuests()).hasSize(1);
        assertThat(reloaded.getRedesigns()).isEmpty();
    }

    private static QuestSeed initialSeed(String title) {
        return new QuestSeed(
                title,
                "오늘 할 작은 행동입니다.",
                "한 줄을 기록합니다.",
                List.of("자료 열기", "조건 한 줄 적기"),
                QuestCategory.JOB_SEARCH,
                QuestDifficulty.MEDIUM,
                10,
                true
        );
    }

    private static String reasonRequest(String reasonCode, String reasonNote) {
        return """
                {"reasonCode":"%s","reasonNote":"%s"}
                """.formatted(reasonCode, reasonNote);
    }

    private static String bearer(String token) {
        return "Bearer " + token;
    }

    private record SignedInUser(UUID userId, String accessToken) {
    }

    private record ExpectedError(StubMode mode, int status, String code) {
    }

    enum StubMode {
        SUCCESS,
        INVALID_OUTPUT,
        QUOTA,
        UNAVAILABLE,
        TIMEOUT
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class StubAiConfiguration {

        @Bean
        @Primary
        StubQuestAiClient stubQuestAiClient() {
            return new StubQuestAiClient();
        }
    }

    static class StubQuestAiClient implements QuestAiClient {

        private final AtomicReference<StubMode> mode = new AtomicReference<>(StubMode.SUCCESS);
        private final AtomicBoolean activeTransactionObserved = new AtomicBoolean();

        void use(StubMode nextMode) {
            activeTransactionObserved.set(false);
            mode.set(nextMode);
        }

        boolean hadActiveTransactionDuringRedesign() {
            return activeTransactionObserved.get();
        }

        @Override
        public GeneratedQuestBatch generateDailyQuests(QuestGenerationRequest request) {
            throw new UnsupportedOperationException("이 테스트는 일일 생성을 호출하지 않습니다.");
        }

        @Override
        public RedesignedQuest redesignQuest(QuestRedesignRequest request) {
            if (TransactionSynchronizationManager.isActualTransactionActive()) {
                activeTransactionObserved.set(true);
            }
            return switch (mode.get()) {
                case SUCCESS -> successfulRedesign(request);
                case INVALID_OUTPUT -> throw new IllegalArgumentException("검증되지 않은 AI 출력");
                case QUOTA -> throw QuestAiException.quotaExceeded();
                case UNAVAILABLE -> throw QuestAiException.providerUnavailable();
                case TIMEOUT -> throw QuestAiException.providerTimeout();
            };
        }

        private RedesignedQuest successfulRedesign(QuestRedesignRequest request) {
            return RedesignedQuest.validate(new QuestDraft(
                        "첫 단계만 시작하기",
                        "원래 목적을 유지하고 범위를 줄인 행동입니다.",
                        "첫 단계 하나를 마칩니다.",
                        List.of("자료 하나만 열기"),
                        request.originalQuest().category(),
                        QuestDifficulty.EASY,
                        5
                ), request);
        }
    }
}
