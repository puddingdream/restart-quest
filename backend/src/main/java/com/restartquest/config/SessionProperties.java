package com.restartquest.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.session")
public class SessionProperties {

    private Duration ttl = Duration.ofDays(30);
    private boolean cookieSecure;

    public Duration getTtl() {
        return ttl;
    }

    public void setTtl(Duration ttl) {
        if (ttl == null || ttl.isZero() || ttl.isNegative()) {
            throw new IllegalArgumentException("app.session.ttl must be positive");
        }
        this.ttl = ttl;
    }

    public boolean isCookieSecure() {
        return cookieSecure;
    }

    public void setCookieSecure(boolean cookieSecure) {
        this.cookieSecure = cookieSecure;
    }
}
