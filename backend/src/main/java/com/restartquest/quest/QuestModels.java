package com.restartquest.quest;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class QuestModels {

    private QuestModels() {
    }

    public enum GoalType {
        JOB_SEARCH,
        RESUME,
        NETWORKING
    }

    public enum EnergyLevel {
        LOW,
        MEDIUM,
        HIGH
    }

    public enum FrictionReason {
        TOO_BIG,
        UNCLEAR,
        LOW_ENERGY,
        MISSING_MATERIAL,
        OTHER
    }

    public enum QuestStatus {
        ACTIVE,
        COMPLETED,
        REFRAMED
    }

    public enum TransitionType {
        COMPLETED,
        REFRAMED
    }

    public record CreateJourneyRequest(
            @NotNull GoalType goalType,
            @NotNull EnergyLevel energyLevel,
            @NotNull Integer availableMinutes,
            @NotNull UUID commandId) {
    }

    public record CompleteQuestRequest(
            @NotNull UUID commandId,
            @NotNull @PositiveOrZero Long expectedVersion) {
    }

    public record ReframeQuestRequest(
            @NotNull FrictionReason reason,
            @NotNull UUID commandId,
            @NotNull @PositiveOrZero Long expectedVersion) {
    }

    public record CurrentQuest(
            UUID id,
            String catalogKey,
            String title,
            String instruction,
            int estimatedMinutes,
            int difficultyLevel) {
    }

    public record Progress(int completedCount, int reframedCount) {
    }

    public record RecentAttempt(
            UUID id,
            String catalogKey,
            String title,
            QuestStatus status,
            FrictionReason frictionReason,
            Instant transitionedAt) {
    }

    public record JourneySnapshot(
            UUID journeyId,
            GoalType goalType,
            EnergyLevel energyLevel,
            int availableMinutes,
            long version,
            CurrentQuest currentQuest,
            Progress progress,
            List<RecentAttempt> recentAttempts) {
    }

    public record Transition(
            TransitionType type,
            UUID previousAttemptId,
            FrictionReason reason) {
    }

    public record TransitionResult(Transition transition, JourneySnapshot snapshot) {
    }

    public record ApiError(
            String code,
            String message,
            Map<String, String> fieldErrors,
            JourneySnapshot snapshot) {
    }

    record CatalogAction(
            String key,
            String title,
            String instruction,
            int estimatedMinutes,
            int difficultyLevel) {
    }

    record JourneyRow(
            UUID id,
            UUID sessionId,
            GoalType goalType,
            EnergyLevel energyLevel,
            int availableMinutes,
            long version) {
    }

    record AttemptRow(
            UUID id,
            UUID journeyId,
            String catalogKey,
            String title,
            String instruction,
            int estimatedMinutes,
            int difficultyLevel,
            QuestStatus status,
            FrictionReason frictionReason,
            Instant transitionedAt) {
    }

    record CommandReceipt(String fingerprint, int responseStatus, String responseBody) {
    }

    record CommandResponse<T>(int status, T body) {
    }
}
