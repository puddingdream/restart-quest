package com.restartquest.quest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.restartquest.app.RestartQuestApplication;
import io.zonky.test.db.postgres.embedded.DefaultPostgresBinaryResolver;
import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import jakarta.servlet.http.Cookie;
import java.io.IOException;
import java.io.InputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import org.apache.commons.compress.archivers.tar.TarArchiveEntry;
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream;
import org.apache.commons.compress.compressors.xz.XZCompressorInputStream;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest(classes = RestartQuestApplication.class)
@AutoConfigureMockMvc
class QuestLoopIntegrationTest {

    private static final TestPostgres POSTGRES = startPostgres();

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::jdbcUrl);
        registry.add("spring.datasource.username", () -> "postgres");
        registry.add("spring.datasource.password", () -> "");
    }

    @AfterAll
    static void stopPostgres() throws Exception {
        POSTGRES.close();
    }

    @Test
    void sessionsCanOnlyReadAndChangeTheirOwnJourney() throws Exception {
        Cookie firstSession = startSession();
        Cookie secondSession = startSession();
        JsonNode firstJourney = createJourney(
                firstSession, "JOB_SEARCH", "LOW", 5, UUID.randomUUID());
        JsonNode secondJourney = createJourney(
                secondSession, "RESUME", "HIGH", 30, UUID.randomUUID());

        assertThat(firstJourney.path("journeyId").asText())
                .isNotEqualTo(secondJourney.path("journeyId").asText());
        mockMvc.perform(get("/api/v1/journey").cookie(firstSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.goalType").value("JOB_SEARCH"))
                .andExpect(jsonPath("$.journeyId").value(firstJourney.path("journeyId").asText()));

        UUID firstQuestId = UUID.fromString(firstJourney.at("/currentQuest/id").asText());
        mockMvc.perform(post("/api/v1/quests/{questId}/complete", firstQuestId)
                        .cookie(secondSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"commandId":"%s","expectedVersion":1}
                                """.formatted(UUID.randomUUID())))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("QUEST_NOT_FOUND"));

        mockMvc.perform(get("/api/v1/journey").cookie(firstSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value(1))
                .andExpect(jsonPath("$.currentQuest.id").value(firstQuestId.toString()));
    }

    @Test
    void completionAndReframeEndThePreviousAttemptAndCreateOneActiveAttemptAtomically()
            throws Exception {
        Cookie session = startSession();
        JsonNode created = createJourney(
                session, "NETWORKING", "HIGH", 30, UUID.randomUUID());
        UUID firstQuestId = UUID.fromString(created.at("/currentQuest/id").asText());

        JsonNode completed = json(mockMvc.perform(post(
                                "/api/v1/quests/{questId}/complete", firstQuestId)
                        .cookie(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"commandId":"%s","expectedVersion":1}
                                """.formatted(UUID.randomUUID())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.transition.type").value("COMPLETED"))
                .andExpect(jsonPath("$.transition.previousAttemptId").value(firstQuestId.toString()))
                .andExpect(jsonPath("$.snapshot.version").value(2))
                .andExpect(jsonPath("$.snapshot.progress.completedCount").value(1))
                .andReturn());

        UUID journeyId = UUID.fromString(created.path("journeyId").asText());
        UUID secondQuestId = UUID.fromString(completed.at("/snapshot/currentQuest/id").asText());
        assertOneActiveAttempt(journeyId);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT status FROM quest_attempt WHERE id = ?", String.class, firstQuestId))
                .isEqualTo("COMPLETED");

        JsonNode reframed = json(mockMvc.perform(post(
                                "/api/v1/quests/{questId}/reframe", secondQuestId)
                        .cookie(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"reason":"TOO_BIG","commandId":"%s","expectedVersion":2}
                                """.formatted(UUID.randomUUID())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.transition.type").value("REFRAMED"))
                .andExpect(jsonPath("$.transition.reason").value("TOO_BIG"))
                .andExpect(jsonPath("$.snapshot.version").value(3))
                .andExpect(jsonPath("$.snapshot.progress.completedCount").value(1))
                .andExpect(jsonPath("$.snapshot.progress.reframedCount").value(1))
                .andExpect(jsonPath("$.snapshot.recentAttempts.length()").value(2))
                .andReturn());

        UUID thirdQuestId = UUID.fromString(reframed.at("/snapshot/currentQuest/id").asText());
        assertOneActiveAttempt(journeyId);
        assertThat(reframed.at("/snapshot/currentQuest/difficultyLevel").asInt())
                .isLessThan(created.at("/currentQuest/difficultyLevel").asInt());
        assertThat(jdbcTemplate.queryForObject(
                "SELECT parent_attempt_id FROM quest_attempt WHERE id = ?",
                UUID.class,
                thirdQuestId))
                .isEqualTo(secondQuestId);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT friction_reason FROM quest_attempt WHERE id = ?",
                String.class,
                secondQuestId))
                .isEqualTo("TOO_BIG");
    }

    @Test
    void commandReplayIsStableAndRejectsDifferentPayloadInactiveQuestAndStaleVersion()
            throws Exception {
        Cookie session = startSession();
        UUID createCommandId = UUID.randomUUID();
        MvcResult firstCreate = performCreateJourney(
                session, "RESUME", "MEDIUM", 15, createCommandId)
                .andExpect(status().isCreated())
                .andReturn();
        MvcResult replayedCreate = performCreateJourney(
                session, "RESUME", "MEDIUM", 15, createCommandId)
                .andExpect(status().isCreated())
                .andReturn();
        assertThat(replayedCreate.getResponse().getContentAsString())
                .isEqualTo(firstCreate.getResponse().getContentAsString());

        performCreateJourney(session, "JOB_SEARCH", "MEDIUM", 15, createCommandId)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("COMMAND_ID_REUSED"));

        JsonNode created = json(firstCreate);
        UUID journeyId = UUID.fromString(created.path("journeyId").asText());
        UUID firstQuestId = UUID.fromString(created.at("/currentQuest/id").asText());
        UUID completeCommandId = UUID.randomUUID();
        String completeBody = """
                {"commandId":"%s","expectedVersion":1}
                """.formatted(completeCommandId);
        MvcResult firstComplete = mockMvc.perform(post(
                                "/api/v1/quests/{questId}/complete", firstQuestId)
                        .cookie(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(completeBody))
                .andExpect(status().isOk())
                .andReturn();
        MvcResult replayedComplete = mockMvc.perform(post(
                                "/api/v1/quests/{questId}/complete", firstQuestId)
                        .cookie(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(completeBody))
                .andExpect(status().isOk())
                .andReturn();
        assertThat(replayedComplete.getResponse().getContentAsString())
                .isEqualTo(firstComplete.getResponse().getContentAsString());
        assertThat(jdbcTemplate.queryForObject(
                "SELECT count(*) FROM quest_attempt WHERE journey_id = ?", Integer.class, journeyId))
                .isEqualTo(2);

        mockMvc.perform(post("/api/v1/quests/{questId}/complete", firstQuestId)
                        .cookie(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"commandId":"%s","expectedVersion":2}
                                """.formatted(completeCommandId)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("COMMAND_ID_REUSED"));

        mockMvc.perform(post("/api/v1/quests/{questId}/complete", firstQuestId)
                        .cookie(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"commandId":"%s","expectedVersion":2}
                                """.formatted(UUID.randomUUID())))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("QUEST_NOT_ACTIVE"));

        UUID currentQuestId = UUID.fromString(json(firstComplete)
                .at("/snapshot/currentQuest/id").asText());
        mockMvc.perform(post("/api/v1/quests/{questId}/reframe", currentQuestId)
                        .cookie(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"reason":"UNCLEAR","commandId":"%s","expectedVersion":1}
                                """.formatted(UUID.randomUUID())))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("STALE_JOURNEY"))
                .andExpect(jsonPath("$.snapshot.version").value(2))
                .andExpect(jsonPath("$.snapshot.currentQuest.id").value(currentQuestId.toString()));
        assertOneActiveAttempt(journeyId);
    }

    @Test
    void apiReturnsDocumentedErrorsForMissingSessionJourneyAndInvalidInput() throws Exception {
        mockMvc.perform(get("/api/v1/journey"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("SESSION_REQUIRED"));

        Cookie session = startSession();
        mockMvc.perform(get("/api/v1/journey").cookie(session))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("JOURNEY_NOT_FOUND"));

        performCreateJourney(session, "JOB_SEARCH", "LOW", 10, UUID.randomUUID())
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors.availableMinutes").exists());
    }

    private Cookie startSession() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/session"))
                .andExpect(status().isCreated())
                .andReturn();
        return result.getResponse().getCookie("rq_session");
    }

    private JsonNode createJourney(
            Cookie session,
            String goalType,
            String energyLevel,
            int availableMinutes,
            UUID commandId) throws Exception {
        return json(performCreateJourney(session, goalType, energyLevel, availableMinutes, commandId)
                .andExpect(status().isCreated())
                .andReturn());
    }

    private org.springframework.test.web.servlet.ResultActions performCreateJourney(
            Cookie session,
            String goalType,
            String energyLevel,
            int availableMinutes,
            UUID commandId) throws Exception {
        return mockMvc.perform(post("/api/v1/journey")
                .cookie(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"goalType":"%s","energyLevel":"%s","availableMinutes":%d,"commandId":"%s"}
                        """.formatted(goalType, energyLevel, availableMinutes, commandId)));
    }

    private JsonNode json(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsByteArray());
    }

    private void assertOneActiveAttempt(UUID journeyId) {
        assertThat(jdbcTemplate.queryForObject(
                "SELECT count(*) FROM quest_attempt WHERE journey_id = ? AND status = 'ACTIVE'",
                Integer.class,
                journeyId))
                .isEqualTo(1);
    }

    private static TestPostgres startPostgres() {
        try {
            if (System.getProperty("os.name").toLowerCase(Locale.ROOT).contains("windows")) {
                return DirectWindowsPostgres.start();
            }
            EmbeddedPostgres postgres = EmbeddedPostgres.builder().start();
            return new TestPostgres() {
                @Override
                public String jdbcUrl() {
                    return postgres.getJdbcUrl("postgres", "postgres");
                }

                @Override
                public void close() throws IOException {
                    postgres.close();
                }
            };
        } catch (Exception exception) {
            throw new ExceptionInInitializerError(exception);
        }
    }

    private interface TestPostgres extends AutoCloseable {
        String jdbcUrl();
    }

    private record DirectWindowsPostgres(Process process, String jdbcUrl) implements TestPostgres {

        private static DirectWindowsPostgres start() throws Exception {
            Path postgresHome = extractPostgres();
            Path dataDirectory = Files.createTempDirectory("restart-quest-loop-pg-data-");
            Path initdb = findBinary(postgresHome, "initdb.exe");
            Path postgres = findBinary(postgresHome, "postgres.exe");

            ProcessBuilder init = new ProcessBuilder(
                    initdb.toString(),
                    "--pgdata=" + dataDirectory,
                    "--username=postgres",
                    "--auth=trust",
                    "--encoding=UTF8",
                    "--locale=C");
            init.environment().put("PG_RESTRICT_EXEC", "1");
            init.redirectErrorStream(true).redirectOutput(ProcessBuilder.Redirect.DISCARD);
            int initExit = init.start().waitFor();
            if (initExit != 0) {
                throw new IllegalStateException("initdb failed with exit code " + initExit);
            }

            int port = availablePort();
            ProcessBuilder server = new ProcessBuilder(
                    postgres.toString(),
                    "-D", dataDirectory.toString(),
                    "-h", "127.0.0.1",
                    "-p", Integer.toString(port),
                    "-F");
            server.environment().put("PG_RESTRICT_EXEC", "1");
            server.redirectErrorStream(true).redirectOutput(ProcessBuilder.Redirect.DISCARD);
            Process process = server.start();
            String jdbcUrl = "jdbc:postgresql://127.0.0.1:" + port + "/postgres";
            awaitReady(process, jdbcUrl);
            return new DirectWindowsPostgres(process, jdbcUrl);
        }

        @Override
        public void close() throws InterruptedException {
            process.destroy();
            if (!process.waitFor(5, TimeUnit.SECONDS)) {
                process.destroyForcibly();
                process.waitFor(5, TimeUnit.SECONDS);
            }
        }

        private static Path extractPostgres() throws IOException {
            Path destination = Files.createTempDirectory("restart-quest-loop-pg-bin-");
            try (InputStream binary = DefaultPostgresBinaryResolver.INSTANCE
                            .getPgBinary("Windows", System.getProperty("os.arch"));
                    XZCompressorInputStream xz = new XZCompressorInputStream(binary);
                    TarArchiveInputStream archive = new TarArchiveInputStream(xz)) {
                TarArchiveEntry entry;
                while ((entry = archive.getNextEntry()) != null) {
                    Path output = destination.resolve(entry.getName()).normalize();
                    if (!output.startsWith(destination)) {
                        throw new IOException("Invalid PostgreSQL binary archive entry");
                    }
                    if (entry.isDirectory()) {
                        Files.createDirectories(output);
                    } else {
                        Files.createDirectories(output.getParent());
                        Files.copy(archive, output, StandardCopyOption.REPLACE_EXISTING);
                    }
                }
            }
            return destination;
        }

        private static Path findBinary(Path directory, String filename) throws IOException {
            try (var paths = Files.walk(directory)) {
                return paths.filter(path -> path.getFileName().toString().equals(filename))
                        .findFirst()
                        .orElseThrow(() -> new IOException(filename + " is missing"));
            }
        }

        private static int availablePort() throws IOException {
            try (ServerSocket socket = new ServerSocket(0, 1, InetAddress.getLoopbackAddress())) {
                return socket.getLocalPort();
            }
        }

        private static void awaitReady(Process process, String jdbcUrl) throws Exception {
            Instant deadline = Instant.now().plus(Duration.ofSeconds(15));
            SQLException latest = null;
            while (Instant.now().isBefore(deadline)) {
                if (!process.isAlive()) {
                    throw new IllegalStateException("postgres exited with code " + process.exitValue());
                }
                try (var ignored = DriverManager.getConnection(jdbcUrl, "postgres", "")) {
                    return;
                } catch (SQLException exception) {
                    latest = exception;
                    Thread.sleep(100);
                }
            }
            process.destroyForcibly();
            throw new IllegalStateException("postgres did not become ready", latest);
        }
    }
}
