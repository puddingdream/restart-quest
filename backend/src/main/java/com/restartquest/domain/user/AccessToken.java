package com.restartquest.domain.user;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(
        name = "access_tokens",
        indexes = @Index(name = "idx_access_token_hash", columnList = "token_hash", unique = true)
)
public class AccessToken {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "token_hash", nullable = false, unique = true, length = 64)
    private String tokenHash;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false)
    private OffsetDateTime createdAt;

    @Column(nullable = false)
    private OffsetDateTime expiresAt;

    private OffsetDateTime revokedAt;

    protected AccessToken() {
    }

    private AccessToken(
            String tokenHash,
            UUID userId,
            OffsetDateTime createdAt,
            OffsetDateTime expiresAt
    ) {
        this.tokenHash = tokenHash;
        this.userId = userId;
        this.createdAt = createdAt;
        this.expiresAt = expiresAt;
    }

    public static AccessToken issue(
            String tokenHash,
            UUID userId,
            OffsetDateTime createdAt,
            OffsetDateTime expiresAt
    ) {
        if (!expiresAt.isAfter(createdAt)) {
            throw new IllegalArgumentException("토큰 만료 시각은 발급 시각보다 이후여야 합니다.");
        }
        return new AccessToken(tokenHash, userId, createdAt, expiresAt);
    }

    public boolean isActiveAt(OffsetDateTime now) {
        return revokedAt == null && now.isBefore(expiresAt);
    }

    public void revoke(OffsetDateTime now) {
        if (revokedAt == null) {
            revokedAt = now;
        }
    }

    public UUID getId() {
        return id;
    }

    public String getTokenHash() {
        return tokenHash;
    }

    public UUID getUserId() {
        return userId;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public OffsetDateTime getExpiresAt() {
        return expiresAt;
    }

    public OffsetDateTime getRevokedAt() {
        return revokedAt;
    }
}
