package com.restartquest.quest;

import com.restartquest.auth.AuthenticatedAccount;
import com.restartquest.common.error.ApiException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
class QuestController {

    private final QuestService questService;

    QuestController(QuestService questService) {
        this.questService = questService;
    }

    @GetMapping("/api/v1/today")
    QuestService.TodayView today(@AuthenticationPrincipal AuthenticatedAccount account) {
        return questService.today(account.id());
    }

    @PostMapping("/api/v1/check-ins")
    @ResponseStatus(HttpStatus.CREATED)
    QuestService.TodayView checkIn(
            @AuthenticationPrincipal AuthenticatedAccount account,
            @Valid @RequestBody CheckInRequest request) {
        return questService.checkIn(
                account.id(),
                request.energyLevel(),
                request.availableMinutes(),
                request.focusArea());
    }

    @PostMapping("/api/v1/quests/{questId}/complete")
    QuestService.TodayView complete(
            @AuthenticationPrincipal AuthenticatedAccount account,
            @PathVariable String questId,
            @Valid @RequestBody CompleteRequest request) {
        return questService.complete(account.id(), parseQuestId(questId), request.version());
    }

    @PostMapping("/api/v1/quests/{questId}/block")
    QuestService.TodayView block(
            @AuthenticationPrincipal AuthenticatedAccount account,
            @PathVariable String questId,
            @Valid @RequestBody BlockRequest request) {
        return questService.block(
                account.id(),
                parseQuestId(questId),
                request.version(),
                request.barrier(),
                request.note());
    }

    @GetMapping("/api/v1/history")
    QuestService.HistoryView history(
            @AuthenticationPrincipal AuthenticatedAccount account,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to) {
        return questService.history(account.id(), parseDate(from), parseDate(to));
    }

    private LocalDate parseDate(String value) {
        if (value == null) {
            return null;
        }
        try {
            return LocalDate.parse(value);
        } catch (DateTimeParseException exception) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "기록 조회 날짜를 확인해 주세요.");
        }
    }

    private UUID parseQuestId(String value) {
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException exception) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "행동 식별자를 확인해 주세요.");
        }
    }

    record CheckInRequest(
            @NotNull EnergyLevel energyLevel,
            @NotNull Integer availableMinutes,
            @NotNull FocusArea focusArea) {
    }

    record CompleteRequest(@NotNull @PositiveOrZero Long version) {
    }

    record BlockRequest(
            @NotNull @PositiveOrZero Long version,
            @NotNull Barrier barrier,
            @Size(max = 300) String note) {
    }
}
