package com.restartquest.application.ai;

import com.restartquest.domain.quest.EnergyLevel;
import com.restartquest.domain.user.DesiredWorkType;
import com.restartquest.domain.user.InterviewExperience;
import java.util.Objects;

public record QuestPersonalization(
        String desiredJob,
        String region,
        DesiredWorkType desiredWorkType,
        int careerGapMonths,
        boolean hasResume,
        InterviewExperience interviewExperience,
        EnergyLevel energyLevel
) {

    public QuestPersonalization {
        desiredJob = requiredText(desiredJob, 80, "desiredJob");
        region = optionalText(region, 80, "region");
        Objects.requireNonNull(desiredWorkType, "desiredWorkType은 필수입니다.");
        Objects.requireNonNull(interviewExperience, "interviewExperience는 필수입니다.");
        Objects.requireNonNull(energyLevel, "energyLevel은 필수입니다.");
        if (careerGapMonths < 0 || careerGapMonths > 600) {
            throw new IllegalArgumentException("careerGapMonths는 0 이상 600 이하여야 합니다.");
        }
    }

    private static String requiredText(String value, int maximumLength, String field) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(field + "은 필수입니다.");
        }
        String normalized = value.trim();
        if (normalized.length() > maximumLength) {
            throw new IllegalArgumentException(field + "가 허용 길이를 초과했습니다.");
        }
        return normalized;
    }

    private static String optionalText(String value, int maximumLength, String field) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String normalized = value.trim();
        if (normalized.length() > maximumLength) {
            throw new IllegalArgumentException(field + "가 허용 길이를 초과했습니다.");
        }
        return normalized;
    }
}
