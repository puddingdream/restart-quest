package com.restartquest.presentation.onboarding.dto;

import com.restartquest.application.user.OnboardingResult;

public record OnboardingResponse(
        OnboardingProfileResponse profile,
        boolean onboardingCompleted
) {

    public static OnboardingResponse from(OnboardingResult result) {
        return new OnboardingResponse(
                OnboardingProfileResponse.from(result.profile()),
                result.onboardingCompleted()
        );
    }
}
