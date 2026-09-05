package com.restartquest.infra;

import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.stereotype.Service;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;

@Service
public class WorkspaceCleanupService {
    static final int BATCH_SIZE = 500;
    static final int MAX_BATCHES = 20;
    private static final long ADVISORY_LOCK_ID = 0x52515354544cL;

    private final DataSource dataSource;

    public WorkspaceCleanupService(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    public CleanupResult cleanupExpired() {
        return execute(null);
    }

    /** Executes the same cleanup algorithm with an already fixed cutoff, primarily for deterministic verification. */
    public CleanupResult cleanupExpiredBefore(OffsetDateTime fixedCutoff) {
        if (fixedCutoff == null) throw new IllegalArgumentException("fixedCutoff is required");
        return execute(fixedCutoff);
    }

    private CleanupResult execute(OffsetDateTime requestedCutoff) {
        try (Connection connection = dataSource.getConnection()) {
            connection.setAutoCommit(true);
            if (!tryLock(connection)) return CleanupResult.skippedResult();
            try {
                OffsetDateTime cutoff = requestedCutoff == null ? databaseCutoff(connection) : requestedCutoff;
                int deleted = 0;
                int batches = 0;
                while (batches < MAX_BATCHES) {
                    int batchDeleted = deleteBatch(connection, cutoff);
                    if (batchDeleted == 0) break;
                    deleted += batchDeleted;
                    batches++;
                    if (batchDeleted < BATCH_SIZE) break;
                }
                long backlog = countBacklog(connection, cutoff);
                return new CleanupResult(false, deleted, batches, backlog, cutoff);
            } finally {
                unlock(connection);
            }
        } catch (SQLException exception) {
            throw new DataAccessResourceFailureException("Workspace cleanup could not complete", exception);
        }
    }

    private boolean tryLock(Connection connection) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("select pg_try_advisory_lock(?)")) {
            statement.setLong(1, ADVISORY_LOCK_ID);
            try (ResultSet rows = statement.executeQuery()) {
                return rows.next() && rows.getBoolean(1);
            }
        }
    }

    private void unlock(Connection connection) throws SQLException {
        connection.setAutoCommit(true);
        try (PreparedStatement statement = connection.prepareStatement("select pg_advisory_unlock(?)")) {
            statement.setLong(1, ADVISORY_LOCK_ID);
            statement.executeQuery().close();
        }
    }

    private OffsetDateTime databaseCutoff(Connection connection) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "select clock_timestamp() - interval '90 days'");
                ResultSet rows = statement.executeQuery()) {
            if (!rows.next()) throw new SQLException("Database clock query returned no row");
            return rows.getObject(1, OffsetDateTime.class);
        }
    }

    private int deleteBatch(Connection connection, OffsetDateTime cutoff) throws SQLException {
        String sql = "with candidates as (" +
                "select id from workspaces where last_activity_at < ? " +
                "order by last_activity_at, id for update skip locked limit " + BATCH_SIZE + ") " +
                "delete from workspaces w using candidates c " +
                "where w.id = c.id and w.last_activity_at < ? returning w.id";
        boolean originalAutoCommit = connection.getAutoCommit();
        connection.setAutoCommit(false);
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setObject(1, cutoff);
            statement.setObject(2, cutoff);
            int deleted = 0;
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) deleted++;
            }
            connection.commit();
            return deleted;
        } catch (SQLException exception) {
            connection.rollback();
            throw exception;
        } finally {
            connection.setAutoCommit(originalAutoCommit);
        }
    }

    private long countBacklog(Connection connection, OffsetDateTime cutoff) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "select count(*) from workspaces where last_activity_at < ?")) {
            statement.setObject(1, cutoff);
            try (ResultSet rows = statement.executeQuery()) {
                if (!rows.next()) throw new SQLException("Backlog query returned no row");
                return rows.getLong(1);
            }
        }
    }

    public record CleanupResult(boolean skipped, int deleted, int batches, long backlog,
            OffsetDateTime cutoff) {
        static CleanupResult skippedResult() {
            return new CleanupResult(true, 0, 0, 0, null);
        }
    }
}
