package com.restartquest.presentation.auth.dto;

import com.restartquest.application.user.AuthResult;

public record AuthResponse(String accessToken, UserResponse user) {

    public static AuthResponse from(AuthResult result) {
        return new AuthResponse(result.accessToken(), UserResponse.from(result.user()));
    }
}
