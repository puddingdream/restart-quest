package com.restartquest.application.ai;

import java.util.Objects;

public record QuestGenerationRequest(QuestPersonalization personalization) {

    public QuestGenerationRequest {
        Objects.requireNonNull(personalization, "personalization은 필수입니다.");
    }
}
