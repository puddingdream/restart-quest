package com.restartquest.application.port;

import com.restartquest.domain.user.OnboardingProfile;
import java.util.Optional;
import java.util.UUID;

public interface OnboardingProfileStore {

    Optional<OnboardingProfile> findByUserId(UUID userId);

    OnboardingProfile save(OnboardingProfile profile);
}
