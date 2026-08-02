package com.restartquest.domain.user;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
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

    protected AccessToken() {
    }

    private AccessToken(String tokenHash, UUID userId) {
        this.tokenHash = tokenHash;
        this.userId = userId;
        this.createdAt = OffsetDateTime.now(ZoneOffset.UTC);
    }

    public static AccessToken issue(String tokenHash, UUID userId) {
        return new AccessToken(tokenHash, userId);
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
}
