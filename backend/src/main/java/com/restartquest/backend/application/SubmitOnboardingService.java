package com.restartquest.backend.application;

import com.restartquest.backend.domain.OnboardingProfile;
import java.time.LocalDateTime;
import java.util.Objects;

public final class SubmitOnboardingService {
    private final RestartQuestStore store;
    private final IdGenerator idGenerator;
    private final ClockProvider clockProvider;

    public SubmitOnboardingService(RestartQuestStore store, IdGenerator idGenerator, ClockProvider clockProvider) {
        this.store = Objects.requireNonNull(store, "store");
        this.idGenerator = Objects.requireNonNull(idGenerator, "idGenerator");
        this.clockProvider = Objects.requireNonNull(clockProvider, "clockProvider");
    }

    public OnboardingProfile submit(OnboardingCommand command) {
        Objects.requireNonNull(command, "command");
        LocalDateTime now = clockProvider.now();
        String profileId = store.findProfile().map(OnboardingProfile::id).orElseGet(() -> idGenerator.nextId("profile"));
        OnboardingProfile profile = new OnboardingProfile(
                profileId,
                command.region(),
                command.desiredRole(),
                command.desiredWorkType(),
                command.careerGapMonths(),
                command.hasResume(),
                command.hasInterviewExperience(),
                command.interests(),
                command.energyLevel(),
                now,
                now
        );
        store.saveProfile(profile);
        return profile;
    }
}
