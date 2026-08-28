package com.restartquest.application.user;

import com.restartquest.domain.user.OnboardingProfile;

public record OnboardingResult(OnboardingProfile profile, boolean onboardingCompleted) {
}
