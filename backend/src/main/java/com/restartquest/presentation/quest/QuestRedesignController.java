package com.restartquest.presentation.quest;

import com.restartquest.application.quest.RedesignQuestService;
import com.restartquest.infrastructure.security.AuthenticatedUser;
import com.restartquest.presentation.quest.dto.FailureRedesignRequest;
import com.restartquest.presentation.quest.dto.FailureRedesignResponse;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/quests")
public class QuestRedesignController {

    private final RedesignQuestService redesignQuestService;

    public QuestRedesignController(RedesignQuestService redesignQuestService) {
        this.redesignQuestService = redesignQuestService;
    }

    @PostMapping("/{questId}/failure-redesign")
    public FailureRedesignResponse redesign(
            @AuthenticationPrincipal AuthenticatedUser authenticatedUser,
            @PathVariable UUID questId,
            @Valid @RequestBody FailureRedesignRequest request
    ) {
        return FailureRedesignResponse.from(redesignQuestService.redesign(
                authenticatedUser.userId(),
                questId,
                request.reasonCode(),
                request.reasonNote()
        ));
    }
}
