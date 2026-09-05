package com.restartquest.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.restartquest.api.ApiModels.ActionInput;
import com.restartquest.api.ApiModels.AdaptationRequest;
import com.restartquest.api.ApiModels.AttemptRequest;
import com.restartquest.api.ApiModels.CreateQuestRequest;
import com.restartquest.api.ApiModels.SessionRequest;
import com.restartquest.api.ApiModels.VersionRequest;
import com.restartquest.domain.QuestService;
import com.restartquest.infra.IdempotencyService;
import com.restartquest.infra.IdempotencyService.ApiResult;
import com.restartquest.infra.IdempotencyService.StoredResponse;
import com.restartquest.security.WorkspaceSessionService;
import com.restartquest.security.WorkspaceSessionService.WorkspaceSession;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
public class QuestController {
    private final WorkspaceSessionService sessions;
    private final QuestService quests;
    private final IdempotencyService idempotency;
    private final boolean secureCookie;

    public QuestController(WorkspaceSessionService sessions, QuestService quests, IdempotencyService idempotency,
            @Value("${app.security.cookie-secure:false}") boolean secureCookie) {
        this.sessions = sessions;
        this.quests = quests;
        this.idempotency = idempotency;
        this.secureCookie = secureCookie;
    }

    @PostMapping("/session")
    ResponseEntity<Map<String, Object>> session(
            @Valid @RequestBody SessionRequest request,
            @CookieValue(name = WorkspaceSessionService.COOKIE_NAME, required = false) String currentToken) {
        WorkspaceSession workspace = sessions.createOrReuse(request.timezone(), currentToken);
        ResponseCookie cookie = sessionCookie(workspace.sessionToken(), WorkspaceSessionService.SESSION_TTL);
        return ResponseEntity.status(workspace.created() ? HttpStatus.CREATED : HttpStatus.OK)
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .body(Map.of("csrfToken", workspace.csrfToken(),
                        "workspaceExpiresAt", workspace.expiresAt().toInstant().toString()));
    }

    @GetMapping("/bootstrap")
    Map<String, Object> bootstrap(HttpServletRequest request) {
        return quests.bootstrap(workspace(request));
    }

    @GetMapping("/history")
    Map<String, Object> history(
            HttpServletRequest request,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") int size) {
        return quests.history(workspace(request).id(), cursor, size);
    }

    @PostMapping("/quests")
    ResponseEntity<JsonNode> createQuest(
            HttpServletRequest servletRequest,
            @RequestHeader(name = "Idempotency-Key", required = false) String key,
            @Valid @RequestBody CreateQuestRequest request) {
        UUID workspaceId = workspace(servletRequest).id();
        return write(idempotency.execute(workspaceId, "/api/v1/quests", key, request,
                () -> new ApiResult(201, quests.createQuest(workspaceId, request))));
    }

    @PostMapping("/quests/{questId}/actions")
    ResponseEntity<JsonNode> createAction(
            HttpServletRequest servletRequest,
            @PathVariable UUID questId,
            @RequestHeader(name = "Idempotency-Key", required = false) String key,
            @Valid @RequestBody ActionInput request) {
        UUID workspaceId = workspace(servletRequest).id();
        String route = "/api/v1/quests/" + questId + "/actions";
        return write(idempotency.execute(workspaceId, route, key, request,
                () -> new ApiResult(201, quests.createAction(workspaceId, questId, request))));
    }

    @PostMapping("/actions/{actionId}/attempts")
    ResponseEntity<JsonNode> attempt(
            HttpServletRequest servletRequest,
            @PathVariable UUID actionId,
            @RequestHeader(name = "Idempotency-Key", required = false) String key,
            @Valid @RequestBody AttemptRequest request) {
        UUID workspaceId = workspace(servletRequest).id();
        String route = "/api/v1/actions/" + actionId + "/attempts";
        return write(idempotency.execute(workspaceId, route, key, request,
                () -> new ApiResult(201, quests.recordAttempt(workspaceId, actionId, request))));
    }

    @PostMapping("/attempts/{attemptId}/adaptation")
    ResponseEntity<JsonNode> adapt(
            HttpServletRequest servletRequest,
            @PathVariable UUID attemptId,
            @RequestHeader(name = "Idempotency-Key", required = false) String key,
            @Valid @RequestBody AdaptationRequest request) {
        UUID workspaceId = workspace(servletRequest).id();
        String route = "/api/v1/attempts/" + attemptId + "/adaptation";
        return write(idempotency.execute(workspaceId, route, key, request,
                () -> new ApiResult(201, quests.adapt(workspaceId, attemptId, request))));
    }

    @PostMapping("/quests/{questId}/complete")
    ResponseEntity<JsonNode> complete(
            HttpServletRequest servletRequest,
            @PathVariable UUID questId,
            @RequestHeader(name = "Idempotency-Key", required = false) String key,
            @Valid @RequestBody VersionRequest request) {
        UUID workspaceId = workspace(servletRequest).id();
        String route = "/api/v1/quests/" + questId + "/complete";
        return write(idempotency.execute(workspaceId, route, key, request,
                () -> new ApiResult(200, quests.completeQuest(workspaceId, questId, request.version()))));
    }

    @PostMapping("/quests/{questId}/archive")
    ResponseEntity<JsonNode> archive(
            HttpServletRequest servletRequest,
            @PathVariable UUID questId,
            @RequestHeader(name = "Idempotency-Key", required = false) String key,
            @Valid @RequestBody VersionRequest request) {
        UUID workspaceId = workspace(servletRequest).id();
        String route = "/api/v1/quests/" + questId + "/archive";
        return write(idempotency.execute(workspaceId, route, key, request,
                () -> new ApiResult(200, quests.archiveQuest(workspaceId, questId, request.version()))));
    }

    @DeleteMapping("/workspace")
    ResponseEntity<Void> deleteWorkspace(
            HttpServletRequest request,
            @RequestHeader(name = "X-Confirm-Delete", required = false) String confirmation) {
        if (!"delete-my-data".equals(confirmation)) {
            throw ApiException.badRequest("DELETE_CONFIRMATION_REQUIRED");
        }
        quests.deleteWorkspace(workspace(request).id());
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, sessionCookie("", Duration.ZERO).toString())
                .build();
    }

    private WorkspaceSession workspace(HttpServletRequest request) {
        return (WorkspaceSession) request.getAttribute(WorkspaceSessionService.REQUEST_WORKSPACE);
    }

    private ResponseEntity<JsonNode> write(StoredResponse response) {
        return ResponseEntity.status(response.status())
                .header("Idempotency-Replayed", Boolean.toString(response.replayed()))
                .body(response.body());
    }

    private ResponseCookie sessionCookie(String token, Duration maxAge) {
        return ResponseCookie.from(WorkspaceSessionService.COOKIE_NAME, token)
                .httpOnly(true)
                .secure(secureCookie)
                .sameSite("Lax")
                .path("/api/v1")
                .maxAge(maxAge)
                .build();
    }
}
