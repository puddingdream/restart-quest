package com.restartquest.quest;

import com.restartquest.quest.QuestModels.JourneySnapshot;
import java.util.Map;
import org.springframework.http.HttpStatus;

class QuestApiException extends RuntimeException {

    private final HttpStatus status;
    private final String code;
    private final Map<String, String> fieldErrors;
    private final JourneySnapshot snapshot;

    QuestApiException(HttpStatus status, String code, String message) {
        this(status, code, message, null, null);
    }

    QuestApiException(
            HttpStatus status,
            String code,
            String message,
            Map<String, String> fieldErrors,
            JourneySnapshot snapshot) {
        super(message);
        this.status = status;
        this.code = code;
        this.fieldErrors = fieldErrors;
        this.snapshot = snapshot;
    }

    HttpStatus status() {
        return status;
    }

    String code() {
        return code;
    }

    Map<String, String> fieldErrors() {
        return fieldErrors;
    }

    JourneySnapshot snapshot() {
        return snapshot;
    }
}
