package com.restartquest.presentation.auth;

import com.restartquest.application.user.AuthResult;
import com.restartquest.application.user.AuthService;
import com.restartquest.presentation.auth.dto.AuthResponse;
import com.restartquest.presentation.auth.dto.LoginRequest;
import com.restartquest.presentation.auth.dto.SignupRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/signup")
    public ResponseEntity<AuthResponse> signup(@Valid @RequestBody SignupRequest request) {
        AuthResult result = authService.signup(request.email(), request.password(), request.name());
        return ResponseEntity.status(HttpStatus.CREATED).body(AuthResponse.from(result));
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        return AuthResponse.from(authService.login(request.email(), request.password()));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization
    ) {
        authService.logout(bearerToken(authorization));
        return ResponseEntity.noContent().build();
    }

    private static String bearerToken(String authorization) {
        String prefix = "Bearer ";
        if (authorization == null || !authorization.startsWith(prefix)) {
            return "";
        }
        return authorization.substring(prefix.length());
    }
}
