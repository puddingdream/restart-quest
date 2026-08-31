package com.restartquest.quest;

import static com.restartquest.quest.QuestModels.AttemptRow;
import static com.restartquest.quest.QuestModels.CatalogAction;
import static com.restartquest.quest.QuestModels.CommandReceipt;
import static com.restartquest.quest.QuestModels.EnergyLevel;
import static com.restartquest.quest.QuestModels.FrictionReason;
import static com.restartquest.quest.QuestModels.GoalType;
import static com.restartquest.quest.QuestModels.JourneyRow;
import static com.restartquest.quest.QuestModels.QuestStatus;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
class QuestRepository {

    private final JdbcTemplate jdbcTemplate;

    QuestRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    Optional<UUID> findActiveSession(String tokenDigest, Instant now, boolean forUpdate) {
        String lock = forUpdate ? " FOR UPDATE" : "";
        return jdbcTemplate.query(
                        "SELECT id FROM participant_session WHERE token_digest = ? AND expires_at > ?" + lock,
                        (resultSet, rowNumber) -> resultSet.getObject("id", UUID.class),
                        tokenDigest,
                        Timestamp.from(now))
                .stream()
                .findFirst();
    }

    Optional<CommandReceipt> findReceipt(UUID sessionId, UUID commandId) {
        return jdbcTemplate.query(
                        """
                        SELECT request_fingerprint, response_status, response_body::text AS response_body
                        FROM command_receipt
                        WHERE participant_session_id = ? AND command_id = ?
                        """,
                        (resultSet, rowNumber) -> new CommandReceipt(
                                resultSet.getString("request_fingerprint"),
                                resultSet.getInt("response_status"),
                                resultSet.getString("response_body")),
                        sessionId,
                        commandId)
                .stream()
                .findFirst();
    }

    void insertReceipt(
            UUID sessionId,
            UUID commandId,
            String fingerprint,
            int responseStatus,
            String responseBody,
            Instant createdAt) {
        jdbcTemplate.update(
                """
                INSERT INTO command_receipt
                    (id, participant_session_id, command_id, request_fingerprint,
                     response_status, response_body, created_at)
                VALUES (?, ?, ?, ?, ?, CAST(? AS jsonb), ?)
                """,
                UUID.randomUUID(),
                sessionId,
                commandId,
                fingerprint,
                responseStatus,
                responseBody,
                Timestamp.from(createdAt));
    }

    boolean journeyExists(UUID sessionId) {
        return Boolean.TRUE.equals(jdbcTemplate.queryForObject(
                "SELECT EXISTS(SELECT 1 FROM journey WHERE participant_session_id = ?)",
                Boolean.class,
                sessionId));
    }

