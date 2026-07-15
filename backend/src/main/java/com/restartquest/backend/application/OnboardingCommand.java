package com.restartquest.backend.application;

import com.restartquest.backend.domain.EnergyLevel;
import java.util.List;
import java.util.Objects;

public record OnboardingCommand(
        String region,
        String desiredRole,
        String desiredWorkType,
        int careerGapMonths,
        boolean hasResume,
        boolean hasInterviewExperience,
        List<String> interests,
        EnergyLevel energyLevel
) {
    public OnboardingCommand {
        interests = List.copyOf(Objects.requireNonNullElse(interests, List.of()));
    }
}
