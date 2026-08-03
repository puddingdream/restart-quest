package com.restartquest.presentation.onboarding.dto;

import com.restartquest.application.user.OnboardingCommand;
import com.restartquest.domain.user.DesiredWorkType;
import com.restartquest.domain.user.InterviewExperience;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record OnboardingRequest(
        @NotBlank(message = "희망 직무를 입력해 주세요.")
        @Size(min = 2, max = 80, message = "희망 직무는 2자 이상 80자 이하여야 합니다.")
        String desiredJob,

        @Size(max = 80, message = "지역은 80자 이하여야 합니다.")
        String region,

        @NotNull(message = "희망 근무 형태를 선택해 주세요.")
        DesiredWorkType desiredWorkType,

        @NotNull(message = "취업 공백 기간을 입력해 주세요.")
        @Min(value = 0, message = "취업 공백 기간은 0개월 이상이어야 합니다.")
        @Max(value = 600, message = "취업 공백 기간은 600개월 이하여야 합니다.")
        Integer careerGapMonths,

        @NotNull(message = "이력서 보유 여부를 선택해 주세요.")
        Boolean hasResume,

        @NotNull(message = "면접 경험을 선택해 주세요.")
        InterviewExperience interviewExperience
) {

    public OnboardingRequest {
        desiredJob = desiredJob == null ? null : desiredJob.trim();
        region = region == null ? null : region.trim();
    }

    public OnboardingCommand toCommand() {
        return new OnboardingCommand(
                desiredJob,
                region,
                desiredWorkType,
                careerGapMonths,
                hasResume,
                interviewExperience
        );
    }
}
