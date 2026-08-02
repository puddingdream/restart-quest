package com.restartquest.application.ai;

import com.restartquest.domain.quest.QuestRedesignReasonCode;
import java.util.Objects;

public record QuestRedesignRequest(
        QuestPersonalization personalization,
        QuestDraft originalQuest,
        QuestRedesignReasonCode reasonCode,
        String reasonNote
) {

    public QuestRedesignRequest {
        Objects.requireNonNull(personalization, "personalization은 필수입니다.");
        Objects.requireNonNull(originalQuest, "originalQuest는 필수입니다.");
        Objects.requireNonNull(reasonCode, "reasonCode는 필수입니다.");
        reasonNote = optionalText(reasonNote, 300, "reasonNote");
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
