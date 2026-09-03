package com.restartquest.config;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;

@Component
public class PlatformTime {

    private final Clock clock;
    private final ZoneId businessZone;

    public PlatformTime(Clock clock, @Qualifier("businessZoneId") ZoneId businessZone) {
        this.clock = clock;
        this.businessZone = businessZone;
    }

    public Instant now() {
        return clock.instant();
    }

    public LocalDate businessDate() {
        return LocalDate.now(clock.withZone(businessZone));
    }
}
