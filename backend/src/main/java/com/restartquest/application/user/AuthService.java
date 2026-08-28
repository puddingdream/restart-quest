package com.restartquest.application.user;

import com.restartquest.application.error.AppException;
import com.restartquest.application.port.AccessTokenManager;
import com.restartquest.application.port.PasswordHasher;
import com.restartquest.application.port.UserStore;
import com.restartquest.domain.user.User;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final UserStore userStore;
    private final PasswordHasher passwordHasher;
    private final AccessTokenManager accessTokenManager;

    public AuthService(
            UserStore userStore,
            PasswordHasher passwordHasher,
            AccessTokenManager accessTokenManager
    ) {
        this.userStore = userStore;
        this.passwordHasher = passwordHasher;
        this.accessTokenManager = accessTokenManager;
    }

    @Transactional
    public AuthResult signup(String email, String password, String name) {
        validatePasswordBytes(password);
        String normalizedEmail = normalizeEmail(email);
        if (userStore.existsByEmail(normalizedEmail)) {
            throw new AppException(HttpStatus.CONFLICT, "EMAIL_ALREADY_EXISTS", "이미 가입된 이메일입니다.");
        }

        User user = User.create(normalizedEmail, passwordHasher.hash(password), name.trim());
        User savedUser;
        try {
            savedUser = userStore.save(user);
        } catch (DataIntegrityViolationException exception) {
            throw new AppException(HttpStatus.CONFLICT, "EMAIL_ALREADY_EXISTS", "이미 가입된 이메일입니다.");
        }
        return new AuthResult(accessTokenManager.issue(savedUser.getId()), savedUser);
    }

    @Transactional
    public AuthResult login(String email, String password) {
        validatePasswordBytes(password);
        User user = userStore.findByEmail(normalizeEmail(email))
                .orElseThrow(AuthService::invalidCredentials);
        if (!passwordHasher.matches(password, user.getPasswordHash())) {
            throw invalidCredentials();
        }
        return new AuthResult(accessTokenManager.issue(user.getId()), user);
    }

    public void logout(String rawToken) {
        accessTokenManager.revoke(rawToken);
    }

    private static void validatePasswordBytes(String password) {
        if (password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new AppException(
                    HttpStatus.BAD_REQUEST,
                    "INVALID_INPUT",
                    "비밀번호는 UTF-8 기준 72바이트 이하여야 합니다."
            );
        }
    }

    private static String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private static AppException invalidCredentials() {
        return new AppException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "이메일 또는 비밀번호가 올바르지 않습니다.");
    }
}
