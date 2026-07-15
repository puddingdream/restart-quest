package com.restartquest.application;

import com.restartquest.domain.OnboardingProfile;

public final class OnboardingService {
    private final RestartQuestStore store;

    public OnboardingService(RestartQuestStore store) {
        this.store = store;
    }

    public OnboardingProfile save(OnboardingProfile profile) {
        return store.saveProfile(profile);
    }

    public OnboardingProfile getCurrent() {
        return store.findProfile()
                .orElseThrow(() -> new IllegalStateException("Onboarding profile has not been created"));
    }
}
