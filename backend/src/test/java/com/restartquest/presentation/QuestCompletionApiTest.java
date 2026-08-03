package com.restartquest.presentation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
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
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class QuestCompletionApiTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private QuestPlanStore questPlanStore;

    @Autowired
    private UserStore userStore;

    @Test
    void completesOwnedCurrentQuestOnceAndReturnsUpdatedJourney() throws Exception {
        SignedInUser owner = signup("completion-owner@example.com");
        QuestJourney journey = savePlan(owner.userId()).getJourneys().get(0);
        UUID questId = journey.getCurrentQuestId();

        mockMvc.perform(post("/api/v1/quests/{questId}/completion", questId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(owner.accessToken())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.journeyId").value(journey.getId().toString()))
                .andExpect(jsonPath("$.status").value("COMPLETED"))
                .andExpect(jsonPath("$.currentQuest.questId").value(questId.toString()))
                .andExpect(jsonPath("$.currentQuest.status").value("DONE"))
                .andExpect(jsonPath("$.currentQuest.completedAt").isString())
                .andExpect(jsonPath("$.history.length()").value(1))
                .andExpect(jsonPath("$.history[0].status").value("DONE"));

        mockMvc.perform(post("/api/v1/quests/{questId}/completion", questId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(owner.accessToken())))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("QUEST_ALREADY_RESOLVED"));
    }

    @Test
    void otherUserGetsTheSameNotFoundResponseAndCannotChangeQuest() throws Exception {
        SignedInUser owner = signup("quest-owner@example.com");
        SignedInUser otherUser = signup("quest-other@example.com");
        QuestJourney journey = savePlan(owner.userId()).getJourneys().get(0);
        UUID questId = journey.getCurrentQuestId();

        mockMvc.perform(post("/api/v1/quests/{questId}/completion", questId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(otherUser.accessToken())))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("QUEST_NOT_FOUND"));

        mockMvc.perform(post("/api/v1/quests/{questId}/completion", UUID.randomUUID())
                        .header(HttpHeaders.AUTHORIZATION, bearer(otherUser.accessToken())))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("QUEST_NOT_FOUND"));

        QuestJourney unchanged = questPlanStore.findJourneyForUser(owner.userId(), journey.getId()).orElseThrow();
        assertThat(unchanged.getCurrentQuest().getStatus()).isEqualTo(QuestStatus.TODO);
    }

    @Test
    void redesignedHistoricalQuestReturnsAlreadyResolved() throws Exception {
        SignedInUser owner = signup("redesigned-owner@example.com");
        QuestJourney journey = savePlan(owner.userId()).getJourneys().get(0);
        UUID originalQuestId = journey.getCurrentQuestId();
        journey.redesign(
                originalQuestId,
                replacementSeed(),
                QuestRedesignReasonCode.TASK_TOO_LARGE,
                null
        );
        questPlanStore.saveJourneyForUser(owner.userId(), journey);

        mockMvc.perform(post("/api/v1/quests/{questId}/completion", originalQuestId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(owner.accessToken())))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("QUEST_ALREADY_RESOLVED"));
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void concurrentDuplicateCompletionAllowsExactlyOneTransition() throws Exception {
        SignedInUser owner = signup("concurrent-completion-owner@example.com");
        QuestJourney journey = savePlan(owner.userId()).getJourneys().get(0);
        UUID questId = journey.getCurrentQuestId();
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);

        try {
            Future<Integer> firstStatus = executor.submit(() -> completeConcurrently(owner, questId, ready, start));
            Future<Integer> secondStatus = executor.submit(() -> completeConcurrently(owner, questId, ready, start));

            assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
            start.countDown();

            assertThat(List.of(
                    firstStatus.get(10, TimeUnit.SECONDS),
                    secondStatus.get(10, TimeUnit.SECONDS)
            )).containsExactlyInAnyOrder(200, 409);

            QuestJourney completed = questPlanStore.findJourneyForUser(owner.userId(), journey.getId()).orElseThrow();
            assertThat(completed.getCurrentQuest().getStatus()).isEqualTo(QuestStatus.DONE);
        } finally {
            start.countDown();
            executor.shutdownNow();
        }
    }

    private int completeConcurrently(
            SignedInUser owner,
            UUID questId,
            CountDownLatch ready,
            CountDownLatch start
    ) throws Exception {
        ready.countDown();
        if (!start.await(5, TimeUnit.SECONDS)) {
            throw new IllegalStateException("동시 완료 요청 시작 신호를 받지 못했습니다.");
        }
        return mockMvc.perform(post("/api/v1/quests/{questId}/completion", questId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(owner.accessToken())))
                .andReturn()
                .getResponse()
                .getStatus();
    }

    private SignedInUser signup(String email) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"password123!","name":"테스트 사용자"}
                                """.formatted(email)))
                .andExpect(status().isCreated())
                .andReturn();
        String token = JsonPath.read(result.getResponse().getContentAsString(), "$.accessToken");
        UUID userId = userStore.findByEmail(email).orElseThrow().getId();
        return new SignedInUser(userId, token);
    }

    private DailyQuestPlan savePlan(UUID userId) {
        return questPlanStore.saveForUser(userId, DailyQuestPlan.create(
                userId,
                LocalDate.of(2026, 8, 3),
                EnergyLevel.MEDIUM,
                List.of(initialSeed("공고 제목 보기"), initialSeed("이력서 열기"), initialSeed("답변 키워드 보기"))
        ));
    }

    private static QuestSeed initialSeed(String title) {
        return new QuestSeed(
                title,
                "오늘 할 작은 행동입니다.",
                "한 줄을 기록합니다.",
                List.of("자료 열기"),
                QuestCategory.JOB_SEARCH,
                QuestDifficulty.EASY,
                10,
                true
        );
    }

    private static QuestSeed replacementSeed() {
        return new QuestSeed(
                "공고 사이트만 열기",
                "원래 목적을 유지한 더 작은 행동입니다.",
                "사이트를 열어 둡니다.",
                List.of("사이트 열기"),
                QuestCategory.JOB_SEARCH,
                QuestDifficulty.EASY,
                5,
                true
        );
    }

    private static String bearer(String token) {
        return "Bearer " + token;
    }

    private record SignedInUser(UUID userId, String accessToken) {
    }
}
