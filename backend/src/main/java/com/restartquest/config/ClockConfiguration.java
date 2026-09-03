package com.restartquest.config;

import java.time.Clock;
import java.time.ZoneId;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
public class ClockConfiguration {

    public static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Seoul");

    @Bean
    Clock clock() {
        return Clock.systemUTC();
    }

    @Bean("businessZoneId")
    ZoneId businessZoneId() {
        return BUSINESS_ZONE;
    }
}
