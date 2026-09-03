package com.restartquest.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

class PlatformTimeTest {

    @Test
    void derivesSeoulBusinessDateWhileKeepingTimestampInUtc() {
        Instant fixedInstant = Instant.parse("2026-09-02T15:05:00Z");
        Clock fixedClock = Clock.fixed(fixedInstant, ZoneOffset.UTC);
        PlatformTime platformTime = new PlatformTime(fixedClock, ClockConfiguration.BUSINESS_ZONE);

        assertThat(platformTime.now()).isEqualTo(fixedInstant);
        assertThat(platformTime.businessDate()).isEqualTo(LocalDate.of(2026, 9, 3));
    }
}
