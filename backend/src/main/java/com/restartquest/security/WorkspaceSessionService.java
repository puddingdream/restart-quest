package com.restartquest.security;

import com.restartquest.api.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.ZoneId;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class WorkspaceSessionService {
    public static final String REQUEST_WORKSPACE = "workspaceSession";
    public static final String COOKIE_NAME = "rq_session";

    private final JdbcTemplate jdbc;
    private final SecureRandom secureRandom = new SecureRandom();

    public WorkspaceSessionService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<WorkspaceSession> resolve(String sessionToken) {
        if (sessionToken == null || sessionToken.isBlank()) return Optional.empty();
        List<WorkspaceSession> rows = jdbc.query(
                "select id, timezone, csrf_token from workspaces where session_hash = ?",
                (rs, row) -> new WorkspaceSession(
                        rs.getObject("id", UUID.class), rs.getString("timezone"),
                        rs.getString("csrf_token"), sessionToken, false),
                sha256(sessionToken));
        return rows.stream().findFirst();
    }

    @Transactional
    public WorkspaceSession createOrReuse(String timezone, String currentToken) {
        Optional<WorkspaceSession> existing = resolve(currentToken);
        if (existing.isPresent()) return existing.get();

        String normalizedTimezone = timezone == null ? "" : timezone.trim();
        if (!ZoneId.getAvailableZoneIds().contains(normalizedTimezone)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_TIMEZONE", "시간대를 확인해 주세요.",
                    "유효한 IANA 시간대가 필요합니다.");
        }

        UUID id = UUID.randomUUID();
        String sessionToken = randomToken();
        String csrfToken = randomToken();
        jdbc.update("insert into workspaces(id, timezone, session_hash, csrf_token) values (?, ?, ?, ?)",
                id, normalizedTimezone, sha256(sessionToken), csrfToken);
        return new WorkspaceSession(id, normalizedTimezone, csrfToken, sessionToken, true);
    }

    public void lock(UUID workspaceId) {
        Integer found = jdbc.query("select 1 from workspaces where id = ? for update",
                rs -> rs.next() ? 1 : null, workspaceId);
        if (found == null) throw ApiException.notFound();
    }

    static String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 unavailable", exception);
        }
    }

    private String randomToken() {
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    public record WorkspaceSession(
            UUID id, String timezone, String csrfToken, String sessionToken, boolean created) {}
}
