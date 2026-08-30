package com.restartquest.session;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class ParticipantSessionRepository {

    private final JdbcTemplate jdbcTemplate;

    public ParticipantSessionRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public Optional<ParticipantSession> findActiveByDigest(String digest, Instant now) {
        return jdbcTemplate.query(
                        """
                        SELECT id, token_digest, expires_at, last_seen_at, created_at
                        FROM participant_session
                        WHERE token_digest = ? AND expires_at > ?
                        """,
                        (resultSet, rowNumber) -> new ParticipantSession(
                                resultSet.getObject("id", UUID.class),
                                resultSet.getString("token_digest"),
                                resultSet.getTimestamp("expires_at").toInstant(),
                                resultSet.getTimestamp("last_seen_at").toInstant(),
                                resultSet.getTimestamp("created_at").toInstant()),
                        digest,
                        Timestamp.from(now))
                .stream()
                .findFirst();
    }

    public void insert(ParticipantSession session) {
        jdbcTemplate.update(
                """
                INSERT INTO participant_session
                    (id, token_digest, expires_at, last_seen_at, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                session.id(),
                session.tokenDigest(),
                Timestamp.from(session.expiresAt()),
                Timestamp.from(session.lastSeenAt()),
                Timestamp.from(session.createdAt()));
    }

    public void extendExpiry(UUID id, Instant lastSeenAt, Instant expiresAt) {
        jdbcTemplate.update(
                """
                UPDATE participant_session
                SET last_seen_at = ?, expires_at = ?
                WHERE id = ?
                """,
                Timestamp.from(lastSeenAt),
                Timestamp.from(expiresAt),
                id);
    }
}
