package com.restartquest.auth;

import java.time.Duration;
import java.time.Instant;

class RateLimitedException extends RuntimeException {

    private final long retryAfterSeconds;

    private RateLimitedException(long retryAfterSeconds) {
        super("요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.");
        this.retryAfterSeconds = retryAfterSeconds;
    }

    static RateLimitedException until(Instant now, Instant retryAt) {
        long remainingMillis = Duration.between(now, retryAt).toMillis();
        long seconds = Math.max(1, Math.ceilDiv(remainingMillis, 1_000));
        return new RateLimitedException(seconds);
    }

    long retryAfterSeconds() {
        return retryAfterSeconds;
    }
}
