package com.restartquest.presentation.quest;

import com.restartquest.application.quest.CompleteQuestService;
import com.restartquest.infrastructure.security.AuthenticatedUser;
import com.restartquest.presentation.quest.dto.QuestJourneyResponse;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/quests")
public class QuestController {

    private final CompleteQuestService completeQuestService;

    public QuestController(CompleteQuestService completeQuestService) {
        this.completeQuestService = completeQuestService;
    }

    @PostMapping("/{questId}/completion")
    public QuestJourneyResponse complete(
            @AuthenticationPrincipal AuthenticatedUser authenticatedUser,
            @PathVariable UUID questId
    ) {
        return QuestJourneyResponse.from(completeQuestService.complete(authenticatedUser.userId(), questId));
    }
}
