package com.restartquest.presentation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.restartquest.application.ai.GeneratedQuestBatch;
import com.restartquest.application.ai.QuestAiException;
import com.restartquest.application.ai.QuestDraft;
import com.restartquest.application.port.QuestAiClient;
import com.restartquest.application.port.QuestPlanStore;
import com.restartquest.application.port.UserStore;
import com.restartquest.domain.quest.QuestCategory;
import com.restartquest.domain.quest.QuestDifficulty;
import com.restartquest.domain.quest.QuestJourney;
import com.restartquest.domain.quest.QuestRedesignReasonCode;
import com.restartquest.domain.quest.QuestSeed;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashSet;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
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
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
@Import(DailyQuestApiTest.FixedQuestClockConfiguration.class)
class DailyQuestApiTest {

    private static final String QUEST_DATE = "2026-08-03";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private QuestPlanStore questPlanStore;

    @Autowired
    private UserStore userStore;

    @MockitoBean
    private QuestAiClient questAiClient;

    @BeforeEach
    void configureValidAiOutput() {
        when(questAiClient.generateDailyQuests(any())).thenReturn(validBatch());
    }

    @Test
    void returnsEmptyStateThenCreatesAndIdempotentlyReadsSameThreeJourneys() throws Exception {
        String token = signupAndOnboard("daily-idempotent@example.com");

        mockMvc.perform(get("/api/v1/quests/today").header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.date").value(QUEST_DATE))
                .andExpect(jsonPath("$.generatedNow").value(false))
                .andExpect(jsonPath("$.journeys").isEmpty());

        MvcResult generated = generate(token, "LOW")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.date").value(QUEST_DATE))
                .andExpect(jsonPath("$.energyLevel").value("LOW"))
                .andExpect(jsonPath("$.generatedNow").value(true))
                .andExpect(jsonPath("$.journeys.length()").value(3))
                .andExpect(jsonPath("$.journeys[0].status").value("ACTIVE"))
                .andExpect(jsonPath("$.journeys[0].currentQuest.status").value("TODO"))
                .andExpect(jsonPath("$.journeys[0].currentQuest.generatedByAi").value(true))
                .andExpect(jsonPath("$.journeys[0].history").isEmpty())
                .andReturn();
        List<String> generatedJourneyIds = journeyIds(generated);

        MvcResult repeated = generate(token, "HIGH")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.energyLevel").value("LOW"))
                .andExpect(jsonPath("$.generatedNow").value(false))
                .andExpect(jsonPath("$.journeys.length()").value(3))
                .andReturn();

        MvcResult queried = mockMvc.perform(get("/api/v1/quests/today")
                        .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.generatedNow").value(false))
                .andExpect(jsonPath("$.journeys.length()").value(3))
                .andReturn();

        assertThat(journeyIds(repeated)).containsExactlyElementsOf(generatedJourneyIds);
        assertThat(journeyIds(queried)).containsExactlyElementsOf(generatedJourneyIds);
        verify(questAiClient, times(1)).generateDailyQuests(any());
    }

    @Test
    void requiresOnboardingBeforeQueryOrGeneration() throws Exception {
        String token = signup("daily-onboarding-required@example.com");

        mockMvc.perform(get("/api/v1/quests/today").header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ONBOARDING_REQUIRED"));
        generate(token, "MEDIUM")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ONBOARDING_REQUIRED"));

        verify(questAiClient, times(0)).generateDailyQuests(any());
    }

    @Test
    void eachAuthenticatedUserReadsOnlyTheirOwnDailyPlan() throws Exception {
        String firstToken = signupAndOnboard("daily-owner-a@example.com");
        String secondToken = signupAndOnboard("daily-owner-b@example.com");

        List<String> firstIds = journeyIds(generate(firstToken, "LOW").andReturn());
        List<String> secondIds = journeyIds(generate(secondToken, "HIGH").andReturn());

        MvcResult firstRead = mockMvc.perform(get("/api/v1/quests/today")
                        .header(HttpHeaders.AUTHORIZATION, bearer(firstToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.energyLevel").value("LOW"))
                .andReturn();
        MvcResult secondRead = mockMvc.perform(get("/api/v1/quests/today")
                        .header(HttpHeaders.AUTHORIZATION, bearer(secondToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.energyLevel").value("HIGH"))
                .andReturn();

        assertThat(new HashSet<>(firstIds)).doesNotContainAnyElementsOf(secondIds);
        assertThat(journeyIds(firstRead)).containsExactlyElementsOf(firstIds);
        assertThat(journeyIds(secondRead)).containsExactlyElementsOf(secondIds);
    }

    @Test
    void getTodayRestoresCurrentQuestAndPreviousRevisionHistory() throws Exception {
        String email = "daily-history@example.com";
        String token = signupAndOnboard(email);
        MvcResult generated = generate(token, "MEDIUM").andReturn();
        String originalQuestId = JsonPath.read(
                generated.getResponse().getContentAsString(),
                "$.journeys[0].currentQuest.questId"
        );
        var user = userStore.findByEmail(email).orElseThrow();
        QuestJourney journey = questPlanStore.findByDateForUser(user.getId(), LocalDate.parse(QUEST_DATE))
                .orElseThrow()
                .getJourneys()
                .get(0);
        journey.redesign(
                journey.getCurrentQuestId(),
                replacementSeed(journey.getCurrentQuest().getCategory()),
                QuestRedesignReasonCode.LOW_ENERGY,
                null
        );
        questPlanStore.saveJourneyForUser(user.getId(), journey);

        mockMvc.perform(get("/api/v1/quests/today")
                        .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.journeys[0].currentQuest.title").value("첫 단계만 시작하기"))
                .andExpect(jsonPath("$.journeys[0].currentQuest.status").value("TODO"))
                .andExpect(jsonPath("$.journeys[0].history.length()").value(1))
                .andExpect(jsonPath("$.journeys[0].history[0].questId").value(originalQuestId))
                .andExpect(jsonPath("$.journeys[0].history[0].status").value("REDESIGNED"));
    }

    @Test
    void mapsAiFailuresAndNeverPersistsPartialPlans() throws Exception {
        List<AiFailure> failures = List.of(
                new AiFailure("invalid", QuestAiException.invalidResponse(), 502, "AI_INVALID_RESPONSE"),
                new AiFailure("quota", QuestAiException.quotaExceeded(), 429, "AI_QUOTA_EXCEEDED"),
                new AiFailure("unavailable", QuestAiException.providerUnavailable(), 503, "AI_PROVIDER_UNAVAILABLE"),
                new AiFailure("timeout", QuestAiException.providerTimeout(), 504, "AI_PROVIDER_TIMEOUT")
        );

        for (AiFailure failure : failures) {
            reset(questAiClient);
            when(questAiClient.generateDailyQuests(any())).thenThrow(failure.exception());
            String token = signupAndOnboard("daily-ai-" + failure.label() + "@example.com");

            generate(token, "MEDIUM")
                    .andExpect(status().is(failure.httpStatus()))
                    .andExpect(jsonPath("$.code").value(failure.code()));
            mockMvc.perform(get("/api/v1/quests/today")
                            .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.generatedNow").value(false))
                    .andExpect(jsonPath("$.journeys").isEmpty());
        }
    }

    @Test
    void concurrentGenerationReturnsOnePlanAndNeverExceedsThreeJourneys() throws Exception {
        String token = signupAndOnboard("daily-concurrent@example.com");
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<MvcResult> first = executor.submit(() -> concurrentGenerate(token, ready, start));
            Future<MvcResult> second = executor.submit(() -> concurrentGenerate(token, ready, start));
            assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
            start.countDown();

            MvcResult firstResult = first.get(15, TimeUnit.SECONDS);
            MvcResult secondResult = second.get(15, TimeUnit.SECONDS);
            assertThat(firstResult.getResponse().getStatus()).isEqualTo(200);
            assertThat(secondResult.getResponse().getStatus()).isEqualTo(200);
            assertThat(journeyIds(firstResult)).containsExactlyElementsOf(journeyIds(secondResult));
            assertThat(List.of(generatedNow(firstResult), generatedNow(secondResult)))
                    .containsExactlyInAnyOrder(true, false);

            mockMvc.perform(get("/api/v1/quests/today")
                            .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.journeys.length()").value(3));
        } finally {
            executor.shutdownNow();
        }
    }

    private MvcResult concurrentGenerate(
            String token,
            CountDownLatch ready,
            CountDownLatch start
    ) throws Exception {
        ready.countDown();
        if (!start.await(5, TimeUnit.SECONDS)) {
            throw new IllegalStateException("동시 요청 시작 신호를 받지 못했습니다.");
        }
        return generate(token, "MEDIUM").andReturn();
    }

    private org.springframework.test.web.servlet.ResultActions generate(String token, String energyLevel)
            throws Exception {
        return mockMvc.perform(post("/api/v1/quests/today/generate")
                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"energyLevel\":\"" + energyLevel + "\"}"));
    }

    private String signupAndOnboard(String email) throws Exception {
        String token = signup(email);
        mockMvc.perform(put("/api/v1/onboarding/me")
                        .header(HttpHeaders.AUTHORIZATION, bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "desiredJob":"백엔드 개발자",
                                  "region":"서울",
                                  "desiredWorkType":"FULL_TIME",
                                  "careerGapMonths":8,
                                  "hasResume":true,
                                  "interviewExperience":"LIMITED"
                                }
                                """))
                .andExpect(status().isOk());
        return token;
    }

    private String signup(String email) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"password123!","name":"테스트 사용자"}
                                """.formatted(email)))
                .andExpect(status().isCreated())
                .andReturn();
        return JsonPath.read(result.getResponse().getContentAsString(), "$.accessToken");
    }

    private static List<String> journeyIds(MvcResult result) throws Exception {
        return JsonPath.read(result.getResponse().getContentAsString(), "$.journeys[*].journeyId");
    }

    private static boolean generatedNow(MvcResult result) throws Exception {
        return JsonPath.read(result.getResponse().getContentAsString(), "$.generatedNow");
    }

    private static String bearer(String token) {
        return "Bearer " + token;
    }

    private static GeneratedQuestBatch validBatch() {
        return new GeneratedQuestBatch(List.of(
                draft("이력서 핵심 문장 다듬기", QuestCategory.RESUME),
                draft("관심 공고 조건 살펴보기", QuestCategory.JOB_SEARCH),
                draft("면접 답변 키워드 적기", QuestCategory.INTERVIEW)
        ));
    }

    private static QuestDraft draft(String title, QuestCategory category) {
        return new QuestDraft(
                title,
                "오늘 다시 시작할 수 있는 작은 행동입니다.",
                "결과를 한 줄 남깁니다.",
                List.of("자료 하나 열기", "한 줄 남기기"),
                category,
                QuestDifficulty.EASY,
                10
        );
    }

    private static QuestSeed replacementSeed(QuestCategory category) {
        return new QuestSeed(
                "첫 단계만 시작하기",
                "원래 목적을 유지한 더 작은 행동입니다.",
                "첫 단계 한 가지를 마칩니다.",
                List.of("자료 위치만 확인하기"),
                category,
                QuestDifficulty.EASY,
                5,
                true
        );
    }

    private record AiFailure(String label, QuestAiException exception, int httpStatus, String code) {
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class FixedQuestClockConfiguration {

        @Bean
        @Primary
        Clock fixedQuestClock() {
            return Clock.fixed(
                    Instant.parse("2026-08-02T15:30:00Z"),
                    ZoneId.of("Asia/Seoul")
            );
        }
    }
}
