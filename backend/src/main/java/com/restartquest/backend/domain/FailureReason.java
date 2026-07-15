package com.restartquest.backend.domain;

import java.util.Locale;

public enum FailureReason {
    NO_TIME("Reduce the action to a five minute step."),
    TOO_BIG("Split the work into one visible first move."),
    NOT_SURE_WHAT_TO_WRITE("Start with raw notes before writing polished text."),
    NO_MATERIAL("Create the missing material before asking for output."),
    LOW_CONFIDENCE("Choose a private draft step with no external submission."),
    LOW_ENERGY("Use the smallest action that keeps the routine alive."),
    NOT_INTERESTED("Switch to a nearby option that still supports the same goal.");

    private final String redesignStrategy;

    FailureReason(String redesignStrategy) {
        this.redesignStrategy = redesignStrategy;
    }

    public String redesignStrategy() {
        return redesignStrategy;
    }

    public static FailureReason parse(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("failureReason is required");
        }
        return FailureReason.valueOf(value.trim().toUpperCase(Locale.ROOT));
    }
}
