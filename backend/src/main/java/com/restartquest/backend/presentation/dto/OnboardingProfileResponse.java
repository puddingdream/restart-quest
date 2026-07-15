package com.restartquest.backend.presentation.dto;

import com.restartquest.backend.domain.EnergyLevel;
import com.restartquest.backend.domain.OnboardingProfile;
import java.time.LocalDateTime;
import java.util.List;

public record OnboardingProfileResponse(
        String id,
        String region,
        String desiredRole,
        String desiredWorkType,
        int careerGapMonths,
        boolean hasResume,
        boolean hasInterviewExperience,
        List<String> interests,
        EnergyLevel energyLevel,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public OnboardingProfileResponse {
        interests = List.copyOf(interests);
    }

    public static OnboardingProfileResponse from(OnboardingProfile profile) {
        return new OnboardingProfileResponse(
                profile.id(),
                profile.region(),
                profile.desiredRole(),
                profile.desiredWorkType(),
                profile.careerGapMonths(),
                profile.hasResume(),
                profile.hasInterviewExperience(),
                profile.interests(),
                profile.energyLevel(),
                profile.createdAt(),
                profile.updatedAt()
        );
    }
}
