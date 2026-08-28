package com.restartquest.application.user;

import com.restartquest.application.error.AppException;
import com.restartquest.application.port.OnboardingProfileStore;
import com.restartquest.application.port.UserStore;
import com.restartquest.domain.user.OnboardingProfile;
import com.restartquest.domain.user.User;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OnboardingService {

    private final UserStore userStore;
    private final OnboardingProfileStore profileStore;

    public OnboardingService(UserStore userStore, OnboardingProfileStore profileStore) {
        this.userStore = userStore;
        this.profileStore = profileStore;
    }

    @Transactional(readOnly = true)
    public OnboardingResult get(UUID userId) {
        User user = requireUser(userId);
        OnboardingProfile profile = profileStore.findByUserId(userId)
                .orElseThrow(() -> new AppException(
                        HttpStatus.NOT_FOUND,
                        "ONBOARDING_NOT_FOUND",
                        "온보딩 정보가 아직 없습니다."
                ));
        return new OnboardingResult(profile, user.isOnboardingCompleted());
    }

    @Transactional
    public OnboardingResult upsert(UUID userId, OnboardingCommand command) {
        User user = requireUser(userId);
        OnboardingProfile profile = profileStore.findByUserId(userId)
                .orElseGet(() -> OnboardingProfile.create(userId));
        profile.update(
                command.desiredJob().trim(),
                normalizeOptional(command.region()),
                command.desiredWorkType(),
                command.careerGapMonths(),
                command.hasResume(),
                command.interviewExperience()
        );
        OnboardingProfile savedProfile = profileStore.save(profile);
        user.completeOnboarding();
        userStore.save(user);
        return new OnboardingResult(savedProfile, user.isOnboardingCompleted());
    }

    private User requireUser(UUID userId) {
        return userStore.findById(userId)
                .orElseThrow(() -> new AppException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "인증이 필요합니다."));
    }

    private static String normalizeOptional(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
