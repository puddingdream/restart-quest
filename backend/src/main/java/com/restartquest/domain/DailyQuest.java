package com.restartquest.domain;

import java.util.Objects;

public final class DailyQuest {
    public static final int MIN_ESTIMATED_MINUTES = 1;
    public static final int MAX_ESTIMATED_MINUTES = 30;

    private final String id;
    private final String title;
    private final String description;
    private final QuestCategory category;
    private final QuestDifficulty difficulty;
    private final int estimatedMinutes;
    private final String completionCriteria;
    private final String parentQuestId;
    private QuestStatus status;
    private FailureReason failureReason;
    private String failureNote;

    private DailyQuest(
            String id,
            String title,
            String description,
            QuestCategory category,
            QuestDifficulty difficulty,
            int estimatedMinutes,
            String completionCriteria,
            QuestStatus status,
            String parentQuestId
    ) {
        this.id = requireText(id, "id");
        this.title = requireText(title, "title");
        this.description = requireText(description, "description");
        this.category = Objects.requireNonNull(category, "category");
        this.difficulty = Objects.requireNonNull(difficulty, "difficulty");
        if (estimatedMinutes < MIN_ESTIMATED_MINUTES || estimatedMinutes > MAX_ESTIMATED_MINUTES) {
            throw new IllegalArgumentException("estimatedMinutes must be between 1 and 30");
        }
        this.estimatedMinutes = estimatedMinutes;
        this.completionCriteria = requireText(completionCriteria, "completionCriteria");
        this.status = Objects.requireNonNull(status, "status");
        this.parentQuestId = parentQuestId == null || parentQuestId.isBlank() ? null : parentQuestId.trim();
    }

    public static DailyQuest original(
            String id,
            String title,
            String description,
            QuestCategory category,
            QuestDifficulty difficulty,
            int estimatedMinutes,
            String completionCriteria
    ) {
        return new DailyQuest(
                id,
                title,
                description,
                category,
                difficulty,
                estimatedMinutes,
                completionCriteria,
                QuestStatus.TODO,
                null
        );
    }

    public static DailyQuest redesigned(
            String id,
            String parentQuestId,
            String title,
            String description,
            QuestCategory category,
            QuestDifficulty difficulty,
            int estimatedMinutes,
            String completionCriteria
    ) {
        return new DailyQuest(
                id,
                title,
                description,
                category,
                difficulty,
                estimatedMinutes,
                completionCriteria,
                QuestStatus.TODO,
                requireText(parentQuestId, "parentQuestId")
        );
    }

    public void complete() {
        if (status != QuestStatus.TODO) {
            throw new IllegalStateException("Only TODO quests can be completed");
        }
        status = QuestStatus.DONE;
    }

    public void fail(FailureReason reason, String note) {
        if (status != QuestStatus.TODO) {
            throw new IllegalStateException("Only TODO quests can be failed");
        }
        failureReason = Objects.requireNonNull(reason, "failureReason");
        failureNote = normalizeOptionalText(note);
        status = QuestStatus.FAILED;
    }

    public void markRedesigned(FailureReason reason, String note) {
        if (status != QuestStatus.TODO && status != QuestStatus.FAILED) {
            throw new IllegalStateException("Only TODO or FAILED quests can be redesigned");
        }
        failureReason = Objects.requireNonNull(reason, "failureReason");
        failureNote = normalizeOptionalText(note);
        status = QuestStatus.REDESIGNED;
    }

    public boolean isOriginal() {
        return parentQuestId == null;
    }

    public String id() {
        return id;
    }

    public String title() {
        return title;
    }

    public String description() {
        return description;
    }

    public QuestCategory category() {
        return category;
    }

    public QuestDifficulty difficulty() {
        return difficulty;
    }

    public int estimatedMinutes() {
        return estimatedMinutes;
    }

    public String completionCriteria() {
        return completionCriteria;
    }

    public QuestStatus status() {
        return status;
    }

    public FailureReason failureReason() {
        return failureReason;
    }

    public String failureNote() {
        return failureNote;
    }

    public String parentQuestId() {
        return parentQuestId;
    }

    private static String requireText(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(fieldName + " is required");
        }
        return value.trim();
    }

    private static String normalizeOptionalText(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
