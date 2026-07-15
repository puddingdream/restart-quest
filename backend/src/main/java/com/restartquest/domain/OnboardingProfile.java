package com.restartquest.domain;

import java.util.List;
import java.util.Objects;

public record OnboardingProfile(
        String id,
        String region,
        String desiredJob,
        String desiredWorkType,
        int careerGapMonths,
        boolean hasResume,
        boolean hasInterviewExperience,
        List<String> interests,
        EnergyLevel energyLevel
) {
    public OnboardingProfile {
        id = requireText(id, "id");
        region = requireText(region, "region");
        desiredJob = requireText(desiredJob, "desiredJob");
        desiredWorkType = requireText(desiredWorkType, "desiredWorkType");
        if (careerGapMonths < 0) {
            throw new IllegalArgumentException("careerGapMonths must be zero or greater");
        }
        interests = List.copyOf(Objects.requireNonNullElse(interests, List.of()));
        energyLevel = Objects.requireNonNull(energyLevel, "energyLevel");
    }

    private static String requireText(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(fieldName + " is required");
        }
        return value.trim();
    }
}
