package com.restartquest.quest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.jayway.jsonpath.JsonPath;
import com.restartquest.auth.Account;
import com.restartquest.auth.AccountRepository;
import com.restartquest.auth.AuthenticatedAccount;
import com.restartquest.common.error.ApiException;
import com.restartquest.config.PlatformTime;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:quest-loop;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "server.servlet.session.cookie.secure=false"
})
@AutoConfigureMockMvc
class QuestApiIntegrationTest {

    private static final LocalDate BUSINESS_DATE = LocalDate.of(2026, 9, 3);
    private static final Instant NOW = Instant.parse("2026-09-02T15:05:00Z");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AccountRepository accounts;

    @Autowired
    private DailyCheckInRepository checkIns;

    @Autowired
    private QuestRepository quests;

    @Autowired
    private QuestOutcomeRepository outcomes;

    @Autowired
    private QuestService questService;

    @Autowired
    private ActionCatalog catalog;

    @MockitoBean
    private PlatformTime time;

    @BeforeEach
    void resetDataAndTime() {
        outcomes.deleteAllInBatch();
        quests.deleteAllInBatch();
        checkIns.deleteAllInBatch();
        accounts.deleteAllInBatch();
        when(time.businessDate()).thenReturn(BUSINESS_DATE);
        when(time.now()).thenReturn(NOW);
    }

    @Test
    void returnsTheSameTemplateAndReasonForTheSameCatalogInputs() throws Exception {
        Account first = account("first@example.com");
        Account second = account("second@example.com");

        MvcResult firstResult = checkIn(first, "LOW", 5, "RESUME")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.phase").value("QUEST_ACTIVE"))
                .andExpect(jsonPath("$.activeQuest.templateKey").value("resume.pick"))
                .andExpect(jsonPath("$.activeQuest.catalogVersion").value("v1"))
                .andExpect(jsonPath("$.activeQuest.difficulty").value(1))
                .andExpect(jsonPath("$.activeQuest.estimatedMinutes").value(5))
                .andReturn();
        MvcResult secondResult = checkIn(second, "LOW", 5, "RESUME")
                .andExpect(status().isCreated())
                .andReturn();

        String firstTemplateKey = read(firstResult, "$.activeQuest.templateKey");
        String secondTemplateKey = read(secondResult, "$.activeQuest.templateKey");
        String firstReason = read(firstResult, "$.activeQuest.reason");
        String secondReason = read(secondResult, "$.activeQuest.reason");
        assertThat(firstTemplateKey).isEqualTo(secondTemplateKey);
        assertThat(firstReason).isEqualTo(secondReason);

        checkIn(first, "HIGH", 30, "APPLY")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CHECK_IN_ALREADY_EXISTS"));
    }

    @Test
    void databaseRejectsDuplicateDailyCheckInsAndActiveQuests() {
        Account owner = account("constraints@example.com");
        QuestService.TodayView today = questService.checkIn(
                owner.getId(), EnergyLevel.MEDIUM, 15, FocusArea.EXPLORE);
        DailyCheckIn storedCheckIn = checkIns.findByAccountIdAndLocalDate(owner.getId(), BUSINESS_DATE).orElseThrow();

        assertThatThrownBy(() -> checkIns.saveAndFlush(new DailyCheckIn(
                UUID.randomUUID(),
                owner.getId(),
                BUSINESS_DATE,
                EnergyLevel.HIGH,
                30,
                FocusArea.APPLY,
                NOW)))
                .isInstanceOf(DataIntegrityViolationException.class);

        assertThatThrownBy(() -> quests.saveAndFlush(new Quest(
                UUID.randomUUID(),
                owner.getId(),
                storedCheckIn.getId(),
                catalog.recommend(FocusArea.EXPLORE, 15, EnergyLevel.MEDIUM),
                null,
                NOW)))
                .isInstanceOf(DataIntegrityViolationException.class);

        assertThat(today.activeQuest()).isNotNull();
        assertThat(quests.existsByAccountIdAndStatus(owner.getId(), QuestStatus.ACTIVE)).isTrue();
    }

    @Test
    void blocksDownToASafeQuestThenCompletesWithoutDuplicateOutcomes() throws Exception {
        Account owner = account("flow@example.com");
        String note = "가".repeat(300);

        MvcResult initial = checkIn(owner, "HIGH", 30, "APPLY")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.activeQuest.templateKey").value("apply.motivation"))
                .andReturn();
        UUID difficultyThree = UUID.fromString(read(initial, "$.activeQuest.id"));

        MvcResult difficultyTwoResult = block(owner, difficultyThree, 0, "TOO_LARGE", note)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activeQuest.templateKey").value("apply.match"))
                .andExpect(jsonPath("$.activeQuest.difficulty").value(2))
                .andExpect(jsonPath("$.activeQuest.predecessorQuestId").value(difficultyThree.toString()))
                .andReturn();

        block(owner, difficultyThree, 0, "NO_TIME", null)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("STALE_QUEST"));
        assertThat(outcomes.count()).isEqualTo(1);

