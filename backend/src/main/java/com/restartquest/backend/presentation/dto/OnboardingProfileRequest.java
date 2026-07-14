package com.restartquest.backend.presentation.dto;

import com.restartquest.backend.domain.EnergyLevel;
import com.restartquest.backend.domain.OnboardingProfile;
import java.util.List;

public record OnboardingProfileRequest(
        String region,
        String desiredJob,
        String desiredWorkType,
        int careerGapMonths,
        boolean hasResume,
        String interviewExperienceLevel,
        List<String> interests,
        String defaultEnergyLevel
) {
    public OnboardingProfile toProfile(String userId) {
        return new OnboardingProfile(
                userId,
                region,
                desiredJob,
                desiredWorkType,
                careerGapMonths,
                hasResume,
                interviewExperienceLevel,
                interests,
                EnergyLevel.valueOf(defaultEnergyLevel)
        );
    }
}
