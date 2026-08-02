package com.restartquest.presentation.auth.dto;

import com.restartquest.domain.user.User;
import java.util.UUID;

public record UserResponse(
        UUID id,
        String email,
        String name,
        boolean onboardingCompleted
) {

    public static UserResponse from(User user) {
        return new UserResponse(
                user.getId(),
                user.getEmail(),
                user.getName(),
                user.isOnboardingCompleted()
        );
    }
}
