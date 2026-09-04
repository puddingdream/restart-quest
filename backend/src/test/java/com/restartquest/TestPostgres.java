package com.restartquest;

import io.zonky.test.db.postgres.embedded.DefaultPostgresBinaryResolver;
import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.apache.commons.compress.archivers.tar.TarArchiveEntry;
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream;
import org.apache.commons.compress.compressors.xz.XZCompressorInputStream;

import java.io.IOException;
import java.io.InputStream;
import java.net.ServerSocket;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.TimeUnit;

final class TestPostgres implements AutoCloseable {
    private final EmbeddedPostgres embedded;
    private final Process directProcess;
    private final String jdbcUrl;

    private TestPostgres(EmbeddedPostgres embedded, Process directProcess, String jdbcUrl) {
        this.embedded = embedded;
        this.directProcess = directProcess;
        this.jdbcUrl = jdbcUrl;
    }

    static TestPostgres start() throws IOException {
        if (!System.getProperty("os.name").startsWith("Windows")) {
            EmbeddedPostgres postgres = EmbeddedPostgres.builder().start();
            return new TestPostgres(postgres, null, postgres.getJdbcUrl("postgres", "postgres"));
        }
        return startDirectOnWindows();
    }

    String jdbcUrl() {
        return jdbcUrl;
    }

    @Override
    public void close() throws IOException {
        if (embedded != null) {
            embedded.close();
            return;
        }
        directProcess.destroy();
        try {
            if (!directProcess.waitFor(5, TimeUnit.SECONDS)) directProcess.destroyForcibly();
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            directProcess.destroyForcibly();
        }
    }

    private static TestPostgres startDirectOnWindows() throws IOException {
        Path root = Files.createTempDirectory("restart-quest-postgres-");
        Path install = root.resolve("install");
        Path data = root.resolve("data");
        extractWindowsDistribution(install);
        runAndWait(List.of(
                install.resolve("bin/initdb.exe").toString(),
                "-D", data.toString(), "-U", "postgres", "-A", "trust", "-E", "UTF8", "--no-sync"));

        int port;
        try (ServerSocket socket = new ServerSocket(0)) {
            port = socket.getLocalPort();
        }
        ProcessBuilder builder = new ProcessBuilder(
                install.resolve("bin/postgres.exe").toString(),
                "-D", data.toString(), "-h", "127.0.0.1", "-p", Integer.toString(port),
                "-F", "-c", "synchronous_commit=off", "-c", "full_page_writes=off");
        builder.environment().put("PG_RESTRICT_EXEC", "1");
        builder.redirectOutput(ProcessBuilder.Redirect.DISCARD);
        builder.redirectError(ProcessBuilder.Redirect.DISCARD);
        Process process = builder.start();
        String jdbcUrl = "jdbc:postgresql://127.0.0.1:" + port + "/postgres";
        waitForConnection(process, jdbcUrl, Duration.ofSeconds(15));
        return new TestPostgres(null, process, jdbcUrl);
    }

    private static void extractWindowsDistribution(Path install) throws IOException {
        Files.createDirectories(install);
        try (InputStream binary = DefaultPostgresBinaryResolver.INSTANCE
                        .getPgBinary("Windows", System.getProperty("os.arch"));
                XZCompressorInputStream xz = new XZCompressorInputStream(binary);
                TarArchiveInputStream tar = new TarArchiveInputStream(xz)) {
            TarArchiveEntry entry;
            while ((entry = tar.getNextEntry()) != null) {
                Path target = install.resolve(entry.getName()).normalize();
                if (!target.startsWith(install)) throw new IOException("Unsafe PostgreSQL archive entry");
                if (entry.isDirectory()) {
                    Files.createDirectories(target);
                } else {
                    Files.createDirectories(target.getParent());
                    Files.copy(tar, target, StandardCopyOption.REPLACE_EXISTING);
                }
            }
        }
    }

    private static void runAndWait(List<String> command) throws IOException {
        ProcessBuilder builder = new ProcessBuilder(command);
        builder.environment().put("PG_RESTRICT_EXEC", "1");
        builder.redirectOutput(ProcessBuilder.Redirect.DISCARD);
        builder.redirectError(ProcessBuilder.Redirect.DISCARD);
        Process process = builder.start();
        try {
            if (!process.waitFor(30, TimeUnit.SECONDS) || process.exitValue() != 0) {
                process.destroyForcibly();
                throw new IOException("PostgreSQL initialization did not complete");
            }
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            process.destroyForcibly();
            throw new IOException("PostgreSQL initialization interrupted", exception);
        }
    }

    private static void waitForConnection(Process process, String jdbcUrl, Duration timeout) throws IOException {
        Instant deadline = Instant.now().plus(timeout);
        SQLException last = null;
        while (Instant.now().isBefore(deadline)) {
            if (!process.isAlive()) throw new IOException("PostgreSQL process exited before accepting connections");
            try (Connection ignored = DriverManager.getConnection(jdbcUrl, "postgres", "")) {
                return;
            } catch (SQLException exception) {
                last = exception;
                try {
                    Thread.sleep(100);
                } catch (InterruptedException interrupted) {
                    Thread.currentThread().interrupt();
                    throw new IOException("PostgreSQL startup interrupted", interrupted);
                }
            }
        }
        process.destroyForcibly();
        throw new IOException("PostgreSQL did not accept connections", last);
    }
}
