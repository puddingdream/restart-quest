package com.restartquest.presentation.quest.dto;

import com.restartquest.domain.quest.QuestRedesignReasonCode;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record FailureRedesignRequest(
        @NotNull(message = "어려웠던 이유를 선택해 주세요.")
        QuestRedesignReasonCode reasonCode,

        @Size(max = 300, message = "메모는 300자 이하여야 합니다.")
        String reasonNote
) {
}