    void insertJourney(
            UUID journeyId,
            UUID sessionId,
            GoalType goalType,
            EnergyLevel energyLevel,
            int availableMinutes,
            long version,
            Instant now) {
        jdbcTemplate.update(
                """
                INSERT INTO journey
                    (id, participant_session_id, goal_type, energy_level,
                     available_minutes, version, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                journeyId,
                sessionId,
                goalType.name(),
                energyLevel.name(),
                availableMinutes,
                version,
                Timestamp.from(now),
                Timestamp.from(now));
    }

    void insertAttempt(
            UUID attemptId,
            UUID journeyId,
            UUID parentAttemptId,
            CatalogAction action,
            Instant now) {
        jdbcTemplate.update(
                """
                INSERT INTO quest_attempt
                    (id, journey_id, parent_attempt_id, catalog_key, title,
                     instruction, estimated_minutes, difficulty_level,
                     status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)
                """,
                attemptId,
                journeyId,
                parentAttemptId,
                action.key(),
                action.title(),
                action.instruction(),
                action.estimatedMinutes(),
                action.difficultyLevel(),
                Timestamp.from(now));
    }

    Optional<JourneyRow> findJourney(UUID sessionId, boolean forUpdate) {
        String lock = forUpdate ? " FOR UPDATE" : "";
        return jdbcTemplate.query(
                        """
                        SELECT id, participant_session_id, goal_type, energy_level,
                               available_minutes, version
                        FROM journey
                        WHERE participant_session_id = ?
                        """ + lock,
                        (resultSet, rowNumber) -> new JourneyRow(
                                resultSet.getObject("id", UUID.class),
                                resultSet.getObject("participant_session_id", UUID.class),
                                GoalType.valueOf(resultSet.getString("goal_type")),
                                EnergyLevel.valueOf(resultSet.getString("energy_level")),
                                resultSet.getInt("available_minutes"),
                                resultSet.getLong("version")),
                        sessionId)
                .stream()
                .findFirst();
    }

    Optional<AttemptRow> findActiveAttempt(UUID journeyId) {
        return jdbcTemplate.query(
                        """
                        SELECT id, journey_id, catalog_key, title, instruction,
                               estimated_minutes, difficulty_level, status,
                               friction_reason, transitioned_at
                        FROM quest_attempt
                        WHERE journey_id = ? AND status = 'ACTIVE'
                        """,
                        this::mapAttempt,
                        journeyId)
                .stream()
                .findFirst();
    }

    boolean attemptBelongsToJourney(UUID attemptId, UUID journeyId) {
        return Boolean.TRUE.equals(jdbcTemplate.queryForObject(
                "SELECT EXISTS(SELECT 1 FROM quest_attempt WHERE id = ? AND journey_id = ?)",
                Boolean.class,
                attemptId,
                journeyId));
    }

    void finishAttempt(
            UUID attemptId,
            QuestStatus status,
            FrictionReason reason,
            Instant now) {
        int updated = jdbcTemplate.update(
                """
                UPDATE quest_attempt
                SET status = ?, friction_reason = ?, transitioned_at = ?
                WHERE id = ? AND status = 'ACTIVE'
                """,
                status.name(),
                reason == null ? null : reason.name(),
                Timestamp.from(now),
                attemptId);
        if (updated != 1) {
            throw new IllegalStateException("active quest transition lost its lock");
        }
    }

    void incrementJourneyVersion(UUID journeyId, long currentVersion, Instant now) {
        int updated = jdbcTemplate.update(
                """
                UPDATE journey
                SET version = version + 1, updated_at = ?
                WHERE id = ? AND version = ?
                """,
                Timestamp.from(now),
                journeyId,
                currentVersion);
        if (updated != 1) {
            throw new IllegalStateException("journey version update lost its lock");
        }
    }

    int countAttempts(UUID journeyId, QuestStatus status) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM quest_attempt WHERE journey_id = ? AND status = ?",
                Integer.class,
                journeyId,
                status.name());
        return count == null ? 0 : count;
    }

    List<AttemptRow> findRecentAttempts(UUID journeyId) {
        return jdbcTemplate.query(
                """
                SELECT id, journey_id, catalog_key, title, instruction,
                       estimated_minutes, difficulty_level, status,
                       friction_reason, transitioned_at
                FROM quest_attempt
                WHERE journey_id = ? AND status <> 'ACTIVE'
                ORDER BY transitioned_at DESC, created_at DESC
                LIMIT 5
                """,
                this::mapAttempt,
                journeyId);
    }

    private AttemptRow mapAttempt(java.sql.ResultSet resultSet, int rowNumber)
            throws java.sql.SQLException {
        String reason = resultSet.getString("friction_reason");
        Timestamp transitionedAt = resultSet.getTimestamp("transitioned_at");
        return new AttemptRow(
                resultSet.getObject("id", UUID.class),
                resultSet.getObject("journey_id", UUID.class),
                resultSet.getString("catalog_key"),
                resultSet.getString("title"),
                resultSet.getString("instruction"),
                resultSet.getInt("estimated_minutes"),
                resultSet.getInt("difficulty_level"),
                QuestStatus.valueOf(resultSet.getString("status")),
                reason == null ? null : FrictionReason.valueOf(reason),
                transitionedAt == null ? null : transitionedAt.toInstant());
    }
}
