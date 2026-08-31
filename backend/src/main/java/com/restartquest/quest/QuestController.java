package com.restartquest.quest;

import com.restartquest.quest.QuestModels.CommandResponse;
import com.restartquest.quest.QuestModels.CompleteQuestRequest;
import com.restartquest.quest.QuestModels.CreateJourneyRequest;
import com.restartquest.quest.QuestModels.JourneySnapshot;
import com.restartquest.quest.QuestModels.ReframeQuestRequest;
import com.restartquest.quest.QuestModels.TransitionResult;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class QuestController {

    private static final String SESSION_COOKIE = "rq_session";

    private final QuestService service;

    public QuestController(QuestService service) {
        this.service = service;
    }

    @PostMapping(value = "/journey", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<JourneySnapshot> createJourney(
            @CookieValue(name = SESSION_COOKIE, required = false) String sessionToken,
            @Valid @RequestBody CreateJourneyRequest request) {
        CommandResponse<JourneySnapshot> response = service.createJourney(sessionToken, request);
        return ResponseEntity.status(response.status()).body(response.body());
    }

    @GetMapping("/journey")
    public JourneySnapshot getJourney(
            @CookieValue(name = SESSION_COOKIE, required = false) String sessionToken) {
        return service.getJourney(sessionToken);
    }

    @PostMapping(
            value = "/quests/{questId}/complete",
            consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<TransitionResult> complete(
            @CookieValue(name = SESSION_COOKIE, required = false) String sessionToken,
            @PathVariable UUID questId,
            @Valid @RequestBody CompleteQuestRequest request) {
        CommandResponse<TransitionResult> response = service.complete(sessionToken, questId, request);
        return ResponseEntity.status(response.status()).body(response.body());
    }

    @PostMapping(
            value = "/quests/{questId}/reframe",
            consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<TransitionResult> reframe(
            @CookieValue(name = SESSION_COOKIE, required = false) String sessionToken,
            @PathVariable UUID questId,
            @Valid @RequestBody ReframeQuestRequest request) {
        CommandResponse<TransitionResult> response = service.reframe(sessionToken, questId, request);
        return ResponseEntity.status(response.status()).body(response.body());
    }
}
