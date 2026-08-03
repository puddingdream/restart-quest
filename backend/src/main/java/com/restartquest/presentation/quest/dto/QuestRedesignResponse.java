package com.restartquest.presentation.quest.dto;

import com.restartquest.domain.quest.QuestRedesign;
import com.restartquest.domain.quest.QuestRedesignReasonCode;
import java.time.OffsetDateTime;
import java.util.UUID;

public record QuestRedesignResponse(
        UUID redesignId,
        UUID journeyId,
        UUID originalQuestId,
        UUID replacementQuestId,
        QuestRedesignReasonCode reasonCode,
        String reasonNote,
        OffsetDateTime createdAt
) {

    public static QuestRedesignResponse from(QuestRedesign redesign) {
        return new QuestRedesignResponse(
                redesign.getId(),
                redesign.getJourneyId(),
                redesign.getOriginalQuestId(),
                redesign.getReplacementQuestId(),
                redesign.getReasonCode(),
                redesign.getReasonNote(),
                redesign.getCreatedAt()
        );
    }
}
