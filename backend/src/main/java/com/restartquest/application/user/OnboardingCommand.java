package com.restartquest.application.user;

import com.restartquest.domain.user.DesiredWorkType;
import com.restartquest.domain.user.InterviewExperience;

public record OnboardingCommand(
        String desiredJob,
        String region,
        DesiredWorkType desiredWorkType,
        int careerGapMonths,
        boolean hasResume,
        InterviewExperience interviewExperience
) {
}
