package com.restartquest.quest;

import com.restartquest.common.error.ApiException;
import com.restartquest.config.PlatformTime;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class QuestService {

    private final DailyCheckInRepository checkIns;
    private final QuestRepository quests;
    private final QuestOutcomeRepository outcomes;
    private final ActionCatalog catalog;
    private final PlatformTime time;

    QuestService(
            DailyCheckInRepository checkIns,
            QuestRepository quests,
            QuestOutcomeRepository outcomes,
            ActionCatalog catalog,
            PlatformTime time) {
        this.checkIns = checkIns;
        this.quests = quests;
        this.outcomes = outcomes;
        this.catalog = catalog;
        this.time = time;
    }

    @Transactional(readOnly = true)
    TodayView today(UUID accountId) {
        return currentToday(accountId);
    }

    @Transactional
    TodayView checkIn(
            UUID accountId,
            EnergyLevel energyLevel,
            Integer availableMinutes,
            FocusArea focusArea) {
        validateCheckIn(energyLevel, availableMinutes, focusArea);
        LocalDate date = time.businessDate();
        if (checkIns.findByAccountIdAndLocalDate(accountId, date).isPresent()) {
            throw conflict("CHECK_IN_ALREADY_EXISTS", "오늘의 체크인은 이미 기록되어 있어요.");
        }
        if (quests.existsByAccountIdAndStatus(accountId, QuestStatus.ACTIVE)) {
            throw conflict("ACTIVE_QUEST_CONFLICT", "진행 중인 행동을 먼저 마무리해 주세요.");
        }

        Instant now = time.now();
        DailyCheckIn checkIn = new DailyCheckIn(
                UUID.randomUUID(),
                accountId,
                date,
                energyLevel,
                availableMinutes,
                focusArea,
                now);
        Quest quest = new Quest(
                UUID.randomUUID(),
                accountId,
                checkIn.getId(),
                catalog.recommend(focusArea, availableMinutes, energyLevel),
                null,
                now);
        try {
            checkIns.save(checkIn);
            quests.saveAndFlush(quest);
        } catch (DataIntegrityViolationException exception) {
            throw conflict("CHECK_IN_ALREADY_EXISTS", "오늘의 체크인은 이미 기록되어 있어요.");
        }
        return activeToday(date, checkIn, quest);
    }

    @Transactional
    TodayView complete(UUID accountId, UUID questId, long expectedVersion) {
        Quest quest = ownedQuest(accountId, questId);
        assertCurrent(quest, expectedVersion);
        transition(quest, accountId, expectedVersion, QuestStatus.COMPLETED);
        outcomes.saveAndFlush(QuestOutcome.completed(questId, time.now()));
        return currentToday(accountId);
    }

    @Transactional
    TodayView block(
            UUID accountId,
            UUID questId,
            long expectedVersion,
            Barrier barrier,
            String note) {
        Quest quest = ownedQuest(accountId, questId);
        assertCurrent(quest, expectedVersion);
        if (quest.getDifficulty() == 0) {
            throw conflict("NO_SMALLER_QUEST", "이 행동은 더 줄이지 않고 그대로 두었어요.");
        }
        ActionCatalog.Recommendation fallback = catalog.fallback(quest.getTemplateKey());
        if (fallback == null) {
            throw conflict("NO_SMALLER_QUEST", "이 행동은 더 줄이지 않고 그대로 두었어요.");
        }

        transition(quest, accountId, expectedVersion, QuestStatus.REPLACED);
        Instant now = time.now();
        outcomes.save(QuestOutcome.blocked(questId, barrier, note, now));
        Quest replacement = new Quest(
                UUID.randomUUID(),
                accountId,
                quest.getCheckInId(),
                fallback,
                questId,
                now);
        quests.saveAndFlush(replacement);
        return currentToday(accountId);
    }

    @Transactional(readOnly = true)
    HistoryView history(UUID accountId, LocalDate from, LocalDate to) {
        validateHistoryRange(from, to);
        List<DailyCheckIn> selectedCheckIns =
                checkIns.findByAccountIdAndLocalDateBetweenOrderByLocalDateDesc(accountId, from, to);
        if (selectedCheckIns.isEmpty()) {
            return new HistoryView(List.of());
        }

        List<UUID> checkInIds = selectedCheckIns.stream().map(DailyCheckIn::getId).toList();
        List<Quest> selectedQuests = quests.findByAccountIdAndCheckInIdIn(accountId, checkInIds);
        Map<UUID, Quest> questById = selectedQuests.stream()
                .collect(Collectors.toMap(Quest::getId, Function.identity()));
        List<QuestOutcome> selectedOutcomes = questById.isEmpty()
                ? List.of()
                : outcomes.findByQuestIdInOrderByCreatedAtAsc(questById.keySet()).stream()
                        .sorted(Comparator
                                .comparingInt((QuestOutcome outcome) ->
                                        questDepth(questById.get(outcome.getQuestId()), questById))
                                .thenComparing(QuestOutcome::getCreatedAt)
                                .thenComparing(QuestOutcome::getQuestId))
                        .toList();
        Map<UUID, List<HistoryOutcomeView>> outcomesByCheckIn = new HashMap<>();
        for (QuestOutcome outcome : selectedOutcomes) {
            Quest quest = questById.get(outcome.getQuestId());
            if (quest != null) {
                outcomesByCheckIn.computeIfAbsent(quest.getCheckInId(), ignored -> new java.util.ArrayList<>())
                        .add(HistoryOutcomeView.from(outcome, quest));
            }
        }

        List<HistoryDayView> days = selectedCheckIns.stream()
                .map(checkIn -> new HistoryDayView(
                        checkIn.getLocalDate(),
                        CheckInView.from(checkIn),
                        List.copyOf(outcomesByCheckIn.getOrDefault(checkIn.getId(), List.of()))))
                .toList();
        return new HistoryView(days);
    }

    private int questDepth(Quest quest, Map<UUID, Quest> questById) {
        int depth = 0;
        Quest current = quest;
        java.util.Set<UUID> visited = new HashSet<>();
        while (current != null
                && current.getPredecessorQuestId() != null
                && visited.add(current.getId())) {
            depth++;
            current = questById.get(current.getPredecessorQuestId());
        }
        return depth;
    }

    private TodayView currentToday(UUID accountId) {
        LocalDate date = time.businessDate();
        Quest active = quests.findFirstByAccountIdAndStatusOrderByCreatedAtDesc(
                accountId, QuestStatus.ACTIVE).orElse(null);
        if (active != null) {
            DailyCheckIn activeCheckIn = checkIns.findById(active.getCheckInId())
                    .orElseThrow(() -> new IllegalStateException("Active quest has no check-in"));
            return activeToday(date, activeCheckIn, active);
        }
        DailyCheckIn checkIn = checkIns.findByAccountIdAndLocalDate(accountId, date).orElse(null);
        if (checkIn == null) {
            return new TodayView(date, TodayPhase.CHECK_IN_REQUIRED, null, null, null);
        }
        Quest completed = quests.findFirstByAccountIdAndCheckInIdAndStatusOrderByCreatedAtDesc(
                        accountId, checkIn.getId(), QuestStatus.COMPLETED)
                .orElseThrow(() -> new IllegalStateException("Check-in has no current quest"));
        return new TodayView(
                date,
                TodayPhase.DAY_COMPLETED,
                CheckInView.from(checkIn),
                null,
                QuestView.from(completed));
    }

    private TodayView activeToday(LocalDate date, DailyCheckIn checkIn, Quest quest) {
        return new TodayView(
                date,
                TodayPhase.QUEST_ACTIVE,
                CheckInView.from(checkIn),
                QuestView.from(quest),
                null);
    }

    private Quest ownedQuest(UUID accountId, UUID questId) {
        return quests.findByIdAndAccountId(questId, accountId)
                .orElseThrow(() -> new ApiException(
                        HttpStatus.NOT_FOUND,
                        "RESOURCE_NOT_FOUND",
                        "행동을 찾을 수 없습니다."));
    }

    private void assertCurrent(Quest quest, long expectedVersion) {
        if (quest.getStatus() != QuestStatus.ACTIVE || quest.getVersion() != expectedVersion) {
            throw conflict("STALE_QUEST", "행동 상태가 이미 변경되었어요. 오늘 상태를 다시 확인해 주세요.");
        }
    }

    private void transition(Quest quest, UUID accountId, long expectedVersion, QuestStatus nextStatus) {
        int changed = quests.transition(
                quest.getId(),
                accountId,
                expectedVersion,
                QuestStatus.ACTIVE,
                nextStatus);
        if (changed != 1) {
            throw conflict("STALE_QUEST", "행동 상태가 이미 변경되었어요. 오늘 상태를 다시 확인해 주세요.");
        }
    }

    private void validateCheckIn(EnergyLevel energyLevel, Integer minutes, FocusArea focusArea) {
        if (energyLevel == null || focusArea == null || minutes == null || !List.of(5, 15, 30).contains(minutes)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "체크인 값을 확인해 주세요.");
        }
    }

    private void validateHistoryRange(LocalDate from, LocalDate to) {
        if (from == null || to == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "기록 조회 날짜를 확인해 주세요.");
        }
        long daysBetween = ChronoUnit.DAYS.between(from, to);
        if (daysBetween < 0 || daysBetween > 30) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "VALIDATION_ERROR",
                    "기록은 최대 31일 범위로 조회해 주세요.");
        }
    }

    private ApiException conflict(String code, String message) {
        return new ApiException(HttpStatus.CONFLICT, code, message);
    }

    enum TodayPhase {
        CHECK_IN_REQUIRED,
        QUEST_ACTIVE,
        DAY_COMPLETED
    }

    record TodayView(
            LocalDate date,
            TodayPhase phase,
            CheckInView checkIn,
            QuestView activeQuest,
            QuestView completedQuest) {
    }

    record CheckInView(EnergyLevel energyLevel, int availableMinutes, FocusArea focusArea) {

        static CheckInView from(DailyCheckIn checkIn) {
            return new CheckInView(
                    checkIn.getEnergyLevel(),
                    checkIn.getAvailableMinutes(),
                    checkIn.getFocusArea());
        }
    }

    record QuestView(
            UUID id,
            String templateKey,
            String catalogVersion,
            String title,
            int estimatedMinutes,
            int difficulty,
            String reason,
            long version,
            UUID predecessorQuestId) {

        static QuestView from(Quest quest) {
            return new QuestView(
                    quest.getId(),
                    quest.getTemplateKey(),
                    ActionCatalog.VERSION,
                    quest.getTitle(),
                    quest.getEstimatedMinutes(),
                    quest.getDifficulty(),
                    quest.getRecommendationReason(),
                    quest.getVersion(),
                    quest.getPredecessorQuestId());
        }
    }

    record HistoryView(List<HistoryDayView> days) {
    }

    record HistoryDayView(LocalDate date, CheckInView checkIn, List<HistoryOutcomeView> outcomes) {
    }

    record HistoryOutcomeView(
            OutcomeType type,
            Barrier barrier,
            String note,
            Instant createdAt,
            HistoryQuestView quest) {

        static HistoryOutcomeView from(QuestOutcome outcome, Quest quest) {
            return new HistoryOutcomeView(
                    outcome.getType(),
                    outcome.getBarrier(),
                    outcome.getNote(),
                    outcome.getCreatedAt(),
                    new HistoryQuestView(
                            quest.getId(),
                            quest.getTitle(),
                            quest.getEstimatedMinutes(),
                            quest.getDifficulty()));
        }
    }

    record HistoryQuestView(UUID id, String title, int estimatedMinutes, int difficulty) {
    }
}
