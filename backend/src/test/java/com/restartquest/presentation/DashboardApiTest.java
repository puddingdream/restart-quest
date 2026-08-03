package com.restartquest.presentation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
import com.restartquest.domain.quest.QuestRedesign;
import com.restartquest.domain.quest.QuestRedesignReasonCode;
import com.restartquest.domain.quest.QuestSeed;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class DashboardApiTest {

    private static final LocalDate TODAY = LocalDate.now(ZoneId.of("Asia/Seoul"));

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserStore userStore;

    @Autowired
    private QuestPlanStore questPlanStore;

    @Test
    void emptyStateReturnsZeroSummaryAndNoNextQuest() throws Exception {
        Account account = signup("dashboard-empty@example.com");

        mockMvc.perform(get("/api/v1/dashboard/today")
                        .header(HttpHeaders.AUTHORIZATION, bearer(account.accessToken())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.date").value(TODAY.toString()))
                .andExpect(jsonPath("$.totalJourneys").value(0))
                .andExpect(jsonPath("$.completedJourneys").value(0))
                .andExpect(jsonPath("$.activeJourneys").value(0))
                .andExpect(jsonPath("$.redesignCount").value(0))
                .andExpect(jsonPath("$.progressPercent").value(0))
                .andExpect(jsonPath("$.nextQuest").doesNotExist())
                .andExpect(jsonPath("$.recentRedesigns").isEmpty());
    }

    @Test
    void partialCompletionUsesThreeJourneysAndSelectsFirstActiveCurrentQuest() throws Exception {
        Account account = signup("dashboard-partial@example.com");
        DailyQuestPlan plan = savePlan(account.userId());
        complete(account.userId(), plan.getJourneys().get(0));
        complete(account.userId(), plan.getJourneys().get(1));
        QuestJourney expectedNextJourney = plan.getJourneys().get(2);

        mockMvc.perform(get("/api/v1/dashboard/today")
                        .header(HttpHeaders.AUTHORIZATION, bearer(account.accessToken())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalJourneys").value(3))
                .andExpect(jsonPath("$.completedJourneys").value(2))
                .andExpect(jsonPath("$.activeJourneys").value(1))
                .andExpect(jsonPath("$.redesignCount").value(0))
                .andExpect(jsonPath("$.progressPercent").value(67))
                .andExpect(jsonPath("$.nextQuest.journeyId").value(expectedNextJourney.getId().toString()))
                .andExpect(jsonPath("$.nextQuest.questId")
                        .value(expectedNextJourney.getCurrentQuestId().toString()))
                .andExpect(jsonPath("$.nextQuest.revision").value(0))
                .andExpect(jsonPath("$.nextQuest.title").value("답변 키워드 적기"))
                .andExpect(jsonPath("$.nextQuest.steps.length()").value(2))
                .andExpect(jsonPath("$.nextQuest.category").value("JOB_SEARCH"))
                .andExpect(jsonPath("$.nextQuest.difficulty").value("EASY"))
                .andExpect(jsonPath("$.nextQuest.estimatedMinutes").value(10));
    }

    @Test
    void fullCompletionReturnsOneHundredPercentAndNoNextQuest() throws Exception {
        Account account = signup("dashboard-complete@example.com");
        DailyQuestPlan plan = savePlan(account.userId());
        plan.getJourneys().forEach(journey -> complete(account.userId(), journey));

        mockMvc.perform(get("/api/v1/dashboard/today")
                        .header(HttpHeaders.AUTHORIZATION, bearer(account.accessToken())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalJourneys").value(3))
                .andExpect(jsonPath("$.completedJourneys").value(3))
                .andExpect(jsonPath("$.activeJourneys").value(0))
                .andExpect(jsonPath("$.progressPercent").value(100))
                .andExpect(jsonPath("$.nextQuest").doesNotExist());
    }

    @Test
    void repeatedRedesignKeepsThreeJourneysAndReturnsCurrentQuestWithNewestHistoryFirst() throws Exception {
        Account account = signup("dashboard-redesign@example.com");
        DailyQuestPlan plan = savePlan(account.userId());
        QuestJourney firstJourney = plan.getJourneys().get(0);
        QuestRedesign first = redesign(
                account.userId(), firstJourney, "공고 제목만 읽기", QuestRedesignReasonCode.TASK_TOO_LARGE
        );
        QuestRedesign second = redesign(
                account.userId(), firstJourney, "공고 사이트 열기", QuestRedesignReasonCode.LOW_ENERGY
        );
        QuestRedesign third = redesign(
                account.userId(), plan.getJourneys().get(1), "이력서 파일 위치 찾기",
                QuestRedesignReasonCode.MATERIALS_MISSING
        );

        MvcResult response = mockMvc.perform(get("/api/v1/dashboard/today")
                        .header(HttpHeaders.AUTHORIZATION, bearer(account.accessToken())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalJourneys").value(3))
                .andExpect(jsonPath("$.completedJourneys").value(0))
                .andExpect(jsonPath("$.activeJourneys").value(3))
                .andExpect(jsonPath("$.redesignCount").value(3))
                .andExpect(jsonPath("$.progressPercent").value(0))
                .andExpect(jsonPath("$.nextQuest.journeyId").value(firstJourney.getId().toString()))
                .andExpect(jsonPath("$.nextQuest.questId").value(firstJourney.getCurrentQuestId().toString()))
                .andExpect(jsonPath("$.nextQuest.revision").value(2))
                .andExpect(jsonPath("$.nextQuest.title").value("공고 사이트 열기"))
                .andExpect(jsonPath("$.recentRedesigns[*].reasonCode", containsInAnyOrder(
                        "TASK_TOO_LARGE", "LOW_ENERGY", "MATERIALS_MISSING"
                )))
                .andExpect(jsonPath("$.recentRedesigns[*].replacementQuestTitle", containsInAnyOrder(
                        "공고 제목만 읽기", "공고 사이트 열기", "이력서 파일 위치 찾기"
                )))
                .andReturn();

        List<String> redesignIds = JsonPath.read(
                response.getResponse().getContentAsString(),
                "$.recentRedesigns[*].redesignId"
        );
        assertThat(redesignIds).containsExactlyInAnyOrder(
                first.getId().toString(), second.getId().toString(), third.getId().toString()
        );
        List<String> createdAtValues = JsonPath.read(
                response.getResponse().getContentAsString(),
                "$.recentRedesigns[*].createdAt"
        );
        assertThat(createdAtValues.stream().map(OffsetDateTime::parse).toList())
                .isSortedAccordingTo(Comparator.reverseOrder());
    }

    @Test
    void dashboardNeverReturnsAnotherUsersPlan() throws Exception {
        Account owner = signup("dashboard-owner@example.com");
        Account other = signup("dashboard-other@example.com");
        DailyQuestPlan ownerPlan = savePlan(owner.userId());
        complete(owner.userId(), ownerPlan.getJourneys().get(0));

        mockMvc.perform(get("/api/v1/dashboard/today")
                        .header(HttpHeaders.AUTHORIZATION, bearer(other.accessToken())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalJourneys").value(0))
                .andExpect(jsonPath("$.completedJourneys").value(0))
                .andExpect(jsonPath("$.nextQuest").doesNotExist())
                .andExpect(jsonPath("$.recentRedesigns").isEmpty());

        mockMvc.perform(get("/api/v1/dashboard/today")
                        .header(HttpHeaders.AUTHORIZATION, bearer(owner.accessToken())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalJourneys").value(3))
                .andExpect(jsonPath("$.completedJourneys").value(1));
    }

    private DailyQuestPlan savePlan(UUID userId) {
        return questPlanStore.saveForUser(userId, DailyQuestPlan.create(
                userId,
                TODAY,
                EnergyLevel.MEDIUM,
                List.of(
                        initialSeed("공고 하나 살펴보기"),
                        initialSeed("이력서 한 줄 쓰기"),
                        initialSeed("답변 키워드 적기")
                )
        ));
    }

    private void complete(UUID userId, QuestJourney journey) {
        journey.complete(journey.getCurrentQuestId());
        questPlanStore.saveJourneyForUser(userId, journey);
    }

    private QuestRedesign redesign(
            UUID userId,
            QuestJourney journey,
            String replacementTitle,
            QuestRedesignReasonCode reasonCode
    ) {
        QuestRedesign redesign = journey.redesign(
                journey.getCurrentQuestId(),
                replacementSeed(replacementTitle),
                reasonCode,
                null
        );
        questPlanStore.saveJourneyForUser(userId, journey);
        return redesign;
    }

    private Account signup(String email) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"password123!","name":"대시보드 사용자"}
                                """.formatted(email)))
                .andExpect(status().isCreated())
                .andReturn();
        String accessToken = JsonPath.read(result.getResponse().getContentAsString(), "$.accessToken");
        UUID userId = userStore.findByEmail(email).orElseThrow().getId();
        return new Account(userId, accessToken);
    }

    private static QuestSeed initialSeed(String title) {
        return seed(title, 10);
    }

    private static QuestSeed replacementSeed(String title) {
        return seed(title, 5);
    }

    private static QuestSeed seed(String title, int estimatedMinutes) {
        return new QuestSeed(
                title,
                "오늘 할 작은 행동입니다.",
                "결과를 한 줄 남깁니다.",
                List.of("자료 열기", "한 줄 남기기"),
                QuestCategory.JOB_SEARCH,
                QuestDifficulty.EASY,
                estimatedMinutes,
                true
        );
    }

    private static String bearer(String accessToken) {
        return "Bearer " + accessToken;
    }

    private record Account(UUID userId, String accessToken) {
    }
}
