package com.restartquest.session;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import io.zonky.test.db.postgres.embedded.DefaultPostgresBinaryResolver;
import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import com.restartquest.app.RestartQuestApplication;
import java.io.IOException;
import java.io.InputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Timestamp;
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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest(classes = RestartQuestApplication.class)
@AutoConfigureMockMvc
class PostgresFoundationIntegrationTest {

    private static final TestPostgres POSTGRES = startPostgres();

    @Autowired
    private MockMvc mockMvc;

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
    void migrationCreatesAllFoundationTablesAndConstraints() {
        assertThat(jdbcTemplate.queryForList(
                        """
                        SELECT table_name FROM information_schema.tables
                        WHERE table_schema = 'public'
                        """,
                        String.class))
                .contains("participant_session", "journey", "quest_attempt", "command_receipt");

        UUID sessionId = insertSession("a".repeat(64));
        UUID firstJourneyId = insertJourney(sessionId);

        assertThatThrownBy(() -> insertJourney(sessionId))
                .hasMessageContaining("uq_journey_participant_session");

        insertActiveAttempt(firstJourneyId, "first-v1");
        assertThatThrownBy(() -> insertActiveAttempt(firstJourneyId, "second-v1"))
                .hasMessageContaining("uq_quest_attempt_one_active_per_journey");
    }

    @Test
    void sessionApiIsolatesTokensStoresOnlyDigestsAndReportsDatabaseHealth() throws Exception {
        MvcResult first = mockMvc.perform(post("/api/v1/session"))
                .andExpect(status().isCreated())
                .andReturn();
        MvcResult second = mockMvc.perform(post("/api/v1/session"))
                .andExpect(status().isCreated())
                .andReturn();

        String firstToken = first.getResponse().getCookie("rq_session").getValue();
        String secondToken = second.getResponse().getCookie("rq_session").getValue();
        assertThat(firstToken).isNotEqualTo(secondToken);

        var digests = jdbcTemplate.queryForList(
                "SELECT token_digest FROM participant_session", String.class);
        assertThat(digests).hasSizeGreaterThanOrEqualTo(2)
                .allMatch(value -> value.matches("[0-9a-f]{64}"))
                .doesNotContain(firstToken, secondToken);

        mockMvc.perform(post("/api/v1/session")
                        .cookie(new jakarta.servlet.http.Cookie("rq_session", firstToken)))
                .andExpect(status().isOk());
        assertThat(jdbcTemplate.queryForObject(
                "SELECT count(*) FROM participant_session", Integer.class)).isEqualTo(digests.size());

        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    private UUID insertSession(String digest) {
        UUID id = UUID.randomUUID();
        Instant now = Instant.now();
        jdbcTemplate.update(
                """
                INSERT INTO participant_session
                    (id, token_digest, expires_at, last_seen_at, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                id,
                digest,
                Timestamp.from(now.plusSeconds(3600)),
                Timestamp.from(now),
                Timestamp.from(now));
        return id;
    }

    private UUID insertJourney(UUID sessionId) {
        UUID id = UUID.randomUUID();
        Instant now = Instant.now();
        jdbcTemplate.update(
                """
                INSERT INTO journey
                    (id, participant_session_id, goal_type, energy_level,
                     available_minutes, version, created_at, updated_at)
                VALUES (?, ?, 'JOB_SEARCH', 'LOW', 5, 0, ?, ?)
                """,
                id,
                sessionId,
                Timestamp.from(now),
                Timestamp.from(now));
        return id;
    }

    private void insertActiveAttempt(UUID journeyId, String catalogKey) {
        Instant now = Instant.now();
        jdbcTemplate.update(
                """
                INSERT INTO quest_attempt
                    (id, journey_id, catalog_key, title, instruction,
                     estimated_minutes, difficulty_level, status, created_at)
                VALUES (?, ?, ?, 'title', 'instruction', 2, 1, 'ACTIVE', ?)
                """,
                UUID.randomUUID(),
                journeyId,
                catalogKey,
                Timestamp.from(now));
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

    /**
     * PostgreSQL's Windows pg_ctl creates a second restricted token before it
     * starts postgres. Managed provider sandboxes reject that Windows API call,
     * so tests start the same disposable binary directly and still execute the
     * real PostgreSQL migration and constraints.
     */
    private record DirectWindowsPostgres(Process process, String jdbcUrl) implements TestPostgres {

        private static DirectWindowsPostgres start() throws Exception {
            Path postgresHome = extractPostgres();
            Path dataDirectory = Files.createTempDirectory("restart-quest-pg-data-");
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
            Path destination = Files.createTempDirectory("restart-quest-pg-bin-");
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
