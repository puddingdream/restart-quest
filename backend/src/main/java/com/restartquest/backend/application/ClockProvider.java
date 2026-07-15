package com.restartquest.backend.application;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;

public final class ClockProvider {
    private final Clock clock;

    public ClockProvider(Clock clock) {
        this.clock = clock;
    }

    public LocalDate today() {
        return LocalDate.now(clock);
    }

    public LocalDateTime now() {
        return LocalDateTime.now(clock);
    }
}
