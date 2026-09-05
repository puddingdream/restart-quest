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
import java.time.Duration;
import java.time.OffsetDateTime;
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
    public static final Duration SESSION_TTL = Duration.ofDays(90);

    private final JdbcTemplate jdbc;
    private final SecureRandom secureRandom = new SecureRandom();

    public WorkspaceSessionService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<WorkspaceSession> resolve(String sessionToken) {
        if (sessionToken == null || sessionToken.isBlank()) return Optional.empty();
        List<WorkspaceSession> rows = jdbc.query(
                "select id, timezone, csrf_token, last_activity_at from workspaces where session_hash = ?",
                (rs, row) -> new WorkspaceSession(
                        rs.getObject("id", UUID.class), rs.getString("timezone"),
                        rs.getString("csrf_token"), sessionToken, false,
                        rs.getObject("last_activity_at", OffsetDateTime.class)),
                sha256(sessionToken));
        return rows.stream().findFirst();
    }

    @Transactional
    public WorkspaceSession createOrReuse(String timezone, String currentToken) {
        if (currentToken != null && !currentToken.isBlank()) {
            WorkspaceSession existing = resolve(currentToken).orElseThrow(WorkspaceSessionService::accessUnavailable);
            return touch(existing.id(), currentToken);
        }

        String normalizedTimezone = timezone == null ? "" : timezone.trim();
        if (!ZoneId.getAvailableZoneIds().contains(normalizedTimezone)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_TIMEZONE", "시간대를 확인해 주세요.",
                    "유효한 IANA 시간대가 필요합니다.");
        }

        UUID id = UUID.randomUUID();
        String sessionToken = randomToken();
        String csrfToken = randomToken();
        return jdbc.queryForObject(
                "insert into workspaces(id, timezone, session_hash, csrf_token) values (?, ?, ?, ?) " +
                        "returning id, timezone, csrf_token, last_activity_at",
                (rs, row) -> new WorkspaceSession(rs.getObject("id", UUID.class), rs.getString("timezone"),
                        rs.getString("csrf_token"), sessionToken, true,
                        rs.getObject("last_activity_at", OffsetDateTime.class)),
                id, normalizedTimezone, sha256(sessionToken), csrfToken);
    }

    @Transactional
    public WorkspaceSession touch(UUID workspaceId, String sessionToken) {
        List<WorkspaceSession> rows = jdbc.query(
                "update workspaces set last_activity_at = clock_timestamp() where id = ? " +
                        "returning id, timezone, csrf_token, last_activity_at",
                (rs, row) -> new WorkspaceSession(rs.getObject("id", UUID.class), rs.getString("timezone"),
                        rs.getString("csrf_token"), sessionToken, false,
                        rs.getObject("last_activity_at", OffsetDateTime.class)),
                workspaceId);
        if (rows.isEmpty()) throw accessUnavailable();
        return rows.getFirst();
    }

    public void touchLocked(UUID workspaceId) {
        int updated = jdbc.update("update workspaces set last_activity_at = clock_timestamp() where id = ?", workspaceId);
        if (updated == 0) throw accessUnavailable();
    }

    public void lock(UUID workspaceId) {
        Integer found = jdbc.query("select 1 from workspaces where id = ? for update",
                rs -> rs.next() ? 1 : null, workspaceId);
        if (found == null) throw accessUnavailable();
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

    public static ApiException accessUnavailable() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "WORKSPACE_ACCESS_UNAVAILABLE",
                "작업 공간에 접근할 수 없습니다.", "이 브라우저에서 이전 작업 공간에 접근할 수 없습니다.");
    }

    public record WorkspaceSession(
            UUID id, String timezone, String csrfToken, String sessionToken, boolean created,
            OffsetDateTime lastActivityAt) {
        public OffsetDateTime expiresAt() {
            return lastActivityAt.plus(SESSION_TTL);
        }
    }
}
