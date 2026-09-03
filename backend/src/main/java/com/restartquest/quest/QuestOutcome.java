package com.restartquest.quest;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "quest_outcomes")
class QuestOutcome {

    @Id
    private UUID id;

    @Column(name = "quest_id", nullable = false, unique = true)
    private UUID questId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private OutcomeType type;

    @Enumerated(EnumType.STRING)
    @Column(length = 32)
    private Barrier barrier;

    @Column(length = 300)
    private String note;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected QuestOutcome() {
    }

    private QuestOutcome(
            UUID id,
            UUID questId,
            OutcomeType type,
            Barrier barrier,
            String note,
            Instant createdAt) {
        this.id = id;
        this.questId = questId;
        this.type = type;
        this.barrier = barrier;
        this.note = note;
        this.createdAt = createdAt;
    }

    static QuestOutcome completed(UUID questId, Instant createdAt) {
        return new QuestOutcome(UUID.randomUUID(), questId, OutcomeType.COMPLETED, null, null, createdAt);
    }

    static QuestOutcome blocked(UUID questId, Barrier barrier, String note, Instant createdAt) {
        return new QuestOutcome(UUID.randomUUID(), questId, OutcomeType.BLOCKED, barrier, note, createdAt);
    }

    UUID getQuestId() {
        return questId;
    }

    OutcomeType getType() {
        return type;
    }

    Barrier getBarrier() {
        return barrier;
    }

    String getNote() {
        return note;
    }

    Instant getCreatedAt() {
        return createdAt;
    }
}
