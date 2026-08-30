package com.restartquest.session;

import com.restartquest.config.SessionProperties;
import java.time.Instant;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/session")
public class SessionController {

    static final String COOKIE_NAME = "rq_session";

    private final SessionService sessionService;
    private final SessionProperties properties;

    public SessionController(SessionService sessionService, SessionProperties properties) {
        this.sessionService = sessionService;
        this.properties = properties;
    }

    @PostMapping
    public ResponseEntity<SessionResponse> start(
            @CookieValue(name = COOKIE_NAME, required = false) String presentedToken) {
        SessionService.SessionStart session = sessionService.start(presentedToken);
        ResponseCookie cookie = ResponseCookie.from(COOKIE_NAME, session.rawToken())
                .httpOnly(true)
                .secure(properties.isCookieSecure())
                .sameSite("Lax")
                .path("/")
                .maxAge(properties.getTtl())
                .build();

        SessionResponse body = new SessionResponse(session.expiresAt());
        return ResponseEntity.status(session.created() ? 201 : 200)
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .body(body);
    }

    public record SessionResponse(Instant expiresAt) {
    }
}
