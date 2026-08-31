package com.restartquest.quest;

import static com.restartquest.quest.QuestModels.AttemptRow;
import static com.restartquest.quest.QuestModels.CommandReceipt;
import static com.restartquest.quest.QuestModels.CommandResponse;
import static com.restartquest.quest.QuestModels.CompleteQuestRequest;
import static com.restartquest.quest.QuestModels.CreateJourneyRequest;
import static com.restartquest.quest.QuestModels.CurrentQuest;
import static com.restartquest.quest.QuestModels.JourneyRow;
import static com.restartquest.quest.QuestModels.JourneySnapshot;
import static com.restartquest.quest.QuestModels.Progress;
import static com.restartquest.quest.QuestModels.QuestStatus;
import static com.restartquest.quest.QuestModels.RecentAttempt;
import static com.restartquest.quest.QuestModels.ReframeQuestRequest;
import static com.restartquest.quest.QuestModels.Transition;
import static com.restartquest.quest.QuestModels.TransitionResult;
import static com.restartquest.quest.QuestModels.TransitionType;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.restartquest.quest.QuestModels.CatalogAction;
import com.restartquest.session.SessionTokenCodec;
import java.time.Clock;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class QuestService {

    private static final Set<Integer> AVAILABLE_MINUTES = Set.of(5, 15, 30);

    private final QuestRepository repository;
    private final QuestCatalog catalog;
    private final SessionTokenCodec tokenCodec;
    private final ObjectMapper objectMapper;
    private final Clock clock;

    public QuestService(
            QuestRepository repository,
            QuestCatalog catalog,
            SessionTokenCodec tokenCodec,
            ObjectMapper objectMapper,
            Clock clock) {
        this.repository = repository;
        this.catalog = catalog;
        this.tokenCodec = tokenCodec;
        this.objectMapper = objectMapper;
        this.clock = clock;
    }

    @Transactional
    public CommandResponse<JourneySnapshot> createJourney(
            String rawSessionToken,
            CreateJourneyRequest request) {
        if (!AVAILABLE_MINUTES.contains(request.availableMinutes())) {
            throw new QuestApiException(
                    HttpStatus.BAD_REQUEST,
                    "VALIDATION_ERROR",
                    "요청 값을 확인해 주세요.",
                    Map.of("availableMinutes", "5, 15, 30 중 하나여야 합니다."),
                    null);
        }

        Instant now = clock.instant();
        UUID sessionId = authenticate(rawSessionToken, now, true);
        String fingerprint = fingerprint(
                "CREATE_JOURNEY",
                request.goalType(),
                request.energyLevel(),
                request.availableMinutes());
        Optional<CommandReceipt> existingReceipt = repository.findReceipt(sessionId, request.commandId());
        if (existingReceipt.isPresent()) {
            return replay(existingReceipt.get(), fingerprint, JourneySnapshot.class);
        }
        if (repository.journeyExists(sessionId)) {
            throw new QuestApiException(
                    HttpStatus.CONFLICT,
                    "JOURNEY_ALREADY_EXISTS",
                    "이미 시작한 여정이 있습니다.");
        }

        UUID journeyId = UUID.randomUUID();
        repository.insertJourney(
                journeyId,
                sessionId,
                request.goalType(),
                request.energyLevel(),
                request.availableMinutes(),
                1,
                now);
        CatalogAction action = catalog.initial(
                request.goalType(), request.energyLevel(), request.availableMinutes());
        repository.insertAttempt(UUID.randomUUID(), journeyId, null, action, now);

        JourneySnapshot snapshot = snapshot(repository.findJourney(sessionId, false).orElseThrow());
        repository.insertReceipt(
                sessionId,
                request.commandId(),
                fingerprint,
                HttpStatus.CREATED.value(),
                serialize(snapshot),
                now);
        return new CommandResponse<>(HttpStatus.CREATED.value(), snapshot);
    }

    @Transactional(readOnly = true)
    public JourneySnapshot getJourney(String rawSessionToken) {
        UUID sessionId = authenticate(rawSessionToken, clock.instant(), false);
        JourneyRow journey = repository.findJourney(sessionId, false)
                .orElseThrow(() -> new QuestApiException(
                        HttpStatus.NOT_FOUND,
                        "JOURNEY_NOT_FOUND",
                        "시작한 여정을 찾을 수 없습니다."));
        return snapshot(journey);
    }

    @Transactional
    public CommandResponse<TransitionResult> complete(
            String rawSessionToken,
            UUID questId,
            CompleteQuestRequest request) {
        Instant now = clock.instant();
        UUID sessionId = authenticate(rawSessionToken, now, true);
        String fingerprint = fingerprint(
                "COMPLETE_QUEST", questId, request.expectedVersion());
        Optional<CommandReceipt> existingReceipt = repository.findReceipt(sessionId, request.commandId());
        if (existingReceipt.isPresent()) {
            return replay(existingReceipt.get(), fingerprint, TransitionResult.class);
        }

        JourneyRow journey = requireJourney(sessionId, true);
        requireExpectedVersion(journey, request.expectedVersion());
        AttemptRow active = requireActiveAttempt(journey, questId);

        repository.finishAttempt(active.id(), QuestStatus.COMPLETED, null, now);
        CatalogAction next = catalog.afterCompletion(
                journey.goalType(),
                journey.energyLevel(),
                journey.availableMinutes(),
                active.catalogKey());
        repository.insertAttempt(UUID.randomUUID(), journey.id(), null, next, now);
        repository.incrementJourneyVersion(journey.id(), journey.version(), now);

        JourneySnapshot updated = snapshot(repository.findJourney(sessionId, false).orElseThrow());
        TransitionResult result = new TransitionResult(
                new Transition(TransitionType.COMPLETED, active.id(), null), updated);
        repository.insertReceipt(
                sessionId,
                request.commandId(),
                fingerprint,
                HttpStatus.OK.value(),
                serialize(result),
                now);
        return new CommandResponse<>(HttpStatus.OK.value(), result);
    }

    @Transactional
    public CommandResponse<TransitionResult> reframe(
            String rawSessionToken,
            UUID questId,
            ReframeQuestRequest request) {
        Instant now = clock.instant();
        UUID sessionId = authenticate(rawSessionToken, now, true);
        String fingerprint = fingerprint(
                "REFRAME_QUEST", questId, request.reason(), request.expectedVersion());
        Optional<CommandReceipt> existingReceipt = repository.findReceipt(sessionId, request.commandId());
        if (existingReceipt.isPresent()) {
            return replay(existingReceipt.get(), fingerprint, TransitionResult.class);
        }

        JourneyRow journey = requireJourney(sessionId, true);
        requireExpectedVersion(journey, request.expectedVersion());
        AttemptRow active = requireActiveAttempt(journey, questId);

        repository.finishAttempt(active.id(), QuestStatus.REFRAMED, request.reason(), now);
        CatalogAction next = catalog.afterReframe(
                journey.goalType(), active.difficultyLevel(), request.reason());
        repository.insertAttempt(UUID.randomUUID(), journey.id(), active.id(), next, now);
        repository.incrementJourneyVersion(journey.id(), journey.version(), now);

        JourneySnapshot updated = snapshot(repository.findJourney(sessionId, false).orElseThrow());
        TransitionResult result = new TransitionResult(
                new Transition(TransitionType.REFRAMED, active.id(), request.reason()), updated);
        repository.insertReceipt(
                sessionId,
                request.commandId(),
                fingerprint,
                HttpStatus.OK.value(),
                serialize(result),
                now);
        return new CommandResponse<>(HttpStatus.OK.value(), result);
    }

    private UUID authenticate(String rawSessionToken, Instant now, boolean forUpdate) {
        if (!StringUtils.hasText(rawSessionToken)) {
            throw sessionRequired();
        }
        return repository.findActiveSession(tokenCodec.digest(rawSessionToken), now, forUpdate)
                .orElseThrow(this::sessionRequired);
    }

    private QuestApiException sessionRequired() {
        return new QuestApiException(
                HttpStatus.UNAUTHORIZED,
                "SESSION_REQUIRED",
                "익명 세션을 먼저 시작해 주세요.");
    }

    private JourneyRow requireJourney(UUID sessionId, boolean forUpdate) {
        return repository.findJourney(sessionId, forUpdate)
                .orElseThrow(() -> new QuestApiException(
                        HttpStatus.NOT_FOUND,
                        "JOURNEY_NOT_FOUND",
                        "시작한 여정을 찾을 수 없습니다."));
    }

    private void requireExpectedVersion(JourneyRow journey, long expectedVersion) {
        if (journey.version() != expectedVersion) {
            throw new QuestApiException(
                    HttpStatus.CONFLICT,
                    "STALE_JOURNEY",
                    "다른 요청이 먼저 반영되어 최신 상태를 불러왔습니다.",
                    null,
                    snapshot(journey));
        }
    }

    private AttemptRow requireActiveAttempt(JourneyRow journey, UUID requestedQuestId) {
        AttemptRow active = repository.findActiveAttempt(journey.id())
                .orElseThrow(() -> new IllegalStateException("journey has no active quest"));
        if (active.id().equals(requestedQuestId)) {
            return active;
        }
        if (repository.attemptBelongsToJourney(requestedQuestId, journey.id())) {
            throw new QuestApiException(
                    HttpStatus.CONFLICT,
                    "QUEST_NOT_ACTIVE",
                    "이미 종료된 행동입니다. 현재 행동을 확인해 주세요.");
        }
        throw new QuestApiException(
                HttpStatus.NOT_FOUND,
                "QUEST_NOT_FOUND",
                "행동을 찾을 수 없습니다.");
    }

    private JourneySnapshot snapshot(JourneyRow journey) {
        AttemptRow active = repository.findActiveAttempt(journey.id())
                .orElseThrow(() -> new IllegalStateException("journey has no active quest"));
        CurrentQuest currentQuest = new CurrentQuest(
                active.id(),
                active.catalogKey(),
                active.title(),
                active.instruction(),
                active.estimatedMinutes(),
                active.difficultyLevel());
        Progress progress = new Progress(
                repository.countAttempts(journey.id(), QuestStatus.COMPLETED),
                repository.countAttempts(journey.id(), QuestStatus.REFRAMED));
        var recentAttempts = repository.findRecentAttempts(journey.id()).stream()
                .map(attempt -> new RecentAttempt(
                        attempt.id(),
                        attempt.catalogKey(),
                        attempt.title(),
                        attempt.status(),
                        attempt.frictionReason(),
                        attempt.transitionedAt()))
                .toList();
        return new JourneySnapshot(
                journey.id(),
                journey.goalType(),
                journey.energyLevel(),
                journey.availableMinutes(),
                journey.version(),
                currentQuest,
                progress,
                recentAttempts);
    }

    private String fingerprint(String operation, Object... values) {
        StringBuilder canonical = new StringBuilder(operation);
        for (Object value : values) {
            canonical.append('|').append(value);
        }
        return tokenCodec.digest(canonical.toString());
    }

    private String serialize(Object body) {
        try {
            return objectMapper.writeValueAsString(body);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("command response serialization failed", exception);
        }
    }

    private <T> CommandResponse<T> replay(
            CommandReceipt receipt,
            String expectedFingerprint,
            Class<T> responseType) {
        if (!receipt.fingerprint().equals(expectedFingerprint)) {
            throw new QuestApiException(
                    HttpStatus.CONFLICT,
                    "COMMAND_ID_REUSED",
                    "같은 commandId를 다른 요청에 사용할 수 없습니다.");
        }
        try {
            return new CommandResponse<>(
                    receipt.responseStatus(),
                    objectMapper.readValue(receipt.responseBody(), responseType));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("stored command response is unreadable", exception);
        }
    }
}
