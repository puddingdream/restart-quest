package com.restartquest.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
class AuthController {

    private final AuthService authService;
    private final AuthSessionService sessions;

    AuthController(AuthService authService, AuthSessionService sessions) {
        this.authService = authService;
        this.sessions = sessions;
    }

    @GetMapping("/csrf")
    CsrfResponse csrf(CsrfToken csrfToken) {
        return new CsrfResponse(csrfToken.getToken(), csrfToken.getHeaderName());
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    AuthResponse register(
            @Valid @RequestBody CredentialsRequest requestBody,
            HttpServletRequest request,
            HttpServletResponse response) {
        AuthenticatedAccount account = authService.register(
                requestBody.email(),
                requestBody.password(),
                request.getRemoteAddr());
        sessions.authenticate(account, request, response);
        return AuthResponse.from(account);
    }

    @PostMapping("/login")
    AuthResponse login(
            @Valid @RequestBody CredentialsRequest requestBody,
            HttpServletRequest request,
            HttpServletResponse response) {
        AuthenticatedAccount account = authService.login(
                requestBody.email(),
                requestBody.password(),
                request.getRemoteAddr());
        sessions.authenticate(account, request, response);
        return AuthResponse.from(account);
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void logout(HttpServletRequest request, HttpServletResponse response) {
        sessions.logout(request, response);
    }

    @GetMapping("/me")
    AuthResponse me(@AuthenticationPrincipal AuthenticatedAccount account) {
        return AuthResponse.from(account);
    }

    record CredentialsRequest(
            @NotBlank @Email @Size(max = 320) String email,
            @NotBlank @Size(min = 10, max = 72) String password) {

        CredentialsRequest {
            email = email == null ? null : email.trim();
        }
    }

    record CsrfResponse(String token, String headerName) {
    }

    record AuthResponse(UserResponse user) {

        static AuthResponse from(AuthenticatedAccount account) {
            return new AuthResponse(new UserResponse(account.id(), account.email()));
        }
    }

    record UserResponse(java.util.UUID id, String email) {
    }
}
