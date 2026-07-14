package com.restartquest.backend.presentation.dto;

import com.restartquest.backend.domain.QuestFailureReason;

public record QuestFailureRequest(String reason, String memo) {
    public QuestFailureReason parsedReason() {
        return QuestFailureReason.valueOf(reason);
    }
}
