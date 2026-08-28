package com.restartquest.application.ai;

import com.restartquest.application.error.AppException;
import org.springframework.http.HttpStatus;

public final class QuestAiException extends AppException {

    private QuestAiException(HttpStatus status, String code, String message) {
        super(status, code, message);
    }

    public static QuestAiException quotaExceeded() {
        return new QuestAiException(
                HttpStatus.TOO_MANY_REQUESTS,
                "AI_QUOTA_EXCEEDED",
                "AI 사용량 한도를 초과했습니다. 잠시 후 다시 시도해 주세요."
        );
    }

    public static QuestAiException invalidResponse() {
        return new QuestAiException(
                HttpStatus.BAD_GATEWAY,
                "AI_INVALID_RESPONSE",
                "퀘스트 생성 결과를 확인할 수 없습니다. 다시 시도해 주세요."
        );
    }

    public static QuestAiException providerUnavailable() {
        return new QuestAiException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "AI_PROVIDER_UNAVAILABLE",
                "AI 서비스를 사용할 수 없습니다. 잠시 후 다시 시도해 주세요."
        );
    }

    public static QuestAiException providerTimeout() {
        return new QuestAiException(
                HttpStatus.GATEWAY_TIMEOUT,
                "AI_PROVIDER_TIMEOUT",
                "AI 서비스 응답이 지연되고 있습니다. 다시 시도해 주세요."
        );
    }
}