        UUID difficultyTwo = UUID.fromString(read(difficultyTwoResult, "$.activeQuest.id"));
        MvcResult difficultyOneResult = block(owner, difficultyTwo, 0, "NO_TIME", null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activeQuest.difficulty").value(1))
                .andReturn();
        UUID difficultyOne = UUID.fromString(read(difficultyOneResult, "$.activeQuest.id"));
        MvcResult safeResult = block(owner, difficultyOne, 0, "LOW_ENERGY", null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activeQuest.templateKey").value("apply.pause"))
                .andExpect(jsonPath("$.activeQuest.difficulty").value(0))
                .andExpect(jsonPath("$.activeQuest.estimatedMinutes").value(2))
                .andReturn();
        UUID safeQuest = UUID.fromString(read(safeResult, "$.activeQuest.id"));

        block(owner, safeQuest, 0, "EMOTIONAL_LOAD", null)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("NO_SMALLER_QUEST"));
        assertThat(quests.count()).isEqualTo(4);
        assertThat(outcomes.count()).isEqualTo(3);
        assertThat(quests.findById(safeQuest).orElseThrow().getStatus()).isEqualTo(QuestStatus.ACTIVE);

        complete(owner, safeQuest, 0)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.phase").value("DAY_COMPLETED"))
                .andExpect(jsonPath("$.activeQuest").isEmpty())
                .andExpect(jsonPath("$.completedQuest.id").value(safeQuest.toString()))
                .andExpect(jsonPath("$.completedQuest.version").value(1));
        complete(owner, safeQuest, 0)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("STALE_QUEST"));
        assertThat(outcomes.count()).isEqualTo(4);

        getToday(owner)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.date").value("2026-09-03"))
                .andExpect(jsonPath("$.phase").value("DAY_COMPLETED"));

