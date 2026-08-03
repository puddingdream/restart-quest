package com.restartquest.infrastructure.security;

import com.restartquest.application.port.AccessTokenManager;
import com.restartquest.application.port.AccessTokenStore;
import com.restartquest.domain.user.AccessToken;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class OpaqueAccessTokenManager implements AccessTokenManager {

    private static final int TOKEN_BYTES = 32;

    private final AccessTokenStore accessTokenStore;
    private final Clock clock;
    private final Duration tokenTtl;
    private final SecureRandom secureRandom = new SecureRandom();

    public OpaqueAccessTokenManager(
            AccessTokenStore accessTokenStore,
            Clock clock,
            @Value("${restartquest.auth.token-ttl:PT24H}") Duration tokenTtl
    ) {
        this.accessTokenStore = accessTokenStore;
        this.clock = clock;
        this.tokenTtl = tokenTtl;
    }

    @Override
    public String issue(UUID userId) {
        byte[] bytes = new byte[TOKEN_BYTES];
        secureRandom.nextBytes(bytes);
        String rawToken = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        OffsetDateTime issuedAt = OffsetDateTime.now(clock);
        accessTokenStore.save(AccessToken.issue(
                hash(rawToken),
                userId,
                issuedAt,
                issuedAt.plus(tokenTtl)
        ));
        return rawToken;
    }

    @Override
    public Optional<UUID> findUserId(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            return Optional.empty();
        }
        OffsetDateTime now = OffsetDateTime.now(clock);
        return accessTokenStore.findByTokenHash(hash(rawToken))
                .filter(token -> token.isActiveAt(now))
                .map(AccessToken::getUserId);
    }

    @Override
    public void revoke(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            return;
        }
        accessTokenStore.findByTokenHash(hash(rawToken)).ifPresent(token -> {
            token.revoke(OffsetDateTime.now(clock));
            accessTokenStore.save(token);
        });
    }

    private static String hash(String rawToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest(rawToken.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hashed);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }
}
