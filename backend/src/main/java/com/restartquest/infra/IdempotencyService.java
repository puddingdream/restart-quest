package com.restartquest.infra;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.restartquest.api.ApiException;
import com.restartquest.security.WorkspaceSessionService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import java.util.function.Supplier;

@Service
public class IdempotencyService {
    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;
    private final WorkspaceSessionService sessions;

    public IdempotencyService(JdbcTemplate jdbc, ObjectMapper objectMapper, WorkspaceSessionService sessions) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
        this.sessions = sessions;
    }

    @Transactional
    public StoredResponse execute(UUID workspaceId, String route, String keyValue, Object request,
            Supplier<ApiResult> operation) {
        UUID key = parseKey(keyValue);
        String digest = digest(request);
        sessions.lock(workspaceId);
        sessions.touchLocked(workspaceId);
        jdbc.update("delete from idempotency_records where workspace_id = ? and route = ? " +
                "and idempotency_key = ? and expires_at <= now()", workspaceId, route, key);

        List<StoredRecord> existing = jdbc.query(
                "select request_digest, response_status, response_body::text as response_body " +
                        "from idempotency_records where workspace_id = ? and route = ? and idempotency_key = ?",
                (rs, row) -> new StoredRecord(rs.getString("request_digest"), rs.getInt("response_status"),
                        rs.getString("response_body")), workspaceId, route, key);
        if (!existing.isEmpty()) {
            StoredRecord record = existing.getFirst();
            if (!record.requestDigest.equals(digest)) throw ApiException.conflict("IDEMPOTENCY_KEY_REUSED");
            return new StoredResponse(record.status, read(record.body), true);
        }

        ApiResult result = operation.get();
        JsonNode body = objectMapper.valueToTree(result.body());
        jdbc.update("insert into idempotency_records(workspace_id, route, idempotency_key, request_digest, " +
                        "response_status, response_body) values (?, ?, ?, ?, ?, cast(? as jsonb))",
                workspaceId, route, key, digest, result.status(), body.toString());
        return new StoredResponse(result.status(), body, false);
    }

    private UUID parseKey(String value) {
        if (value == null || value.isBlank()) throw ApiException.badRequest("IDEMPOTENCY_KEY_REQUIRED");
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException exception) {
            throw ApiException.badRequest("INVALID_IDEMPOTENCY_KEY");
        }
    }

    private String digest(Object request) {
        try {
            byte[] canonical = objectMapper.writeValueAsBytes(request);
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(canonical));
        } catch (JsonProcessingException | NoSuchAlgorithmException exception) {
            throw new IllegalStateException("Cannot create request digest", exception);
        }
    }

    private JsonNode read(String body) {
        try {
            return objectMapper.readTree(body);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Cannot read stored response", exception);
        }
    }

    public record ApiResult(int status, Object body) {}
    public record StoredResponse(int status, JsonNode body, boolean replayed) {}
    private record StoredRecord(String requestDigest, int status, String body) {}
}
