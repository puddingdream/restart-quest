package com.restartquest.backend.presentation.dto;

import com.restartquest.backend.application.OnboardingCommand;
import com.restartquest.backend.domain.EnergyLevel;
import java.util.List;
import java.util.Objects;

public record OnboardingProfileRequest(
        String region,
        String desiredRole,
        String desiredWorkType,
        int careerGapMonths,
        boolean hasResume,
        boolean hasInterviewExperience,
        List<String> interests,
        String energyLevel
) {
    public OnboardingCommand toCommand() {
        return new OnboardingCommand(
                region,
                desiredRole,
                desiredWorkType,
                careerGapMonths,
                hasResume,
                hasInterviewExperience,
                List.copyOf(Objects.requireNonNullElse(interests, List.of())),
                EnergyLevel.parse(energyLevel)
        );
    }
}
