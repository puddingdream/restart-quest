package com.restartquest.presentation.quest;

import com.restartquest.application.quest.GenerateDailyQuestsService;
import com.restartquest.application.quest.GetTodayQuestsService;
import com.restartquest.infrastructure.security.AuthenticatedUser;
import com.restartquest.presentation.quest.dto.DailyQuestResponse;
import com.restartquest.presentation.quest.dto.GenerateDailyQuestsRequest;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/quests/today")
public class DailyQuestController {

    private final GetTodayQuestsService getTodayQuestsService;
    private final GenerateDailyQuestsService generateDailyQuestsService;

    public DailyQuestController(
            GetTodayQuestsService getTodayQuestsService,
            GenerateDailyQuestsService generateDailyQuestsService
    ) {
        this.getTodayQuestsService = getTodayQuestsService;
        this.generateDailyQuestsService = generateDailyQuestsService;
    }

    @GetMapping
    public DailyQuestResponse getToday(
            @AuthenticationPrincipal AuthenticatedUser authenticatedUser
    ) {
        return DailyQuestResponse.from(getTodayQuestsService.get(authenticatedUser.userId()));
    }

    @PostMapping("/generate")
    public DailyQuestResponse generate(
            @AuthenticationPrincipal AuthenticatedUser authenticatedUser,
            @Valid @RequestBody GenerateDailyQuestsRequest request
    ) {
        return DailyQuestResponse.from(
                generateDailyQuestsService.generate(authenticatedUser.userId(), request.energyLevel())
        );
    }
}
