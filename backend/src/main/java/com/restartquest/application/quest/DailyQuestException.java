package com.restartquest.application.quest;

import com.restartquest.application.error.AppException;
import org.springframework.http.HttpStatus;

public final class DailyQuestException extends AppException {

    private DailyQuestException(HttpStatus status, String code, String message) {
        super(status, code, message);
    }

    public static DailyQuestException onboardingRequired() {
        return new DailyQuestException(
                HttpStatus.CONFLICT,
                "ONBOARDING_REQUIRED",
                "오늘의 퀘스트를 시작하려면 온보딩을 먼저 완료해 주세요."
        );
    }
}
