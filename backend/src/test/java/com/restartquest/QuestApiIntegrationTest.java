package com.restartquest;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.restartquest.api.ApiExceptionHandler;
import com.restartquest.infra.WorkspaceCleanupService;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import jakarta.servlet.http.Cookie;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.slf4j.LoggerFactory;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import javax.sql.DataSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class QuestApiIntegrationTest {
    private static final String ORIGIN = "http://localhost:8080";
    private static final TestPostgres POSTGRES = startPostgres();

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::jdbcUrl);
        registry.add("spring.datasource.username", () -> "postgres");
        registry.add("spring.datasource.password", () -> "");
        registry.add("app.security.allowed-origins", () -> ORIGIN);
        registry.add("app.security.cookie-secure", () -> "false");
    }

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired WorkspaceCleanupService cleanup;
    @Autowired DataSource dataSource;

    @BeforeEach
    void resetDatabase() {
        jdbc.execute("truncate table workspaces cascade");
    }

    @AfterAll
    static void stopPostgres() throws IOException {
        POSTGRES.close();
    }

    @Test
    void sessionSecurityHashCsrfOriginAndWorkspaceIsolation() throws Exception {
        mvc.perform(post("/api/v1/session")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"timezone\":\"Asia/Seoul\"}"))
                .andExpect(status().isForbidden())
                .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.code").value("ORIGIN_NOT_ALLOWED"));
        mvc.perform(post("/api/v1/session")
                        .header("Origin", ORIGIN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_TIMEZONE"));

        Session first = session();
        String storedHash = jdbc.queryForObject("select session_hash from workspaces", String.class);
        assertThat(storedHash).isNotBlank().isNotEqualTo(first.token);
        mvc.perform(get("/api/v1/bootstrap").cookie(new Cookie("rq_session", first.token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nextRequiredAction").value("CREATE_QUEST"))
                .andExpect(jsonPath("$.csrfToken").value(first.csrf))
                .andExpect(jsonPath("$.workspaceExpiresAt").isString())
                .andExpect(header().string("Set-Cookie",
                        org.hamcrest.Matchers.containsString("Max-Age=7776000")));

        mvc.perform(post("/api/v1/session")
                        .cookie(new Cookie("rq_session", first.token))
                        .header("Origin", ORIGIN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"timezone\":\"UTC\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.csrfToken").value(first.csrf))
                .andExpect(jsonPath("$.workspaceExpiresAt").isString())
                .andExpect(header().string("Set-Cookie",
                        org.hamcrest.Matchers.containsString("Max-Age=7776000")));

        MvcResult created = createQuest(first, UUID.randomUUID(), "내 목표", "지원서 작성", 10)
                .andExpect(status().isCreated())
                .andExpect(header().string("Set-Cookie",
                        org.hamcrest.Matchers.containsString("Max-Age=7776000")))
                .andReturn();
        JsonNode createdBody = json(created);
        String actionId = createdBody.at("/action/id").asText();

        Session other = session();
        write(other, post("/api/v1/actions/{id}/attempts", actionId), UUID.randomUUID(),
                "{\"outcome\":\"DONE\"}")
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("RESOURCE_NOT_FOUND"));

        mvc.perform(post("/api/v1/actions/{id}/attempts", actionId)
                        .cookie(new Cookie("rq_session", first.token))
                        .header("Origin", ORIGIN)
                        .header("X-CSRF-Token", "invalid")
                        .header("Idempotency-Key", UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"outcome\":\"DONE\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CSRF_INVALID"));
    }

    @Test
    void staleNonEmptyCookieIsClearedWithoutCreatingOrDisclosingAWorkspace() throws Exception {
        String unknownToken = "unrecognized-session-token";
        mvc.perform(get("/api/v1/bootstrap").cookie(new Cookie("rq_session", unknownToken)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("WORKSPACE_ACCESS_UNAVAILABLE"))
                .andExpect(jsonPath("$.detail").value("이 브라우저에서 이전 작업 공간에 접근할 수 없습니다."))
                .andExpect(content().string(org.hamcrest.Matchers.not(
                        org.hamcrest.Matchers.containsString(unknownToken))))
                .andExpect(header().string("Set-Cookie", org.hamcrest.Matchers.allOf(
                        org.hamcrest.Matchers.containsString("rq_session="),
                        org.hamcrest.Matchers.containsString("Max-Age=0"))));

        mvc.perform(post("/api/v1/session")
                        .cookie(new Cookie("rq_session", unknownToken))
                        .header("Origin", ORIGIN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"timezone\":\"UTC\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("WORKSPACE_ACCESS_UNAVAILABLE"))
                .andExpect(header().string("Set-Cookie",
                        org.hamcrest.Matchers.containsString("Max-Age=0")));
        assertThat(jdbc.queryForObject("select count(*) from workspaces", Integer.class)).isZero();
    }

    @Test
    void qualifyingActivityUsesDatabaseTimeAndSecurityFailuresDoNotExtendTtl() throws Exception {
        Session session = session();
        UUID workspaceId = jdbc.queryForObject("select id from workspaces", UUID.class);
        OffsetDateTime oldActivity = OffsetDateTime.parse("2025-01-01T00:00:00Z");
        jdbc.update("update workspaces set last_activity_at = ? where id = ?", oldActivity, workspaceId);

        mvc.perform(post("/api/v1/session")
                        .cookie(new Cookie("rq_session", session.token))
                        .header("Origin", ORIGIN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"timezone\":\"UTC\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.workspaceExpiresAt").isString())
                .andExpect(header().string("Set-Cookie",
                        org.hamcrest.Matchers.containsString("Max-Age=7776000")));
        assertThat(lastActivity(workspaceId)).isAfter(oldActivity);
        jdbc.update("update workspaces set last_activity_at = ? where id = ?", oldActivity, workspaceId);

        mvc.perform(post("/api/v1/quests")
                        .cookie(new Cookie("rq_session", session.token))
                        .header("Origin", ORIGIN)
                        .header("X-CSRF-Token", "invalid")
                        .header("Idempotency-Key", UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isForbidden())
                .andExpect(header().doesNotExist("Set-Cookie"));
        assertThat(lastActivity(workspaceId)).isEqualTo(oldActivity);

        mvc.perform(post("/api/v1/quests")
                        .cookie(new Cookie("rq_session", session.token))
                        .header("Origin", "https://not-allowed.example")
                        .header("X-CSRF-Token", session.csrf)
                        .header("Idempotency-Key", UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isForbidden())
                .andExpect(header().doesNotExist("Set-Cookie"));
        assertThat(lastActivity(workspaceId)).isEqualTo(oldActivity);

        mvc.perform(options("/api/v1/quests").header("Origin", ORIGIN)).andReturn();
        assertThat(lastActivity(workspaceId)).isEqualTo(oldActivity);

        mvc.perform(get("/actuator/health"))
                .andExpect(status().isOk());
        assertThat(lastActivity(workspaceId)).isEqualTo(oldActivity);

        MvcResult bootstrap = mvc.perform(get("/api/v1/bootstrap")
                        .cookie(new Cookie("rq_session", session.token)))
                .andExpect(status().isOk())
                .andExpect(header().string("Set-Cookie",
                        org.hamcrest.Matchers.containsString("Max-Age=7776000")))
                .andReturn();
        OffsetDateTime touched = lastActivity(workspaceId);
        assertThat(touched).isAfter(oldActivity);
        assertThat(Instant.parse(json(bootstrap).get("workspaceExpiresAt").asText()))
                .isEqualTo(touched.plusDays(90).toInstant());

        jdbc.update("update workspaces set last_activity_at = ? where id = ?", oldActivity, workspaceId);
        write(session, post("/api/v1/quests"), UUID.randomUUID(),
                "{\"title\":\"   \",\"firstAction\":{\"title\":\"작은 행동\",\"estimatedMinutes\":5}}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        assertThat(lastActivity(workspaceId)).isAfter(oldActivity);

        jdbc.update("update workspaces set last_activity_at = ? where id = ?", oldActivity, workspaceId);
        mvc.perform(get("/api/v1/history").cookie(new Cookie("rq_session", session.token)))
                .andExpect(status().isOk())
                .andExpect(header().string("Set-Cookie",
                        org.hamcrest.Matchers.containsString("Max-Age=7776000")));
        assertThat(lastActivity(workspaceId)).isAfter(oldActivity);

        createQuest(session, UUID.randomUUID(), "활동 목표", "작은 행동", 5)
                .andExpect(status().isCreated());
        jdbc.update("update workspaces set last_activity_at = ? where id = ?", oldActivity, workspaceId);
        createQuest(session, UUID.randomUUID(), "다른 목표", "다른 행동", 5)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ACTIVE_QUEST_EXISTS"));
        assertThat(lastActivity(workspaceId)).isAfter(oldActivity);
    }

    @Test
    void restartLifecycleReplaysSameRequestAndRejectsChangedPayload() throws Exception {
        Session session = session();
        UUID questKey = UUID.randomUUID();
        String createPayload = "{\"title\":\"  구직 다시 시작  \"," +
                "\"firstAction\":{\"title\":\"지원서 초안 작성\",\"estimatedMinutes\":10}}";
        MvcResult first = write(session, post("/api/v1/quests"), questKey, createPayload)
                .andExpect(status().isCreated())
                .andExpect(header().string("Idempotency-Replayed", "false"))
                .andExpect(jsonPath("$.quest.title").value("구직 다시 시작"))
                .andReturn();
        MvcResult replay = write(session, post("/api/v1/quests"), questKey, createPayload)
                .andExpect(status().isCreated())
                .andExpect(header().string("Idempotency-Replayed", "true"))
                .andReturn();
        assertThat(json(replay).at("/action/id").asText()).isEqualTo(json(first).at("/action/id").asText());
        write(session, post("/api/v1/quests"), questKey,
                "{\"title\":\"다른 목표\",\"firstAction\":{\"title\":\"다른 행동\",\"estimatedMinutes\":5}}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("IDEMPOTENCY_KEY_REUSED"));

        JsonNode created = json(first);
        String questId = created.at("/quest/id").asText();
        String actionId = created.at("/action/id").asText();
        UUID attemptKey = UUID.randomUUID();
        MvcResult blocked = write(session, post("/api/v1/actions/{id}/attempts", actionId), attemptKey,
                "{\"outcome\":\"BLOCKED\",\"blockerCode\":\"TOO_BIG\",\"note\":\"개인 메모\"}")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.suggestion.estimatedMinutes").value(5))
                .andExpect(jsonPath("$.nextRequiredAction").value("ADAPT_BLOCKED_ACTION"))
                .andReturn();
        String attemptId = json(blocked).at("/attempt/id").asText();
        mvc.perform(get("/api/v1/bootstrap").cookie(new Cookie("rq_session", session.token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pendingAdaptation.attempt.id").value(attemptId))
                .andExpect(jsonPath("$.pendingAdaptation.suggestion.estimatedMinutes").value(5));

        UUID adaptKey = UUID.randomUUID();
        String adaptPayload = "{\"title\":\"회사 한 곳 고르기\",\"estimatedMinutes\":5}";
        MvcResult adapted = write(session, post("/api/v1/attempts/{id}/adaptation", attemptId), adaptKey, adaptPayload)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.action.sourceAttemptId").value(attemptId))
                .andReturn();
        String successorId = json(adapted).at("/action/id").asText();
        write(session, post("/api/v1/attempts/{id}/adaptation", attemptId), adaptKey, adaptPayload)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.action.id").value(successorId));

        write(session, post("/api/v1/actions/{id}/attempts", successorId), UUID.randomUUID(),
                "{\"outcome\":\"DONE\"}")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.nextRequiredAction").value("CREATE_NEXT_ACTION_OR_COMPLETE"));
        mvc.perform(get("/api/v1/history").cookie(new Cookie("rq_session", session.token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[1].successorAction.id").value(successorId));
        write(session, post("/api/v1/quests/{id}/complete", questId), UUID.randomUUID(), "{\"version\":0}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.quest.status").value("COMPLETED"))
                .andExpect(jsonPath("$.nextRequiredAction").value("START_NEW_QUEST"));
    }

    @Test
    void concurrentDoneAndBlockedCreatesExactlyOneAttempt() throws Exception {
        Session session = session();
        MvcResult created = createQuest(session, UUID.randomUUID(), "목표", "동시 요청 행동", 10)
                .andExpect(status().isCreated()).andReturn();
        String actionId = json(created).at("/action/id").asText();
        CountDownLatch start = new CountDownLatch(1);

        try (ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor()) {
            Future<Integer> done = executor.submit(() -> concurrentAttempt(session, actionId,
                    "{\"outcome\":\"DONE\"}", start));
            Future<Integer> blocked = executor.submit(() -> concurrentAttempt(session, actionId,
                    "{\"outcome\":\"BLOCKED\",\"blockerCode\":\"NO_TIME\"}", start));
            start.countDown();
            assertThat(new int[]{done.get(), blocked.get()}).containsExactlyInAnyOrder(201, 409);
        }
        assertThat(jdbc.queryForObject("select count(*) from attempts", Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select status from actions where id = ?", String.class,
                UUID.fromString(actionId))).isIn("DONE", "BLOCKED");
    }

    @Test
    void archiveCancelsReadyActionAndDeleteRemovesEveryWorkspaceRow() throws Exception {
        Session session = session();
        MvcResult created = createQuest(session, UUID.randomUUID(), "목표", "진행 행동", 10)
                .andExpect(status().isCreated()).andReturn();
        String questId = json(created).at("/quest/id").asText();
        write(session, post("/api/v1/quests/{id}/archive", questId), UUID.randomUUID(), "{\"version\":0}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.quest.status").value("ARCHIVED"));
        assertThat(jdbc.queryForObject("select status from actions", String.class)).isEqualTo("CANCELLED");

        mvc.perform(delete("/api/v1/workspace")
                        .cookie(new Cookie("rq_session", session.token))
                        .header("Origin", ORIGIN)
                        .header("X-CSRF-Token", session.csrf)
                        .header("X-Confirm-Delete", "delete-my-data"))
                .andExpect(status().isNoContent())
                .andExpect(header().string("Set-Cookie", org.hamcrest.Matchers.containsString("Max-Age=0")));
        assertThat(jdbc.queryForObject("select count(*) from workspaces", Integer.class)).isZero();
    }

    @Test
    void migrationEnforcesSingleActiveQuestAndSingleReadyAction() {
        UUID workspace = UUID.randomUUID();
        jdbc.update("insert into workspaces(id, timezone, session_hash, csrf_token) values (?, 'Asia/Seoul', ?, 'csrf')",
                workspace, "a".repeat(64));
        UUID firstQuest = UUID.randomUUID();
        jdbc.update("insert into quests(id, workspace_id, status, title) values (?, ?, 'ACTIVE', '첫 목표')",
                firstQuest, workspace);
        assertThatThrownBy(() -> jdbc.update(
                "insert into quests(id, workspace_id, status, title) values (?, ?, 'ACTIVE', '둘째 목표')",
                UUID.randomUUID(), workspace)).isInstanceOf(DataIntegrityViolationException.class);
        jdbc.update("insert into actions(id, workspace_id, quest_id, status, title, estimated_minutes) " +
                "values (?, ?, ?, 'READY', '첫 행동', 5)", UUID.randomUUID(), workspace, firstQuest);
        assertThatThrownBy(() -> jdbc.update(
                "insert into actions(id, workspace_id, quest_id, status, title, estimated_minutes) " +
                        "values (?, ?, ?, 'READY', '둘째 행동', 5)",
                UUID.randomUUID(), workspace, firstQuest)).isInstanceOf(DataIntegrityViolationException.class);
        assertThat(jdbc.queryForObject(
                "select count(*) from flyway_schema_history where success", Integer.class)).isPositive();
        assertThat(jdbc.queryForObject(
                "select count(*) from flyway_schema_history where version = '2' and success", Integer.class))
                .isEqualTo(1);
        assertThat(jdbc.queryForObject(
                "select count(*) from pg_indexes where schemaname = current_schema() " +
                        "and indexname = 'ix_workspaces_cleanup'", Integer.class)).isEqualTo(1);
    }

    @Test
    void forwardMigrationBackfillsExistingV1WorkspaceAtMigrationTime() {
        String schema = "forward_" + UUID.randomUUID().toString().replace("-", "");
        DriverManagerDataSource isolatedDataSource = new DriverManagerDataSource(
                POSTGRES.jdbcUrl(), "postgres", "");
        Flyway.configure().dataSource(isolatedDataSource).schemas(schema).target("1").load().migrate();
        JdbcTemplate isolated = new JdbcTemplate(isolatedDataSource);
        UUID workspaceId = UUID.randomUUID();
        isolated.update("insert into " + schema +
                        ".workspaces(id, timezone, session_hash, csrf_token) values (?, 'UTC', ?, 'csrf')",
                workspaceId, "f".repeat(64));
        OffsetDateTime beforeMigration = isolated.queryForObject("select clock_timestamp()", OffsetDateTime.class);

        Flyway.configure().dataSource(isolatedDataSource).schemas(schema).load().migrate();

        OffsetDateTime backfilled = isolated.queryForObject(
                "select last_activity_at from " + schema + ".workspaces where id = ?",
                OffsetDateTime.class, workspaceId);
        assertThat(backfilled).isNotNull().isAfterOrEqualTo(beforeMigration);
        assertThat(isolated.queryForObject(
                "select count(*) from pg_indexes where schemaname = ? and indexname = 'ix_workspaces_cleanup'",
                Integer.class, schema)).isEqualTo(1);
    }

    @Test
    void cleanupUsesStrictCutoffAndCascadesAllWorkspaceData() throws Exception {
        OffsetDateTime cutoff = OffsetDateTime.parse("2026-01-01T00:00:00Z");
        Session expired = session();
        UUID expiredWorkspace = jdbc.queryForObject("select id from workspaces", UUID.class);
        MvcResult created = createQuest(expired, UUID.randomUUID(), "만료 목표", "만료 행동", 5)
                .andExpect(status().isCreated()).andReturn();
        String actionId = json(created).at("/action/id").asText();
        write(expired, post("/api/v1/actions/{id}/attempts", actionId), UUID.randomUUID(),
                "{\"outcome\":\"DONE\"}").andExpect(status().isCreated());
        jdbc.update("update workspaces set last_activity_at = ? where id = ?", cutoff.minusSeconds(1), expiredWorkspace);

        UUID exactWorkspace = insertWorkspace("1".repeat(64), cutoff);
        UUID recentWorkspace = insertWorkspace("2".repeat(64), cutoff.plusDays(1));
        WorkspaceCleanupService.CleanupResult result = cleanup.cleanupExpiredBefore(cutoff);

        assertThat(result.skipped()).isFalse();
        assertThat(result.deleted()).isEqualTo(1);
        assertThat(result.batches()).isEqualTo(1);
        assertThat(result.backlog()).isZero();
        assertThat(jdbc.queryForObject("select count(*) from quests where workspace_id = ?", Integer.class,
                expiredWorkspace)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from attempts where workspace_id = ?", Integer.class,
                expiredWorkspace)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from idempotency_records where workspace_id = ?",
                Integer.class, expiredWorkspace)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from workspaces where id in (?, ?)", Integer.class,
                exactWorkspace, recentWorkspace)).isEqualTo(2);

        mvc.perform(get("/api/v1/bootstrap").cookie(new Cookie("rq_session", expired.token)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("WORKSPACE_ACCESS_UNAVAILABLE"));
        assertThat(jdbc.queryForObject("select count(*) from workspaces where id = ?", Integer.class,
                expiredWorkspace)).isZero();
    }

    @Test
    void cleanupHasSingleRunnerAndStopsAfterTwentyBatches() throws Exception {
        OffsetDateTime cutoff = OffsetDateTime.parse("2026-01-01T00:00:00Z");
        jdbc.update("insert into workspaces(id, timezone, session_hash, csrf_token, last_activity_at) " +
                "select md5('batch-' || n)::uuid, 'UTC', lpad(n::text, 64, '0'), 'csrf', ? " +
                "from generate_series(1, 10001) n", cutoff.minusDays(1));
        WorkspaceCleanupService.CleanupResult limited = cleanup.cleanupExpiredBefore(cutoff);
        assertThat(limited.deleted()).isEqualTo(10_000);
        assertThat(limited.batches()).isEqualTo(20);
        assertThat(limited.backlog()).isEqualTo(1);

        try (Connection connection = dataSource.getConnection();
                PreparedStatement lock = connection.prepareStatement("select pg_advisory_lock(?)");
                PreparedStatement unlock = connection.prepareStatement("select pg_advisory_unlock(?)")) {
            long lockId = 0x52515354544cL;
            lock.setLong(1, lockId);
            lock.executeQuery().close();
            try {
                WorkspaceCleanupService.CleanupResult skipped = cleanup.cleanupExpiredBefore(cutoff);
                assertThat(skipped.skipped()).isTrue();
                assertThat(skipped.deleted()).isZero();
            } finally {
                unlock.setLong(1, lockId);
                unlock.executeQuery().close();
            }
        }
    }

    @Test
    void healthEndpointIsPublicAndIncludesDatabaseReadiness() throws Exception {
        mvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    void validationResponseAndApplicationLogDoNotExposePrivateInputOrAuthenticationData() throws Exception {
        Session session = session();
        String privateInput = "private-input-marker-".repeat(8);
        Logger logger = (Logger) LoggerFactory.getLogger(ApiExceptionHandler.class);
        ListAppender<ILoggingEvent> events = new ListAppender<>();
        events.start();
        logger.addAppender(events);
        try {
            MvcResult result = write(session, post("/api/v1/quests"), UUID.randomUUID(),
                    objectMapper.writeValueAsString(java.util.Map.of(
                            "title", privateInput,
                            "firstAction", java.util.Map.of("title", "작은 행동", "estimatedMinutes", 5))))
                    .andExpect(status().isBadRequest())
                    .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
                    .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                    .andReturn();
            String response = result.getResponse().getContentAsString();
            assertThat(response).doesNotContain(privateInput, session.token, session.csrf);
            assertThat(events.list).allSatisfy(event -> assertThat(event.getFormattedMessage())
                    .doesNotContain(privateInput, session.token, session.csrf));
        } finally {
            logger.detachAppender(events);
            events.stop();
        }
    }

    private int concurrentAttempt(Session session, String actionId, String payload, CountDownLatch start) throws Exception {
        start.await();
        return write(session, post("/api/v1/actions/{id}/attempts", actionId), UUID.randomUUID(), payload)
                .andReturn().getResponse().getStatus();
    }

    private org.springframework.test.web.servlet.ResultActions createQuest(
            Session session, UUID key, String questTitle, String actionTitle, int minutes) throws Exception {
        String payload = objectMapper.writeValueAsString(java.util.Map.of(
                "title", questTitle,
                "firstAction", java.util.Map.of("title", actionTitle, "estimatedMinutes", minutes)));
        return write(session, post("/api/v1/quests"), key, payload);
    }

    private org.springframework.test.web.servlet.ResultActions write(
            Session session,
            org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request,
            UUID key,
            String body) throws Exception {
        return mvc.perform(request
                .cookie(new Cookie("rq_session", session.token))
                .header("Origin", ORIGIN)
                .header("X-CSRF-Token", session.csrf)
                .header("Idempotency-Key", key)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body));
    }

    private Session session() throws Exception {
        MvcResult result = mvc.perform(post("/api/v1/session")
                        .header("Origin", ORIGIN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"timezone\":\"Asia/Seoul\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.csrfToken").isString())
                .andExpect(jsonPath("$.workspaceExpiresAt").isString())
                .andExpect(header().string("Set-Cookie",
                        org.hamcrest.Matchers.containsString("Max-Age=7776000")))
                .andReturn();
        String setCookie = result.getResponse().getHeader("Set-Cookie");
        assertThat(setCookie).isNotNull();
        String token = setCookie.substring("rq_session=".length(), setCookie.indexOf(';'));
        return new Session(token, json(result).get("csrfToken").asText());
    }

    private JsonNode json(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsByteArray());
    }

    private OffsetDateTime lastActivity(UUID workspaceId) {
        return jdbc.queryForObject("select last_activity_at from workspaces where id = ?",
                OffsetDateTime.class, workspaceId);
    }

    private UUID insertWorkspace(String sessionHash, OffsetDateTime lastActivity) {
        UUID workspaceId = UUID.randomUUID();
        jdbc.update("insert into workspaces(id, timezone, session_hash, csrf_token, last_activity_at) " +
                        "values (?, 'UTC', ?, 'csrf', ?)",
                workspaceId, sessionHash, lastActivity);
        return workspaceId;
    }

    private static TestPostgres startPostgres() {
        try {
            return TestPostgres.start();
        } catch (IOException exception) {
            throw new ExceptionInInitializerError(exception);
        }
    }

    private record Session(String token, String csrf) {}
}
