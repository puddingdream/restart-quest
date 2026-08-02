package com.restartquest.infrastructure.persistence;

import com.restartquest.application.port.OnboardingProfileStore;
import com.restartquest.domain.user.OnboardingProfile;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public class OnboardingProfileStoreAdapter implements OnboardingProfileStore {

    private final JpaOnboardingProfileRepository repository;

    public OnboardingProfileStoreAdapter(JpaOnboardingProfileRepository repository) {
        this.repository = repository;
    }

    @Override
    public Optional<OnboardingProfile> findByUserId(UUID userId) {
        return repository.findById(userId);
    }

    @Override
    public OnboardingProfile save(OnboardingProfile profile) {
        return repository.saveAndFlush(profile);
    }
}

interface JpaOnboardingProfileRepository extends JpaRepository<OnboardingProfile, UUID> {
}
