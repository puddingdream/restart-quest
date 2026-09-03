package com.restartquest.auth;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class RegistrationEmailLock {

    private final JdbcTemplate jdbcTemplate;

    RegistrationEmailLock(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public void acquire(String normalizedEmail) {
        jdbcTemplate.queryForObject(
                "select pg_advisory_xact_lock(hashtextextended(?, 0))",
                Object.class,
                normalizedEmail);
    }
}
