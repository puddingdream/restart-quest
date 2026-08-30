package com.restartquest.session;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.restartquest.config.SessionProperties;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class SessionServiceTest {

    private static final Instant NOW = Instant.parse("2026-08-31T00:00:00Z");

    @Mock
    private ParticipantSessionRepository repository;

    private SessionTokenCodec tokenCodec;
    private SessionService service;

    @BeforeEach
    void setUp() {
        SessionProperties properties = new SessionProperties();
        properties.setTtl(Duration.ofDays(30));
        tokenCodec = new SessionTokenCodec();
        service = new SessionService(
                repository, tokenCodec, properties, Clock.fixed(NOW, ZoneOffset.UTC));
    }

    @Test
    void persistsOnlyDigestAndThirtyDayExpiryForNewSession() {
        SessionService.SessionStart result = service.start(null);

        ArgumentCaptor<ParticipantSession> captor = ArgumentCaptor.forClass(ParticipantSession.class);
        verify(repository).insert(captor.capture());
        ParticipantSession stored = captor.getValue();

        assertThat(result.created()).isTrue();
        assertThat(result.expiresAt()).isEqualTo(NOW.plus(Duration.ofDays(30)));
        assertThat(stored.tokenDigest()).isEqualTo(tokenCodec.digest(result.rawToken()));
        assertThat(stored.tokenDigest()).doesNotContain(result.rawToken());
        assertThat(stored.lastSeenAt()).isEqualTo(NOW);
    }

    @Test
    void reusesOnlyTheSessionMatchingThePresentedTokenDigest() {
        String presentedToken = "browser-only-token";
        UUID existingId = UUID.randomUUID();
        String digest = tokenCodec.digest(presentedToken);
        ParticipantSession existing = new ParticipantSession(
                existingId, digest, NOW.plusSeconds(60), NOW.minusSeconds(10), NOW.minusSeconds(20));
        when(repository.findActiveByDigest(eq(digest), eq(NOW))).thenReturn(Optional.of(existing));

        SessionService.SessionStart result = service.start(presentedToken);

        assertThat(result.created()).isFalse();
        assertThat(result.sessionId()).isEqualTo(existingId);
        assertThat(result.rawToken()).isEqualTo(presentedToken);
        verify(repository).extendExpiry(existingId, NOW, NOW.plus(Duration.ofDays(30)));
        verify(repository, never()).insert(any());
    }
}
