package com.restartquest.infrastructure.ai.provider;

import java.util.Objects;

public final class ProviderException extends RuntimeException {

    private final FailureType failureType;

    public ProviderException(FailureType failureType) {
        super("Structured quest provider request failed: " + Objects.requireNonNull(failureType).name());
        this.failureType = failureType;
    }

    public FailureType getFailureType() {
        return failureType;
    }

    public enum FailureType {
        TIMEOUT,
        QUOTA_EXCEEDED,
        INVALID_RESPONSE,
        UNAVAILABLE
    }
}
