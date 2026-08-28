package com.restartquest.presentation.onboarding.dto;

import com.restartquest.domain.user.DesiredWorkType;
import com.restartquest.domain.user.InterviewExperience;
import com.restartquest.domain.user.OnboardingProfile;
import java.time.OffsetDateTime;
import java.util.UUID;

public record OnboardingProfileResponse(
        UUID userId,
        String desiredJob,
        String region,
        DesiredWorkType desiredWorkType,
        int careerGapMonths,
        boolean hasResume,
        InterviewExperience interviewExperience,
        OffsetDateTime updatedAt
) {

    public static OnboardingProfileResponse from(OnboardingProfile profile) {
        return new OnboardingProfileResponse(
                profile.getUserId(),
                profile.getDesiredJob(),
                profile.getRegion(),
                profile.getDesiredWorkType(),
                profile.getCareerGapMonths(),
                profile.isHasResume(),
                profile.getInterviewExperience(),
                profile.getUpdatedAt()
        );
    }
}
