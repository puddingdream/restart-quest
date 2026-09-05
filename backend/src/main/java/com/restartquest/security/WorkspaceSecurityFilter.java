package com.restartquest.security;

import com.restartquest.api.ApiException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerExceptionResolver;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Component
public class WorkspaceSecurityFilter extends OncePerRequestFilter {
    private final WorkspaceSessionService sessions;
    private final HandlerExceptionResolver exceptionResolver;
    private final Set<String> allowedOrigins;

    public WorkspaceSecurityFilter(
            WorkspaceSessionService sessions,
            @Qualifier("handlerExceptionResolver") HandlerExceptionResolver exceptionResolver,
            @Value("${app.security.allowed-origins:http://localhost:8080}") String allowedOrigins) {
        this.sessions = sessions;
        this.exceptionResolver = exceptionResolver;
        this.allowedOrigins = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim).filter(value -> !value.isEmpty())
                .map(WorkspaceSecurityFilter::withoutTrailingSlash)
                .collect(Collectors.toUnmodifiableSet());
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/v1/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        request.setAttribute("traceId", UUID.randomUUID().toString());
        try {
            if (isSessionCreation(request)) {
                requireAllowedOrigin(request);
                chain.doFilter(request, response);
                return;
            }

            WorkspaceSessionService.WorkspaceSession workspace = sessions.resolve(readCookie(request))
                    .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "SESSION_REQUIRED",
                            "익명 세션이 필요합니다.", "새 세션을 만든 뒤 다시 시도해 주세요."));
            request.setAttribute(WorkspaceSessionService.REQUEST_WORKSPACE, workspace);

            if (isStateChanging(request)) {
                requireAllowedOrigin(request);
                requireCsrf(request, workspace.csrfToken());
            }
            chain.doFilter(request, response);
        } catch (ApiException exception) {
            exceptionResolver.resolveException(request, response, null, exception);
        }
    }

    private boolean isSessionCreation(HttpServletRequest request) {
        return "POST".equals(request.getMethod()) && "/api/v1/session".equals(request.getRequestURI());
    }

    private boolean isStateChanging(HttpServletRequest request) {
        return !Set.of("GET", "HEAD", "OPTIONS").contains(request.getMethod());
    }

    private void requireAllowedOrigin(HttpServletRequest request) {
        String origin = request.getHeader("Origin");
        if (origin == null || !allowedOrigins.contains(withoutTrailingSlash(origin.trim()))) {
            throw new ApiException(HttpStatus.FORBIDDEN, "ORIGIN_NOT_ALLOWED", "요청 출처를 확인할 수 없습니다.",
                    "허용된 동일 출처에서 다시 시도해 주세요.");
        }
    }

    private void requireCsrf(HttpServletRequest request, String expected) {
        String actual = request.getHeader("X-CSRF-Token");
        if (actual == null || !MessageDigest.isEqual(
                actual.getBytes(StandardCharsets.UTF_8), expected.getBytes(StandardCharsets.UTF_8))) {
            throw new ApiException(HttpStatus.FORBIDDEN, "CSRF_INVALID", "요청을 확인할 수 없습니다.",
                    "화면을 새로고침한 뒤 다시 시도해 주세요.");
        }
    }

    private String readCookie(HttpServletRequest request) {
        if (request.getCookies() == null) return null;
        return Arrays.stream(request.getCookies())
                .filter(cookie -> WorkspaceSessionService.COOKIE_NAME.equals(cookie.getName()))
                .map(Cookie::getValue).findFirst().orElse(null);
    }

    private static String withoutTrailingSlash(String value) {
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }
}