        MvcResult history = getHistory(owner, "2026-09-03", "2026-09-03")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.days.length()").value(1))
                .andExpect(jsonPath("$.days[0].outcomes.length()").value(4))
                .andExpect(jsonPath("$.days[0].outcomes[0].type").value("BLOCKED"))
                .andExpect(jsonPath("$.days[0].outcomes[0].barrier").value("TOO_LARGE"))
                .andExpect(jsonPath("$.days[0].outcomes[3].type").value("COMPLETED"))
                .andExpect(jsonPath("$.days[0].outcomes[3].barrier").isEmpty())
                .andReturn();
        assertThat((String) read(history, "$.days[0].outcomes[0].note")).hasSize(300);
    }

    @Test
    void hidesOtherAccountsQuestAndRejectsOversizedNotesWithoutMutation() throws Exception {
        Account owner = account("owner@example.com");
        Account intruder = account("intruder@example.com");
        MvcResult initial = checkIn(owner, "LOW", 5, "INTERVIEW")
                .andExpect(status().isCreated())
                .andReturn();
        UUID questId = UUID.fromString(read(initial, "$.activeQuest.id"));

        block(owner, questId, 0, "OTHER", "가".repeat(301))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors.note").exists());
        assertThat(outcomes.count()).isZero();
        assertThat(quests.findById(questId).orElseThrow().getStatus()).isEqualTo(QuestStatus.ACTIVE);

        complete(intruder, questId, 0)
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("RESOURCE_NOT_FOUND"));
        block(intruder, questId, 0, "OTHER", "보이면 안 되는 메모")
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("RESOURCE_NOT_FOUND"));
        getHistory(intruder, "2026-09-03", "2026-09-03")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.days").isEmpty());
        mockMvc.perform(post("/api/v1/quests/not-a-uuid/complete")
                        .with(as(owner))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("version", 0))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        assertThat(outcomes.count()).isZero();
    }

    @Test
    void acceptsAtMostThirtyOneHistoryDaysAndUsesTheSeoulBusinessDateBoundary() throws Exception {
        Account owner = account("midnight@example.com");
        MvcResult firstDay = checkIn(owner, "MEDIUM", 15, "EXPLORE")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.date").value("2026-09-03"))
                .andReturn();
        UUID firstDayQuest = UUID.fromString(read(firstDay, "$.activeQuest.id"));

        getHistory(owner, "2026-08-04", "2026-09-03")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.days.length()").value(1));
        getHistory(owner, "2026-08-03", "2026-09-03")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        getHistory(owner, "2026-09-04", "2026-09-03")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        getHistory(owner, "not-a-date", "2026-09-03")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));

        when(time.businessDate()).thenReturn(LocalDate.of(2026, 9, 4));
        when(time.now()).thenReturn(Instant.parse("2026-09-03T15:00:00Z"));
        getToday(owner)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.date").value("2026-09-04"))
                .andExpect(jsonPath("$.phase").value("QUEST_ACTIVE"))
                .andExpect(jsonPath("$.activeQuest.id").value(firstDayQuest.toString()));
        complete(owner, firstDayQuest, 0)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.date").value("2026-09-04"))
                .andExpect(jsonPath("$.phase").value("CHECK_IN_REQUIRED"));
        checkIn(owner, "LOW", 5, "RESUME")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.date").value("2026-09-04"));
        assertThat(checkIns.count()).isEqualTo(2);
    }

    @Test
    void concurrentCompletionWithTheSameVersionCreatesOneOutcome() throws Exception {
        Account owner = account("race@example.com");
        QuestService.TodayView today = questService.checkIn(
                owner.getId(), EnergyLevel.LOW, 5, FocusArea.RESUME);
        UUID questId = today.activeQuest().id();

        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        try {
            java.util.concurrent.Callable<String> command = () -> {
                ready.countDown();
                start.await(5, TimeUnit.SECONDS);
                try {
                    questService.complete(owner.getId(), questId, 0);
                    return "OK";
                } catch (ApiException exception) {
                    return exception.code();
                }
            };
            Future<String> first = executor.submit(command);
            Future<String> second = executor.submit(command);
            assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
            start.countDown();

            assertThat(List.of(first.get(5, TimeUnit.SECONDS), second.get(5, TimeUnit.SECONDS)))
                    .containsExactlyInAnyOrder("OK", "STALE_QUEST");
        } finally {
            executor.shutdownNow();
        }

        assertThat(outcomes.count()).isOne();
        assertThat(quests.findById(questId).orElseThrow().getStatus()).isEqualTo(QuestStatus.COMPLETED);
    }

    @Test
    void concurrentBlockingWithTheSameVersionCreatesOneOutcomeAndOneFallback() throws Exception {
        Account owner = account("block-race@example.com");
        QuestService.TodayView today = questService.checkIn(
                owner.getId(), EnergyLevel.HIGH, 30, FocusArea.INTERVIEW);
        UUID questId = today.activeQuest().id();

        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        try {
            java.util.concurrent.Callable<String> command = () -> {
                ready.countDown();
                start.await(5, TimeUnit.SECONDS);
                try {
                    questService.block(owner.getId(), questId, 0, Barrier.TOO_LARGE, null);
                    return "OK";
                } catch (ApiException exception) {
                    return exception.code();
                }
            };
            Future<String> first = executor.submit(command);
            Future<String> second = executor.submit(command);
            assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
            start.countDown();

            assertThat(List.of(first.get(5, TimeUnit.SECONDS), second.get(5, TimeUnit.SECONDS)))
                    .containsExactlyInAnyOrder("OK", "STALE_QUEST");
        } finally {
            executor.shutdownNow();
        }

        assertThat(outcomes.count()).isOne();
        assertThat(quests.count()).isEqualTo(2);
        Quest active = quests.findFirstByAccountIdAndCheckInIdAndStatusOrderByCreatedAtDesc(
                        owner.getId(),
                        checkIns.findByAccountIdAndLocalDate(owner.getId(), BUSINESS_DATE).orElseThrow().getId(),
                        QuestStatus.ACTIVE)
                .orElseThrow();
        assertThat(active.getTemplateKey()).isEqualTo("interview.points");
        assertThat(active.getPredecessorQuestId()).isEqualTo(questId);
    }

    private Account account(String email) {
        return accounts.saveAndFlush(new Account(UUID.randomUUID(), email, "test-only-password-hash", NOW));
    }

    private org.springframework.test.web.servlet.ResultActions checkIn(
            Account account,
            String energyLevel,
            int availableMinutes,
            String focusArea) throws Exception {
        return mockMvc.perform(post("/api/v1/check-ins")
                .with(as(account))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                        "energyLevel", energyLevel,
                        "availableMinutes", availableMinutes,
                        "focusArea", focusArea))));
    }

    private org.springframework.test.web.servlet.ResultActions complete(
            Account account,
            UUID questId,
            long version) throws Exception {
        return mockMvc.perform(post("/api/v1/quests/{questId}/complete", questId)
                .with(as(account))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("version", version))));
    }

    private org.springframework.test.web.servlet.ResultActions block(
            Account account,
            UUID questId,
            long version,
            String barrier,
            String note) throws Exception {
        Map<String, Object> request = new java.util.LinkedHashMap<>();
        request.put("version", version);
        request.put("barrier", barrier);
        if (note != null) {
            request.put("note", note);
        }
        return mockMvc.perform(post("/api/v1/quests/{questId}/block", questId)
                .with(as(account))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)));
    }

    private org.springframework.test.web.servlet.ResultActions getToday(Account account) throws Exception {
        return mockMvc.perform(get("/api/v1/today").with(as(account)));
    }

    private org.springframework.test.web.servlet.ResultActions getHistory(
            Account account,
            String from,
            String to) throws Exception {
        return mockMvc.perform(get("/api/v1/history")
                .param("from", from)
                .param("to", to)
                .with(as(account)));
    }

    private RequestPostProcessor as(Account account) {
        AuthenticatedAccount principal = new AuthenticatedAccount(account.getId(), account.getEmail());
        return authentication(UsernamePasswordAuthenticationToken.authenticated(principal, null, List.of()));
    }

    @SuppressWarnings("unchecked")
    private <T> T read(MvcResult result, String path) throws Exception {
        return (T) JsonPath.read(result.getResponse().getContentAsString(), path);
    }
}
