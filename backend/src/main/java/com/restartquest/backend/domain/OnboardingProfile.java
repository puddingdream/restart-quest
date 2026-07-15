package com.restartquest.backend.domain;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;

public record OnboardingProfile(
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
    public OnboardingProfile {
        TextRules.requireText(id, "id");
        TextRules.requireText(region, "region");
        TextRules.requireText(desiredRole, "desiredRole");
        TextRules.requireText(desiredWorkType, "desiredWorkType");
        Objects.requireNonNull(energyLevel, "energyLevel");
        Objects.requireNonNull(createdAt, "createdAt");
        Objects.requireNonNull(updatedAt, "updatedAt");
        interests = List.copyOf(Objects.requireNonNullElse(interests, List.of()));
        if (careerGapMonths < 0) {
            throw new IllegalArgumentException("careerGapMonths must not be negative");
        }
    }
}
