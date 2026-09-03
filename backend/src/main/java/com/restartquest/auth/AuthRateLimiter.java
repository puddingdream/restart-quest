package com.restartquest.auth;

import com.restartquest.config.PlatformTime;
import java.time.Duration;
import java.time.Instant;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
class AuthRateLimiter {

    private static final int LOGIN_FAILURE_LIMIT = 5;
    private static final Duration LOGIN_LOCK_DURATION = Duration.ofMinutes(15);
    private static final int REGISTRATION_LIMIT = 5;
    private static final Duration REGISTRATION_WINDOW = Duration.ofHours(1);
    private static final int MAX_TRACKED_KEYS = 10_000;

    private final PlatformTime time;
    private final LinkedHashMap<String, LoginFailures> loginFailures = new LinkedHashMap<>();
    private final LinkedHashMap<String, RegistrationWindow> registrations = new LinkedHashMap<>();

    AuthRateLimiter(PlatformTime time) {
        this.time = time;
    }

    synchronized void assertLoginAllowed(String normalizedEmail, String clientAddress) {
        Instant now = time.now();
        String key = loginKey(normalizedEmail, clientAddress);
        LoginFailures failures = loginFailures.get(key);
        if (failures == null) {
            return;
        }
        if (failures.lockedUntil() != null && now.isBefore(failures.lockedUntil())) {
            throw RateLimitedException.until(now, failures.lockedUntil());
        }
        if (failures.lockedUntil() != null) {
            loginFailures.remove(key);
        }
    }

    synchronized void recordLoginFailure(String normalizedEmail, String clientAddress) {
        Instant now = time.now();
        String key = loginKey(normalizedEmail, clientAddress);
        LoginFailures current = loginFailures.get(key);
        int count = current == null || current.lockedUntil() != null ? 1 : current.count() + 1;
        Instant lockedUntil = count >= LOGIN_FAILURE_LIMIT ? now.plus(LOGIN_LOCK_DURATION) : null;
        putBounded(loginFailures, key, new LoginFailures(count, lockedUntil), now);
    }

    synchronized void clearLoginFailures(String normalizedEmail, String clientAddress) {
        loginFailures.remove(loginKey(normalizedEmail, clientAddress));
    }

    synchronized void consumeRegistration(String clientAddress) {
        Instant now = time.now();
        String key = addressKey(clientAddress);
        RegistrationWindow current = registrations.get(key);
        if (current == null || !now.isBefore(current.startedAt().plus(REGISTRATION_WINDOW))) {
            putBounded(registrations, key, new RegistrationWindow(now, 1), now);
            return;
        }
        if (current.count() >= REGISTRATION_LIMIT) {
            throw RateLimitedException.until(now, current.startedAt().plus(REGISTRATION_WINDOW));
        }
        registrations.put(key, new RegistrationWindow(current.startedAt(), current.count() + 1));
    }

    private String loginKey(String normalizedEmail, String clientAddress) {
        return addressKey(clientAddress) + '\u0000' + normalizedEmail;
    }

    private String addressKey(String clientAddress) {
        return clientAddress == null || clientAddress.isBlank() ? "unknown" : clientAddress;
    }

    private <T> void putBounded(
            LinkedHashMap<String, T> entries,
            String key,
            T value,
            Instant now) {
        if (!entries.containsKey(key) && entries.size() >= MAX_TRACKED_KEYS) {
            removeExpired(entries, now);
            if (entries.size() >= MAX_TRACKED_KEYS) {
                Iterator<String> iterator = entries.keySet().iterator();
                iterator.next();
                iterator.remove();
            }
        }
        entries.put(key, value);
    }

    private <T> void removeExpired(Map<String, T> entries, Instant now) {
        entries.entrySet().removeIf(entry -> switch (entry.getValue()) {
            case LoginFailures failures -> failures.lockedUntil() != null
                    && !now.isBefore(failures.lockedUntil());
            case RegistrationWindow window -> !now.isBefore(window.startedAt().plus(REGISTRATION_WINDOW));
            default -> false;
        });
    }

    private record LoginFailures(int count, Instant lockedUntil) {
    }

    private record RegistrationWindow(Instant startedAt, int count) {
    }
}
