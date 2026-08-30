package com.restartquest.session;

import java.time.Instant;
import java.util.UUID;

public record ParticipantSession(
        UUID id,
        String tokenDigest,
        Instant expiresAt,
        Instant lastSeenAt,
        Instant createdAt) {
}
