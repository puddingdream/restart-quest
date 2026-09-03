package com.restartquest.auth;

import com.restartquest.common.error.ApiException;
import com.restartquest.config.PlatformTime;
import java.util.Locale;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class AuthService {

    private static final String INVALID_CREDENTIALS_MESSAGE = "이메일 또는 비밀번호를 확인해 주세요.";

    private final AccountRepository accounts;
    private final AuthRateLimiter rateLimiter;
    private final PasswordEncoder passwordEncoder;
    private final RegistrationEmailLock registrationEmailLock;
    private final PlatformTime time;
    private final String dummyPasswordHash;

    AuthService(
            AccountRepository accounts,
            AuthRateLimiter rateLimiter,
            PasswordEncoder passwordEncoder,
            RegistrationEmailLock registrationEmailLock,
            PlatformTime time) {
        this.accounts = accounts;
        this.rateLimiter = rateLimiter;
        this.passwordEncoder = passwordEncoder;
        this.registrationEmailLock = registrationEmailLock;
        this.time = time;
        this.dummyPasswordHash = passwordEncoder.encode(UUID.randomUUID().toString());
    }

    @Transactional
    AuthenticatedAccount register(String email, String password, String clientAddress) {
        String normalizedEmail = normalizeEmail(email);
        rateLimiter.consumeRegistration(clientAddress);
        registrationEmailLock.acquire(normalizedEmail);
        if (accounts.existsByEmail(normalizedEmail)) {
            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "EMAIL_ALREADY_USED",
                    "이미 사용 중인 이메일입니다.");
        }

        Account account = new Account(
                UUID.randomUUID(),
                normalizedEmail,
                passwordEncoder.encode(password),
                time.now());
        accounts.save(account);
        return AuthenticatedAccount.from(account);
    }

    @Transactional(readOnly = true)
    AuthenticatedAccount login(String email, String password, String clientAddress) {
        String normalizedEmail = normalizeEmail(email);
        rateLimiter.assertLoginAllowed(normalizedEmail, clientAddress);

        Account account = accounts.findByEmail(normalizedEmail).orElse(null);
        String storedHash = account == null ? dummyPasswordHash : account.getPasswordHash();
        if (!passwordEncoder.matches(password, storedHash)) {
            rateLimiter.recordLoginFailure(normalizedEmail, clientAddress);
            throw new ApiException(
                    HttpStatus.UNAUTHORIZED,
                    "INVALID_CREDENTIALS",
                    INVALID_CREDENTIALS_MESSAGE);
        }

        rateLimiter.clearLoginFailures(normalizedEmail, clientAddress);
        return AuthenticatedAccount.from(account);
    }

    private String normalizeEmail(String email) {
        return email.toLowerCase(Locale.ROOT);
    }
}
