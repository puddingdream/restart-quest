package com.restartquest.session;

import com.restartquest.config.SessionProperties;
import java.time.Clock;
import java.time.Instant;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class SessionService {

    private final ParticipantSessionRepository repository;
    private final SessionTokenCodec tokenCodec;
    private final SessionProperties properties;
    private final Clock clock;

    public SessionService(
            ParticipantSessionRepository repository,
            SessionTokenCodec tokenCodec,
            SessionProperties properties,
            Clock clock) {
        this.repository = repository;
        this.tokenCodec = tokenCodec;
        this.properties = properties;
        this.clock = clock;
    }

    @Transactional
    public SessionStart start(String presentedToken) {
        Instant now = clock.instant();
        Instant expiresAt = now.plus(properties.getTtl());

        if (StringUtils.hasText(presentedToken)) {
            String digest = tokenCodec.digest(presentedToken);
            var existing = repository.findActiveByDigest(digest, now);
            if (existing.isPresent()) {
                ParticipantSession session = existing.get();
                repository.extendExpiry(session.id(), now, expiresAt);
                return new SessionStart(session.id(), presentedToken, expiresAt, false);
            }
        }

        String rawToken = tokenCodec.generate();
        ParticipantSession session = new ParticipantSession(
                UUID.randomUUID(), tokenCodec.digest(rawToken), expiresAt, now, now);
        repository.insert(session);
        return new SessionStart(session.id(), rawToken, expiresAt, true);
    }

    public record SessionStart(UUID sessionId, String rawToken, Instant expiresAt, boolean created) {
    }
}
