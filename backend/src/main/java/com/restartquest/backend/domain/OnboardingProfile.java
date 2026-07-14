package com.restartquest.backend.domain;

import java.util.List;
import java.util.Objects;

public record OnboardingProfile(
        String userId,
        String region,
        String desiredJob,
        String desiredWorkType,
        int careerGapMonths,
        boolean hasResume,
        String interviewExperienceLevel,
        List<String> interests,
        EnergyLevel defaultEnergyLevel
) {
    public OnboardingProfile {
        requireText(userId, "userId");
        requireText(region, "region");
        requireText(desiredJob, "desiredJob");
        requireText(desiredWorkType, "desiredWorkType");
        requireText(interviewExperienceLevel, "interviewExperienceLevel");
        Objects.requireNonNull(defaultEnergyLevel, "defaultEnergyLevel");
        if (careerGapMonths < 0) {
            throw new IllegalArgumentException("careerGapMonths must not be negative");
        }
        interests = List.copyOf(Objects.requireNonNull(interests, "interests"));
    }

    private static void requireText(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(fieldName + " is required");
        }
    }
}
